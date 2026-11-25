// 言語化ジム：本体
// データはこの端末の中（localStorage）だけに保存。外には送らない。

const KEY = 'gengoka-gym-records';
const $view = document.getElementById('view');
const $title = document.getElementById('title');
const $back = document.getElementById('back');

// ---------- 保存まわり ----------
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}
function saveRecords(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { alert('保存できませんでした（容量や設定を確認してください）'); }
}
function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtSec(s) {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function pick(arr, not) {
  const pool = arr.length > 1 ? arr.filter((x) => x !== not) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

// 連続日数：今日か昨日から、さかのぼって1日も空いていない日数
function streak(records) {
  const days = new Set(records.map((r) => r.day));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// 今日のメニュー：3つの悩みから1つずつ。日によって入れ替わる
function todayMenu() {
  const n = Math.floor(new Date(dayKey()).getTime() / 86400000);
  return [['why', 'what', 'w5h1'][n % 3], 'common', ['set', 'tatoe'][n % 2]];
}

// ---------- 手順（1問ずつ答えていく形） ----------
function stepsFor(modeId, topic) {
  const m = MODES[modeId];
  if (modeId === 'why' || modeId === 'what') {
    const ask = modeId === 'why' ? 'それは、なぜ？' : 'それって、どういうこと？';
    return Array.from({ length: 5 }, (_, i) => ({
      label: `${i + 1}回目`,
      q: (ans) => (i === 0 ? topic : `「${ans[i - 1]}」\n${ask}`),
      ph: i === 0 ? '思いついたままでOK' : '一言でOK',
    }));
  }
  if (modeId === 'w5h1') {
    return m.parts.map((p) => ({ label: p.k, q: () => p.q.replace('{t}', topic), ph: '短くてOK' }));
  }
  if (modeId === 'set') {
    return [
      { label: '具体①', q: () => `${topic}\n\nまず、自分の経験を書こう。\nどんな出来事があった？`, ph: '例：〇〇の時に、〇〇した', multi: true },
      { label: '具体②', q: () => 'その時、どう感じた？', ph: '例：〇〇だと思った', multi: true },
      { label: '抽象', q: () => `じゃあ結論は？\n「${topic}」に、一言で答えると？`, ph: '一言でまとめる' },
    ];
  }
  if (modeId === 'tatoe') {
    return [
      { label: '一言', q: () => `「${topic}」について、\n自分の意見を一言でいうと？`, ph: '例：〇〇は〇〇だと思う' },
      { label: 'たとえ', q: (ans) => `「${ans[0]}」\n\nこれを、みんなが知っている別のものに例えると？`, ph: '例：〇〇のように、〇〇', multi: true },
    ];
  }
  return [];
}

// 結果の見せ方（画面とコピー用の両方で使う）
function summary(r) {
  const m = MODES[r.mode];
  const a = r.answers;
  if (r.mode === 'why' || r.mode === 'what') {
    return {
      lines: a.map((x, i) => `${'①②③④⑤'[i]} ${x}`),
      key: r.mode === 'why' ? 'たどり着いた本音' : 'たどり着いた本質',
      keyText: a[a.length - 1],
    };
  }
  if (r.mode === 'w5h1') {
    return { lines: m.parts.map((p, i) => `${p.k}：${a[i] || ''}`), key: '次にやること', keyText: a[5] };
  }
  if (r.mode === 'common') {
    const list = a.filter(Boolean);
    return { lines: list.map((x, i) => `${i + 1}. ${x}`), key: '見つけた共通点', keyText: `${list.length}個` };
  }
  if (r.mode === 'set') {
    return {
      lines: [`出来事：${a[0]}`, `感じたこと：${a[1]}`, `結論：${a[2]}`],
      key: '人に話すなら（結論 → 経験）',
      keyText: `${a[2]}\n\n実際、${a[0]}\n${a[1]}`,
    };
  }
  if (r.mode === 'tatoe') {
    return { lines: [`一言：${a[0]}`, `たとえ：${a[1]}`], key: '人に話すなら', keyText: `${a[0]}\n\nたとえば、${a[1]}` };
  }
  return { lines: a, key: '', keyText: '' };
}
function copyText(r) {
  const m = MODES[r.mode];
  const s = summary(r);
  let t = `【${m.name}】${r.topic}\n` + s.lines.join('\n');
  if (s.keyText) t += `\n\n▼${s.key}\n${s.keyText}`;
  if (r.memo) t += `\n\n▼ふりかえり\n${r.memo}`;
  return t;
}
async function copy(t, btn) {
  try {
    await navigator.clipboard.writeText(t);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    ta.remove();
  }
  if (btn) { const o = btn.textContent; btn.textContent = 'コピーしました'; setTimeout(() => (btn.textContent = o), 1500); }
}

// ---------- 画面 ----------
let timerId = null;
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

function setHeader(title, backTo) {
  $title.textContent = title;
  $back.hidden = !backTo;
  $back.onclick = () => (location.hash = backTo);
}
function setTab(tab) {
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
}

function render() {
  stopTimer();
  const h = location.hash.replace(/^#\/?/, '');
  const [page, arg] = h.split('/');
  window.scrollTo(0, 0);
  if (page === 'menu') return viewMenu();
  if (page === 'train' && MODES[arg]) return viewTrain(arg);
  if (page === 'log' && arg) return viewRecord(arg);
  if (page === 'log') return viewLog();
  return viewHome();
}

function modeCard(id, done) {
  const m = MODES[id];
  const st = STEPS[m.step - 1];
  return `<a class="mode ${st.color}" href="#/train/${id}">
    <span class="mi">${m.icon}</span>
    <span class="mt"><b>${esc(m.name)}</b><small>${esc(m.gain)}</small></span>
    <span class="ms">${done ? '<em class="done">✓ 今日やった</em>' : `${fmtSec(m.sec)}`}</span>
  </a>`;
}

function viewHome() {
  setHeader('言語化ジム'); setTab('home');
  const recs = loadRecords();
  const today = recs.filter((r) => r.day === dayKey());
  const doneModes = new Set(today.map((r) => r.mode));
  const menu = todayMenu();
  const menuDone = menu.filter((id) => doneModes.has(id)).length;
  $view.innerHTML = `
    <section class="stats">
      <div><b>${streak(recs)}</b><small>日連続</small></div>
      <div><b>${today.length}</b><small>今日の回数</small></div>
      <div><b>${recs.length}</b><small>これまで</small></div>
    </section>

    <h2>今日のメニュー <small>${menuDone}/3</small></h2>
    <p class="note">3つの悩みから1つずつ。全部で10分くらいです。</p>
    <div class="modes">${menu.map((id) => modeCard(id, doneModes.has(id))).join('')}</div>
    ${menuDone === 3 ? '<p class="clear">今日のメニュー完了です。おつかれさまでした。</p>' : ''}

    <details class="card idea">
      <summary>このアプリの考え方</summary>
      <p>「言葉にできない」は、才能じゃなくて3つの段階のどこかで止まっているだけ。段階ごとに鍛え方がちがいます。</p>
      <ol class="three">
        ${STEPS.map((s) => `<li class="${s.color}"><b>${esc(s.worry)}</b><span>→ ${esc(s.fix)}</span></li>`).join('')}
      </ol>
      <p class="sub">元ネタ：PIVOT「瞬間言語化トレーニング」前編・後編。毎日少しずつ続けるのが一番の近道、という話でした。</p>
    </details>`;
}

function viewMenu() {
  setHeader('トレーニング'); setTab('menu');
  const done = new Set(loadRecords().filter((r) => r.day === dayKey()).map((r) => r.mode));
  $view.innerHTML = STEPS.map((s) => `
    <h2 class="sh ${s.color}"><span>${s.name}</span>${esc(s.worry)}</h2>
    <p class="note">${esc(s.fix)}</p>
    <div class="modes">${Object.keys(MODES).filter((id) => MODES[id].step === s.id).map((id) => modeCard(id, done.has(id))).join('')}</div>
  `).join('');
}

function viewTrain(modeId) {
  const m = MODES[modeId];
  const st = STEPS[m.step - 1];
  setHeader(m.name, '#/menu'); setTab('menu');
  let topic = pick(m.topics);

  // --- はじめる前 ---
  function intro() {
    stopTimer();
    $view.innerHTML = `
      <div class="badge ${st.color}">${st.name}：${esc(st.worry)}</div>
      <p class="how">${esc(m.how)}</p>
      <details class="card ex"><summary>やり方の例を見る</summary><ul>${m.example.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>

      <div class="card topic">
        <small>今回のお題</small>
        <p id="topic">${esc(topic)}</p>
        <div class="row">
          <button class="ghost" id="shuffle">🔄 別のお題</button>
          <button class="ghost" id="own">✏️ 自分で決める</button>
        </div>
        <div id="ownBox" hidden>
          <input id="ownIn" type="text" placeholder="${modeId === 'common' ? '例：パテと化粧' : '例：今日現場で言われたこと'}" enterkeyhint="done">
          <button class="ghost" id="ownOk">このお題にする</button>
        </div>
      </div>

      <button class="main" id="start">はじめる（制限時間 ${fmtSec(m.sec)}）</button>
      <p class="sub center">時間が過ぎても最後まで書けます。まずは止まらずに書くのが練習です。</p>`;
    document.getElementById('shuffle').onclick = () => { topic = pick(m.topics, topic); document.getElementById('topic').textContent = topic; };
    document.getElementById('own').onclick = () => { const b = document.getElementById('ownBox'); b.hidden = !b.hidden; if (!b.hidden) document.getElementById('ownIn').focus(); };
    const setOwn = () => { const v = document.getElementById('ownIn').value.trim(); if (v) { topic = v; document.getElementById('topic').textContent = v; document.getElementById('ownBox').hidden = true; } };
    document.getElementById('ownOk').onclick = setOwn;
    document.getElementById('ownIn').onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) setOwn(); };
    document.getElementById('start').onclick = run;
  }

  // --- 本番 ---
  function run() {
    const started = Date.now();
    const answers = [];
    let over = false;

    $view.innerHTML = `
      <div class="timer" id="timer"><div class="bar" id="bar"></div><span id="tt">${fmtSec(m.sec)}</span></div>
      <p class="overmsg" id="overmsg" hidden>⏰ 時間切れ。でもこのまま最後まで書いてOKです。</p>
      <div id="stage"></div>`;
    const $bar = document.getElementById('bar');
    const $tt = document.getElementById('tt');
    const tick = () => {
      const el = (Date.now() - started) / 1000;
      const left = m.sec - el;
      $bar.style.width = `${Math.max(0, (left / m.sec) * 100)}%`;
      $tt.textContent = left >= 0 ? fmtSec(left) : `+${fmtSec(-left)}`;
      if (left < 0 && !over) {
        over = true;
        document.getElementById('timer').classList.add('over');
        document.getElementById('overmsg').hidden = false;
        if (navigator.vibrate) navigator.vibrate(200);
      }
    };
    tick();
    timerId = setInterval(tick, 250);

    const finish = (ans) => {
      stopTimer();
      const elapsed = Math.round((Date.now() - started) / 1000);
      const rec = { id: String(Date.now()), at: new Date().toISOString(), day: dayKey(), mode: modeId, topic, answers: ans, elapsed, limit: m.sec, memo: '' };
      const list = loadRecords(); list.unshift(rec); saveRecords(list);
      result(rec);
    };

    const $stage = document.getElementById('stage');

    if (modeId === 'common') {
      $stage.innerHTML = `
        <div class="card q"><small>この2つの共通点は？</small><p>${esc(topic)}</p></div>
        <p class="count" id="count">0 / 10</p>
        <ol class="ten">${Array.from({ length: 10 }, (_, i) => `<li><input type="text" data-i="${i}" enterkeyhint="next" placeholder="${i === 0 ? 'くだらなくてもOK' : ''}"></li>`).join('')}</ol>
        <button class="main" id="fin">おわり</button>`;
      const ins = [...$stage.querySelectorAll('input')];
      const upd = () => (document.getElementById('count').textContent = `${ins.filter((x) => x.value.trim()).length} / 10`);
      ins.forEach((inp, i) => {
        inp.oninput = upd;
        inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); (ins[i + 1] || document.getElementById('fin')).focus(); } };
      });
      ins[0].focus();
      document.getElementById('fin').onclick = () => {
        const a = ins.map((x) => x.value.trim());
        if (!a.some(Boolean)) { alert('1個だけでも書いてみましょう'); return; }
        finish(a);
      };
      return;
    }

    const steps = stepsFor(modeId, topic);
    let i = 0;
    const draw = () => {
      const s = steps[i];
      const prev = answers.slice(0, i);
      $stage.innerHTML = `
        <div class="dots">${steps.map((x, j) => `<span class="${j < i ? 'ok' : j === i ? 'now' : ''}">${esc(x.label)}</span>`).join('')}</div>
        ${prev.length && (modeId === 'why' || modeId === 'what') ? `<div class="chain">${prev.map((x, j) => `<div><i>${'①②③④⑤'[j]}</i>${esc(x)}</div>`).join('')}</div>` : ''}
        <div class="card q"><small>${esc(s.label)}</small><p>${esc(s.q(answers)).replace(/\n/g, '<br>')}</p></div>
        ${s.multi
          ? `<textarea id="ans" rows="3" placeholder="${esc(s.ph)}"></textarea>`
          : `<input id="ans" type="text" enterkeyhint="${i === steps.length - 1 ? 'done' : 'next'}" placeholder="${esc(s.ph)}">`}
        <div class="row">
          ${i > 0 ? '<button class="ghost" id="prev">← 1つ戻る</button>' : ''}
          <button class="main" id="next">${i === steps.length - 1 ? 'おわり' : '次へ →'}</button>
        </div>`;
      const $a = document.getElementById('ans');
      $a.value = answers[i] || '';
      $a.focus();
      const go = () => {
        const v = $a.value.trim();
        if (!v) { $a.classList.add('shake'); setTimeout(() => $a.classList.remove('shake'), 400); return; }
        answers[i] = v;
        if (i === steps.length - 1) finish(answers.slice());
        else { i++; draw(); }
      };
      document.getElementById('next').onclick = go;
      if (!s.multi) $a.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go(); } };
      const $p = document.getElementById('prev');
      if ($p) $p.onclick = () => { answers[i] = $a.value.trim(); i--; draw(); };
    };
    draw();
  }

  // --- おわったあと ---
  function result(rec) {
    const s = summary(rec);
    const inTime = rec.elapsed <= rec.limit;
    $view.innerHTML = `
      <div class="finish ${inTime ? 'in' : 'out'}">
        <b>${inTime ? '時間内にできました' : 'おつかれさまでした'}</b>
        <small>かかった時間 ${fmtSec(rec.elapsed)}（目安 ${fmtSec(rec.limit)}）</small>
      </div>
      ${s.keyText ? `<div class="card key"><small>${esc(s.key)}</small><p>${esc(s.keyText).replace(/\n/g, '<br>')}</p></div>` : ''}
      <details class="card all"><summary>書いたこと全部</summary><p class="t">${esc(rec.topic)}</p><ul>${s.lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
      <label class="memo">ふりかえり（どこで詰まった？ 気づいたこと）
        <textarea id="memo" rows="3" placeholder="例：3回目から同じことを言ってた"></textarea>
      </label>
      <div class="row">
        <button class="ghost" id="cp">📋 コピー</button>
        <button class="ghost" id="again">🔄 別のお題でもう1回</button>
      </div>
      <a class="main" href="#/">ホームへ</a>`;
    const $memo = document.getElementById('memo');
    $memo.oninput = () => {
      const list = loadRecords(); const r = list.find((x) => x.id === rec.id);
      if (r) { r.memo = $memo.value; rec.memo = $memo.value; saveRecords(list); }
    };
    document.getElementById('cp').onclick = (e) => copy(copyText(rec), e.target);
    document.getElementById('again').onclick = () => { topic = pick(m.topics, topic); intro(); };
  }

  intro();
}

function viewLog() {
  setHeader('きろく'); setTab('log');
  const recs = loadRecords();
  if (!recs.length) {
    $view.innerHTML = '<p class="empty">まだ記録はありません。<br>「今日のメニュー」から1つやってみましょう。</p><a class="main" href="#/">ホームへ</a>';
    return;
  }
  // 日ごとにまとめる
  const byDay = {};
  recs.forEach((r) => (byDay[r.day] = byDay[r.day] || []).push(r));
  // 直近7日の回数グラフ
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - (6 - k)); return d; });
  const max = Math.max(1, ...days.map((d) => (byDay[dayKey(d)] || []).length));
  $view.innerHTML = `
    <div class="card week">
      <small>この7日間</small>
      <div class="bars">${days.map((d) => { const n = (byDay[dayKey(d)] || []).length; return `<div><span style="height:${(n / max) * 100}%"></span><em>${n || ''}</em><i>${'日月火水木金土'[d.getDay()]}</i></div>`; }).join('')}</div>
    </div>
    ${Object.keys(byDay).sort().reverse().map((day) => `
      <h3>${day.slice(5).replace('-', '/')}（${'日月火水木金土'[new Date(day).getDay()]}）</h3>
      ${byDay[day].map((r) => {
        const m = MODES[r.mode]; const s = summary(r);
        return `<a class="rec ${STEPS[m.step - 1].color}" href="#/log/${r.id}">
          <span class="mi">${m.icon}</span>
          <span class="mt"><b>${esc(r.topic)}</b><small>${esc(m.name)}${s.keyText && r.mode !== 'common' ? ' → ' + esc(String(s.keyText).split('\n')[0]) : ''}</small></span>
        </a>`;
      }).join('')}
    `).join('')}`;
}

function viewRecord(id) {
  setHeader('きろく', '#/log'); setTab('log');
  const list = loadRecords();
  const r = list.find((x) => x.id === id);
  if (!r) { $view.innerHTML = '<p class="empty">この記録は見つかりませんでした。</p>'; return; }
  const m = MODES[r.mode]; const s = summary(r);
  const d = new Date(r.at);
  $view.innerHTML = `
    <div class="badge ${STEPS[m.step - 1].color}">${m.icon} ${esc(m.name)}</div>
    <p class="sub">${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}　かかった時間 ${fmtSec(r.elapsed)}（目安 ${fmtSec(r.limit)}）</p>
    <div class="card q"><small>お題</small><p>${esc(r.topic)}</p></div>
    <ul class="lines">${s.lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    ${s.keyText ? `<div class="card key"><small>${esc(s.key)}</small><p>${esc(s.keyText).replace(/\n/g, '<br>')}</p></div>` : ''}
    <label class="memo">ふりかえり<textarea id="memo" rows="3">${esc(r.memo || '')}</textarea></label>
    <div class="row">
      <button class="ghost" id="cp">📋 コピー</button>
      <a class="ghost" href="#/train/${r.mode}">🔄 同じ種類をやる</a>
    </div>
    <button class="danger" id="del">この記録を消す</button>`;
  document.getElementById('memo').oninput = (e) => { r.memo = e.target.value; saveRecords(list); };
  document.getElementById('cp').onclick = (e) => copy(copyText(r), e.target);
  document.getElementById('del').onclick = () => {
    if (!confirm('この記録を消します。元に戻せません。よろしいですか？')) return;
    saveRecords(list.filter((x) => x.id !== id));
    location.hash = '#/log';
  };
}

window.addEventListener('hashchange', render);
render();
