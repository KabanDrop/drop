const WEAR_DESC = { FN:"Factory New (FN) — 0.00–0.07: идеальное состояние, без видимых повреждений.", MW:"Minimal Wear (MW) — 0.07–0.15: едва заметные царапины и потёртости.", FT:"Field-Tested (FT) — 0.15–0.38: износ хорошо заметен, краска местами стёрта.", WW:"Well-Worn (WW) — 0.38–0.45: значительная часть рисунка стёрта.", BS:"Battle-Scarred (BS) — 0.45–1.00: максимальный износ, краска стёрта до металла." };
/* ============================================================
   KabanDrop — CS2 case-opening simulator (Kekser-style)
   ============================================================ */
(function () {
'use strict';

const SKINS = window.KEKSER_SKINS || {};
const CASES = ((window.KEKSER_CASES || []).concat(window.KEKSER_EXTRA_CASES || [])).filter(c => c && c.items && c.items.length);
const IMG = 'assets/';
const LS_KEY = 'kabandrop_v2';

const WEAR = { FN:"Прямо с завода", MW:"Немного поношенное", FT:"После полевых испытаний", WW:"Поношенное", BS:"Закалённое в боях" };
const CAT_ORDER = ['Из CS2','Наши сборки','Арсенал','Люкс','Ножевые','Премиум','Коллекции','Редкость','Специальная коллекция','Цветная коллекция','Limited','NEW','Дешевые','Caser Armory Cases'];

/* rarity color class */
function rarityClass(key) {
  const s = SKINS[key]; const c = ((s && s.rarity_color) || '').toLowerCase();
  if (c === '#ffae39') return 'r-gold';
  if (c === '#eb4b4b') return 'r-red';
  if (c === '#d32ce6') return 'r-pink';
  if (c === '#8847ff') return 'r-purple';
  if (c === '#4b69ff') return 'r-blue';
  if (c === '#5e98d9') return 'r-light';
  return 'r-grey';
}

/* ---------- helpers ---------- */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const img = p => p ? IMG + p : '';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = n => Math.round(n || 0).toLocaleString('ru-RU');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pick = a => a[Math.floor(Math.random() * a.length)];
const onError = 'onerror="this.style.opacity=0"';
const COIN = '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffa800"/><path d="M12 7v10M9 9.5a3 3 0 013-1.5c1.6 0 3 .8 3 2s-1.4 2-3 2-3 .8-3 2 1.4 2 3 2a3 3 0 003-1.5" fill="none" stroke="#000" stroke-width="1.6"/></svg>';

function rarity(key) {
  const s = SKINS[key];
  return { color: (s && s.rarity_color) || '#4b69ff', name: (s && s.rarity) || '' };
}
function imgOf(key) { const s = SKINS[key]; return s ? s.image : ''; }
function priceOf(key, wear, st, sv) {
  const s = SKINS[key]; if (!s || !s.price) return 0;
  const b = s.price;
  let use = 'nonST';
  if (sv && b.SV && Object.keys(b.SV).length) use = 'SV';
  else if (st && b.ST && Object.keys(b.ST).length) use = 'ST';
  let bucket = b[use] || {};
  let v = null;
  if (wear && bucket[wear] != null) v = bucket[wear];
  if (v == null) { const ks = Object.keys(bucket); if (ks.length) v = bucket[ks[0]]; }
  if (v == null && use !== 'nonST') {
    const b2 = b.nonST || {};
    if (wear && b2[wear] != null) v = b2[wear];
    else { const ks = Object.keys(b2); if (ks.length) v = b2[ks[0]]; }
  }
  return v == null ? 0 : v;
}
function repPrice(key) {
  const s = SKINS[key]; if (!s || !s.price) return 0;
  const b = s.price.nonST || {};
  for (const w of ['FN','MW','FT','WW','BS','NW']) if (b[w] != null) return b[w];
  const ks = Object.keys(b); if (ks.length) return b[ks[0]];
  return 0;
}
function repWear(key) {
  const s = SKINS[key]; const b = (s && s.price && s.price.nonST) || {};
  for (const w of ['FN','MW','FT','WW','BS']) if (b[w] != null) return w;
  return null;
}

/* ---------- sound ---------- */
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; }
function tone(freq, dur, type, vol, slide) {
  if (!state.sound) return;
  const c = ac(); if (!c) return;
  try {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol || 0.08, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
  } catch (e) {}
}
const sfx = {
  tick: () => tone(1150, 0.035, 'square', 0.025),
  click: () => tone(520, 0.06, 'triangle', 0.05),
  open: () => tone(300, 0.25, 'sawtooth', 0.05, 900),
  win: () => { tone(660, 0.12, 'triangle', 0.09); setTimeout(() => tone(880, 0.16, 'triangle', 0.09), 110); setTimeout(() => tone(1180, 0.28, 'triangle', 0.09), 240); },
  bigwin: () => { [523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>tone(f,0.3,'triangle',0.1),i*110)); },
  lose: () => { tone(300, 0.3, 'sawtooth', 0.07, 120); },
  sell: () => tone(700, 0.1, 'sine', 0.06, 400),
  upSpin: () => tone(180, 1.4, 'sawtooth', 0.035, 1500)
};

/* ---------- state ---------- */
let state = {
  balance: 10000,
  inv: [],
  stats: { opened: 0, spent: 0, earned: 0, upgraded: 0, upWon: 0, upLossStreak: 0, best: null, crashPlayed: 0, crashBest: 0, crashEarned: 0 },
  sound: true
};
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const d = JSON.parse(raw); state = Object.assign(state, d); state.stats = Object.assign({ opened:0,spent:0,earned:0,upgraded:0,upWon:0,upLossStreak:0,best:null,crashPlayed:0,crashBest:0,crashEarned:0 }, d.stats || {}); }
  } catch (e) {}
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
function syncBalance() {
  const el = $('#balVal'); if (el) el.textContent = money(state.balance);
  const el2 = $('#balInvCount'); if (el2) el2.textContent = state.inv.length;
  const cb = $('#crBal'); if (cb) cb.textContent = money(state.balance) + ' ₽';
  const cb2 = $('#crBal2'); if (cb2) cb2.textContent = money(state.balance) + ' ₽';
}

/* ---------- fx (confetti) ---------- */
const fx = $('#fx'); const fxc = fx ? fx.getContext('2d') : null;
let confs = [], fxRunning = false;
function resizeFx() { if (!fx) return; fx.width = innerWidth; fx.height = innerHeight; }
function burst(n, colors) {
  if (!fxc) return;
  for (let i = 0; i < n; i++) confs.push({
    x: innerWidth / 2 + rnd(-120, 120), y: innerHeight * 0.34 + rnd(-40, 40),
    vx: rnd(-7, 7), vy: rnd(-13, -4), g: 0.32, s: rnd(5, 11), r: rnd(0, 6.28), vr: rnd(-0.3, 0.3),
    c: (colors && colors.length ? pick(colors) : pick(['#44c987','#83d8ff','#ffd700','#ff6b6b','#c084fc'])), life: 1
  });
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  fxc.clearRect(0, 0, fx.width, fx.height);
  confs = confs.filter(p => p.life > 0 && p.y < fx.height + 40);
  for (const p of confs) {
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.006;
    fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.r); fxc.globalAlpha = Math.max(0, p.life);
    fxc.fillStyle = p.c; fxc.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); fxc.restore();
  }
  if (confs.length) requestAnimationFrame(fxLoop); else { fxRunning = false; fxc.clearRect(0, 0, fx.width, fx.height); }
}

/* ---------- toast ---------- */
function toast(msg, kind) {
  const w = $('#toasts'); if (!w) return;
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.innerHTML = esc(msg);
  w.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s, transform .3s'; t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(1rem)'; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

/* ---------- modal ---------- */
function modal(html, opts) {
  opts = opts || {};
  const root = $('#modals');
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = '<div class="modal ' + (opts.cls || '') + '">'
    + (opts.noClose ? '' : '<div class="modal-head"><h2></h2><button class="modal-close" data-close>×</button></div>')
    + '<div class="modal-body">' + html + '</div></div>';
  root.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov && !opts.noClose) close(); });
  const cl = ov.querySelector('[data-close]'); if (cl) cl.onclick = close;
  function close() { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 180); }
  ov.close = close;
  return ov;
}

/* ---------- item card ---------- */
function itemCard(key, wear, st, sv, opts) {
  opts = opts || {};
  const val = priceOf(key, wear, st, sv);
  const parts = String(key).split(' | ');
  const weapon = parts[0] || key, skin = parts[1] || ' ';
  const priceHtml = opts.price === false ? ''
    : '<span class="item-price">' + (opts.price != null ? opts.price : money(val) + COIN) + '</span>';
  const wearHtml = (!opts.hideWear && wear && wear !== 'NW') ? '<span class="item-wear">' + wear + '</span>' : '';
  return '<div class="item ' + rarityClass(key) + (opts.sel ? ' is-selected' : '') + (opts.click ? ' is-click' : '') + '"'
    + ' data-key="' + esc(key) + '" data-wear="' + (wear || '') + '" data-st="' + (st ? 1 : 0) + '" data-sv="' + (sv ? 1 : 0) + '" data-price="' + val + '">'
    + '<div class="item-pic"><img loading="lazy" decoding="async" draggable="false" src="' + img(imgOf(key)) + '" ' + onError + '>'
    + priceHtml + wearHtml
    + '</div>'
    + '<div class="item-name">' + esc(weapon) + '</div>'
    + '<div class="item-skin">' + esc(skin) + '</div>'
    + '</div>';
}

/* ============================================================
   LIVE DROP — absolute-positioned cells, vertical scroll
   ============================================================ */
const LD_CELL_H = 90;
let ldCells = [], ldOffset = 0, ldAnimating = false, ldLastMove = 0;
function ldRandomItem() {
  const c = CASES[Math.floor(Math.random() * CASES.length)];
  if (!c || !c.items.length) return null;
  const it = c.items[Math.floor(Math.random() * c.items.length)];
  const { weapon, skin } = splitKey(it.key);
  return {
    key: it.key, weapon: weapon, skin: skin,
    val: priceOf(it.key, it.wear, it.st, it.sv) || repPrice(it.key)
  };
}
function splitKey(key) {
  const parts = key.split(' | ');
  return { weapon: parts[0] || key, skin: parts[1] || '' };
}
function ldFillCell(cell, data) {
  cell.card.style.setProperty('--rc', rarityColor(data.key));
  cell.img.src = img(imgOf(data.key));
  cell.name.textContent = data.weapon;
  cell.skin.textContent = data.skin;
}
function rarityColor(key) {
  const s = SKINS[key]; return ((s && s.rarity_color) || '#b0c3d9').toLowerCase();
}
function liveDropInit() {
  const track = $('#ldTrack'); if (!track) return;
  ldCells = [];
  const count = Math.ceil(innerHeight / LD_CELL_H) + 3;
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'ld-cell';
    cell.innerHTML = '<div class="ld-card"><img alt="" draggable="false"></div><div class="ld-text"><b></b><span></span></div>';
    track.appendChild(cell);
    const c = { el: cell, card: cell.querySelector('.ld-card'), img: cell.querySelector('img'), name: cell.querySelector('b'), skin: cell.querySelector('span'), pos: i * LD_CELL_H };
    ldFillCell(c, ldRandomItem() || { key: '', weapon: '', skin: '' });
    cell.style.transform = 'translate3d(0,' + c.pos + 'px,0)';
    ldCells.push(c);
  }
  ldOffset = 0; ldAnimating = false; ldLastMove = performance.now();
  requestAnimationFrame(ldLoop);
}
function ldLoop(now) {
  if (!ldCells.length) return;
  if (now - ldLastMove > 3000) {
    ldLastMove = now;
    const last = ldCells.pop();
    ldCells.unshift(last);
    last.pos = ldCells[1].pos - LD_CELL_H;
    const d = ldRandomItem(); if (d) ldFillCell(last, d);
    last.el.style.transform = 'translate3d(0,' + last.pos + 'px,0)';
  }
  requestAnimationFrame(ldLoop);
}
function liveDropAdd(key, wear, val) {
  if (!ldCells.length) return;
  const last = ldCells.pop();
  ldCells.unshift(last);
  last.pos = ldCells[1].pos - LD_CELL_H;
  const parts = String(key).split(' | ');
  ldFillCell(last, { key: key, weapon: parts[0] || key, skin: parts[1] || '', val: val });
  last.el.style.transform = 'translate3d(0,' + last.pos + 'px,0)';
  ldLastMove = performance.now();
}

/* ============================================================
   ROUTER
   ============================================================ */
function setActiveTab(name) {
  const map = { case: 'cases', cases: 'cases', upgrade: 'upgrade', inventory: 'inventory', profile: 'profile', games: 'games', crash: 'games', slots: 'games', mines: 'games', coin: 'games' };
  const cur = map[name] || 'cases';
  $$('#nav .nav-link').forEach(a => a.classList.toggle('is-active', a.getAttribute('data-tab') === cur));
}
function gameStopAll() {
  if (typeof crashStop === 'function') crashStop();
  if (typeof slotsStop === 'function') slotsStop();
  if (typeof minesStop === 'function') minesStop();
  if (typeof coinStop === 'function') coinStop();
}
function route() {
  const h = (location.hash || '#/cases').slice(2);
  const parts = h.split('/');
  const name = parts[0] || 'cases';
  const arg = parts[1];
  setActiveTab(name);
  const v = $('#view');
  gameStopAll();
  if (name === 'case' && arg) renderCase(v, arg);
  else if (name === 'upgrade') renderUpgrade(v);
  else if (name === 'inventory') renderInventory(v);
  else if (name === 'profile') renderProfile(v);
  else if (name === 'games' && arg === 'crash') { renderCrash(v); crashStart(); }
  else if (name === 'games' && arg === 'slots') { renderSlots(v); slotsStart(); }
  else if (name === 'games' && arg === 'mines') { renderMines(v); minesStart(); }
  else if (name === 'games' && arg === 'coin') { renderCoin(v); coinStart(); }
  else if (name === 'games') renderGames(v);
  else renderCases(v);
  window.scrollTo(0, 0);
  const main = $('.main'); if (main) main.scrollTop = 0;
}

/* ============================================================
   CASES VIEW
   ============================================================ */
let caseFilter = { q: '' };
function renderCases(v) {
  let list = CASES.slice();
  if (caseFilter.q) { const q = caseFilter.q.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q)); }

  const present = [];
  CAT_ORDER.forEach(c => { if (CASES.some(x => x.category === c)) present.push(c); });
  CASES.forEach(c => { const cat = c.category || 'Другое'; if (!present.includes(cat)) present.push(cat); });

  const groups = present.map(cat => {
    const items = list.filter(c => (c.category || 'Другое') === cat);
    return { cat: cat, items: items };
  }).filter(g => g.items.length);

  v.innerHTML =
    '<div class="page cases">'
    + '<div class="cases-search"><label>'
    +   '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>'
    +   '<input id="caseSearch" placeholder="Поиск..." maxlength="40" value="' + esc(caseFilter.q) + '">'
    + '</label>'
    + '</div>'
    + '<div class="cases-body">'
    + (groups.length === 0 ? '<div class="empty"><b>Кейсы не найдены</b></div>' : '')
    + groups.map(g =>
        '<section class="cases-section">'
        + '<h2>' + esc(g.cat) + '</h2>'
        + '<div class="cases-grid">' + g.items.map(caseCard).join('') + '</div>'
        + '</section>'
      ).join('')
    + '</div></div>';

  let t; $('#caseSearch').oninput = e => { clearTimeout(t); const val = e.target.value; t = setTimeout(() => { caseFilter.q = val; renderCases(v); const el = $('#caseSearch'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); };
}
function caseCard(c) {
  return '<button class="case-card" onclick="location.hash=\'#/case/' + esc(c.slug) + '\'">'
    + '<span class="case-card-pic"><img loading="lazy" draggable="false" src="' + img(c.image) + '" ' + onError + '></span>'
    + '<span class="case-card-info">'
    +   '<span class="case-card-name">' + esc(c.name) + '</span>'
    +   '<span class="case-card-price">' + money(c.price) + '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5a3 3 0 013-1.5c1.6 0 3 .8 3 2s-1.4 2-3 2-3 .8-3 2 1.4 2 3 2a3 3 0 003-1.5" fill="none" stroke="#ffa800" stroke-width="1.5"/></svg></span>'
    + '</span></button>';
}

/* ============================================================
   CASE OPEN VIEW
   ============================================================ */
let openBusy = false, openFast = false, openCount = 1, resultTimer = null;

/* ---- magnifying-lens roulette (Kekser-style) ---- */
const RL = { preDelay: 1200, spin: 6500, easing: 'cubic-bezier(0.2, 0.3, 0.15, 1)', tail: 11, startIdx: 4 };
const CR = {
  L: { W: 154, H: 28, cw: 23,    ch: 17.35, gap: .986, lens: 50,    lw: 27,      lh: 21, lgap: 1.15, rw: 36 },
  M: { W: 75,  H: 24, cw: 26.8,  ch: 20.2,  gap: .986, lens: 50,    lw: 27,      lh: 21, lgap: 1.15, rw: 30.857 },
  S: { W: 50,  H: 18, cw: 20.4,  ch: 16.4,  gap: .751, lens: 38.095,lw: 20.571,  lh: 16, lgap: .876, rw: 23.143 }
};
const crPick = n => n === 1 ? CR.L : (n <= 4 ? CR.M : CR.S);
const rlWinIdx = (c, n) => n === 1 ? clamp(c.items.length * 4, 40, 64) : (n <= 4 ? 24 : 20);
const rlTail = n => (n === 1 ? 9 : 6);

function icoSoundOn() { return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>'; }
function icoSoundOff() { return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>'; }
function icoBolt() { return '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>'; }

function renderCase(v, slug) {
  const c = CASES.find(x => x.slug === slug);
  if (!c) { v.innerHTML = '<div class="page"><div class="empty"><b>Кейс не найден</b></div></div>'; return; }
  const maxOpens = Math.max(1, c.max_opens || 1);
  if (openCount > maxOpens) openCount = 1;
  const drops = c.items.slice().sort((a, b) => (b.chance || 0) - (a.chance || 0));

  v.innerHTML =
    '<div class="page casepage">'
    + '<div class="case-bg" id="caseBg">'
    +   '<div class="case-bg-soft" style="background-image:url(' + img(c.image) + ')"></div>'
    +   '<div class="case-bg-hero" style="background-image:url(' + img(c.image) + ')"></div>'
    +   '<div class="case-bg-below"></div>'
    + '</div>'
    + '<div class="case-hero">'
    +   '<a class="case-back" href="#/cases">← Кейсы</a>'
    +   '<button class="icon-btn case-sound" id="caseSnd" aria-label="Звук" title="Звук">' + (state.sound ? icoSoundOn() : icoSoundOff()) + '</button>'
    +   '<div class="case-stage">'
    +     '<div class="case-hero-img"><img draggable="false" src="' + img(c.image) + '" ' + onError + '></div>'
    +     '<div class="case-roulette" id="reel"></div>'
    +   '</div>'
    + '</div>'
    + '<div class="case-below">'
    +   '<div class="case-panel">'
    +     '<h1>' + esc(c.name) + '</h1>'
    +     '<div class="case-controls">'
    +       '<label class="btn btn-dark case-count">открыть за раз <select id="openCountSel">'
    +         Array.from({ length: maxOpens }, (_, i) => '<option value="' + (i + 1) + '"' + (openCount === i + 1 ? ' selected' : '') + '>' + (i + 1) + '</option>').join('')
    +       '</select></label>'
    +       '<button class="icon-btn case-fast' + (openFast ? ' is-on' : '') + '" id="fastTgl" aria-label="Быстрое открытие" title="Быстрое открытие">' + icoBolt() + '</button>'
    +       '<button class="btn btn-green case-open" id="openBtn">Открыть за ' + money(c.price * openCount) + ' ₽</button>'
    +     '</div>'
    +     '<div class="case-lacks" id="lacks"></div>'
    +   '</div>'
    +   '<div class="case-contents">'
    +     drops.map(it => itemCard(it.key, it.wear, it.st, it.sv, { hideWear: false })).join('')
    +   '</div>'
    + '</div></div>';

  $('#openCountSel').onchange = e => { openCount = clamp(parseInt(e.target.value, 10) || 1, 1, maxOpens); updateOpenBtn(c); };  $('#fastTgl').onclick = () => { openFast = !openFast; $('#fastTgl').classList.toggle('is-on', openFast); sfx.click(); };
  $('#caseSnd').onclick = () => { state.sound = !state.sound; save(); $('#caseSnd').innerHTML = state.sound ? icoSoundOn() : icoSoundOff(); };
  $('#openBtn').onclick = () => openCase(c);
  updateLacks(c); updateOpenBtn(c);
  caseBgCut();
}
let caseBgRO = null;
function caseBgCut() {
  const bg = $('#caseBg'), hero = $('.case-hero');
  if (!bg || !hero) return;
  const set = () => {
    if (!bg.isConnected || !hero.isConnected) return;
    bg.style.setProperty('--cut', hero.offsetHeight + 'px');
  };
  set();
  if (caseBgRO) caseBgRO.disconnect();
  if (window.ResizeObserver) { caseBgRO = new ResizeObserver(set); caseBgRO.observe(hero); }
}
function updateOpenBtn(c) { const b = $('#openBtn'); if (b) b.textContent = 'Открыть за ' + money(c.price * openCount) + ' ₽'; }
function updateLacks(c) {
  const el = $('#lacks'); if (!el) return;
  const cost = c.price * openCount;
  el.innerHTML = state.balance < cost
    ? 'Не хватает ' + money(cost - state.balance) + COIN
    : '';
}
function rlCardHtml(it) {
  const kn = /^(★|Karambit|M9 Bayonet|Bayonet|Butterfly|Flip|Gut|Huntsman|Falchion|Bowie|Shadow Daggers|Navaja|Stiletto|Talon|Ursus|Classic|Paracord|Survival|Nomad|Kukri)/.test(it.key);
  return '<div class="rl-card ' + rarityClass(it.key) + '"><img decoding="async" draggable="false" src="' + img(imgOf(it.key)) + '" ' + onError + (kn ? ' class="is-knife"' : '') + '></div>';
}
function rlBuildTrack(c, winItem, winIdx, tail) {
  const r = winIdx + tail + 1, arr = [];
  for (let i = 0; i < r; i++) arr.push(i === winIdx ? winItem : randomCaseItem(c));
  return arr;
}
function rlCellHtml(d, sell) {
  return '<div class="rl-cell">'
    + '<div class="rl" style="width:' + d.W + 'rem;height:' + d.H + 'rem;--lens:' + d.lens + 'rem">'
    +   '<div class="rl-window"><div class="rl-track"></div></div>'
    +   '<div class="rl-lens" style="width:' + d.lens + 'rem;height:' + d.lens + 'rem"><div class="rl-track"></div></div>'
    +   '<div class="rl-marker" style="height:' + d.lh + 'rem"></div>'
    + '</div>'
    + (sell ? '<button class="btn btn-dark rl-sell" type="button" style="width:' + d.rw + 'rem" disabled></button>' : '')
    + '</div>';
}
function rlSetPos(rl, d, m, ms) {
  const wt = $('.rl-window .rl-track', rl), lt = $('.rl-lens .rl-track', rl);
  if (!wt || !lt) return;
  const offW = d.W / 2 - (m * (d.cw + d.gap) + d.cw / 2);
  const offL = d.lens / 2 - (m * (d.lw + d.lgap) + d.lw / 2);
  const tr = ms ? 'transform ' + ms + 'ms ' + RL.easing : 'none';
  wt.style.transition = tr; lt.style.transition = tr;
  wt.style.transform = 'translate3d(' + offW + 'rem,0,0)';
  lt.style.transform = 'translate3d(' + offL + 'rem,0,0)';
}
let rlFitRO = null;
function rlFit(box, inner, wRem) {
  if (rlFitRO) { rlFitRO.disconnect(); rlFitRO = null; }
  if (!box || !inner) return;
  inner.style.width = wRem + 'rem';
  function apply() {
    if (!box.isConnected || !inner.isConnected) return;
    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
    const need = wRem * fs;
    const s = need > 0 ? Math.min(1, box.clientWidth / need) : 1;
    inner.style.transform = 'translateX(-50%) scale(' + s + ')';
    box.style.height = (inner.offsetHeight * s) + 'px';
  }
  apply();
  if (window.ResizeObserver) { rlFitRO = new ResizeObserver(apply); rlFitRO.observe(box); rlFitRO.observe(inner); }
}
function buildRoulette(c, n, winners) {
  const reel = $('#reel'); if (!reel) return { els: [], d: crPick(n), infos: [] };
  const d = crPick(n);
  const infos = [];
  for (let i = 0; i < n; i++) infos.push({ win: winners ? winners[i] : randomCaseItem(c), idx: rlWinIdx(c, n) });
  reel.innerHTML = '<div class="fitbox"><div class="fitbox-inner"><div class="rl-grid' + (n > 1 ? ' is-2' : '') + '">'
    + infos.map(() => rlCellHtml(d, n > 1)).join('') + '</div></div></div>'
    + '<div class="rl-sellall" id="sellAllBox"><button class="btn btn-green" id="sellAllBtn" type="button" disabled></button></div>';
  const els = $$('.rl', reel);
  els.forEach((rl, i) => {
    const arr = rlBuildTrack(c, infos[i].win, infos[i].idx, rlTail(n));
    const html = arr.map(rlCardHtml).join('');
    const wt = $('.rl-window .rl-track', rl), lt = $('.rl-lens .rl-track', rl);
    wt.innerHTML = html; lt.innerHTML = html;
    wt.style.gap = d.gap + 'rem'; wt.style.height = d.ch + 'rem'; wt.style.setProperty('--cw', d.cw + 'rem');
    lt.style.gap = d.lgap + 'rem'; lt.style.height = d.lh + 'rem'; lt.style.setProperty('--cw', d.lw + 'rem');
    rlSetPos(rl, d, RL.startIdx, 0);
  });
  rlFit($('.fitbox', reel), $('.fitbox-inner', reel), 154);
  return { els: els, d: d, infos: infos };
}

function randomCaseItem(c) {
  const total = c.items.reduce((s, it) => s + (it.chance || 1), 0);
  let r = Math.random() * total;
  for (const it of c.items) { r -= (it.chance || 1); if (r <= 0) return it; }
  return c.items[c.items.length - 1];
}

function openCase(c) {
  if (openBusy) return;
  const n = openCount, cost = c.price * n;
  if (state.balance < cost) { toast('Недостаточно средств для открытия кейса', 'err'); return; }
  openBusy = true;
  clearTimeout(resultTimer);
  state.balance -= cost; state.stats.spent += cost; state.stats.opened += n;
  syncBalance(); save(); sfx.open(); updateLacks(c); updateOpenBtn(c);

  const winners = [];
  for (let i = 0; i < n; i++) winners.push(randomCaseItem(c));
  const instant = openFast;
  const st = buildRoulette(c, n, winners);
  const page = $('.casepage');
  if (page) page.classList.add('phase-pre');

  const startSpin = () => {
    if (page) { page.classList.remove('phase-pre'); page.classList.add('phase-spin'); }
    st.els.forEach((rl, i) => rlSetPos(rl, st.d, st.infos[i].idx, instant ? 0 : RL.spin));
    if (instant) { finish(); return; }
    const t0 = performance.now();
    (function tickLoop() {
      const dt = performance.now() - t0;
      if (dt > RL.spin) return;
      const p = dt / RL.spin;
      if (Math.random() > p * 0.85) sfx.tick();
      setTimeout(tickLoop, 40 + p * 300);
    })();
    setTimeout(finish, RL.spin + 450);
  };
  setTimeout(startSpin, instant ? 0 : RL.preDelay);

  function finish() {
    openBusy = false;
    if (page) { page.classList.remove('phase-pre', 'phase-spin'); page.classList.add('phase-result'); }
    const sellBtns = $$('.rl-sell');
    const round = [];
    st.els.forEach((rl, i) => {
      rl.classList.add('is-done');
      const win = st.infos[i].win, val = priceOf(win.key, win.wear, win.st, win.sv);
      const parts = String(win.key).split(' | ');
      const rEl = document.createElement('div');
      rEl.className = 'rl-result ' + rarityClass(win.key);
      rEl.style.width = st.d.rw + 'rem';
      rEl.innerHTML = '<img draggable="false" src="' + img(imgOf(win.key)) + '" ' + onError + '>'
        + '<div class="rl-result-name"><b>' + esc(parts[0] || win.key) + '</b><span>' + esc(parts[1] || '') + '</span></div>';
      rl.appendChild(rEl);

      const item = { uid: uid(), key: win.key, wear: win.wear, st: win.st, sv: win.sv, value: val, t: Date.now() };
      const entry = { item: item, sold: false, btn: null };
      round.push(entry);
      addInv(item);
      liveDropAdd(win.key, win.wear, val);
      if (!state.stats.best || val > state.stats.best.value) state.stats.best = { key: win.key, value: val };
      const r = rarity(win.key);
      if (val >= 2000) { sfx.bigwin(); burst(140, [r.color, '#ffd700', '#44c987']); }
      else if (val >= 300) { sfx.win(); burst(60, [r.color, '#83d8ff']); }
      else sfx.win();
      if (i === 0 && n === 1) resultTimer = setTimeout(() => showResult(item), 1200);

      const btn = sellBtns[i];
      if (btn) {
        entry.btn = btn;
        btn.disabled = false;
        btn.textContent = 'Продать ' + money(val) + ' ₽';
        setTimeout(() => btn.classList.add('is-shown'), 120);
        btn.onclick = () => {
          const it = state.inv.find(x => x.uid === item.uid);
          if (!it) return;
          state.balance += it.value; state.stats.earned += it.value;
          state.inv = state.inv.filter(x => x.uid !== it.uid);
          sfx.sell(); syncBalance(); save();
          btn.textContent = 'Продано';
          btn.disabled = true;
          btn.classList.add('is-sold');
          entry.sold = true;
          updSellAll(round);
        };
      }
    });
    setupSellAll(round);
    save();
  }
}

function updSellAll(round) {
  const box = $('#sellAllBox'), btn = $('#sellAllBtn');
  if (!box || !btn) return;
  const live = round.filter(r => !r.sold);
  const total = live.reduce((s, r) => s + (r.item.value || 0), 0);
  if (!live.length || !total) { box.classList.remove('is-shown'); btn.disabled = true; return; }
  btn.textContent = 'Продать всё · ' + money(total) + ' ₽';
  btn.disabled = false;
  box.classList.add('is-shown');
}
function setupSellAll(round) {
  const box = $('#sellAllBox'), btn = $('#sellAllBtn');
  if (!box || !btn) return;
  btn.onclick = () => {
    const live = round.filter(r => !r.sold);
    if (!live.length) return;
    let sum = 0;
    live.forEach(r => {
      const it = state.inv.find(x => x.uid === r.item.uid);
      if (it) {
        sum += it.value;
        state.stats.earned += it.value;
        state.inv = state.inv.filter(x => x.uid !== it.uid);
      }
      r.sold = true;
      if (r.btn) { r.btn.textContent = 'Продано'; r.btn.disabled = true; r.btn.classList.add('is-sold'); }
    });
    if (sum) { state.balance += sum; }
    sfx.sell(); syncBalance(); save();
    if (sum) toast('Продано за ' + money(sum) + ' ₽');
    updSellAll(round);
  };
  updSellAll(round);
}

function showResult(item) {
  const rclass = rarityClass(item.key);
  const wearLbl = WEAR[item.wear] || '';
  const m = modal(
    '<div style="text-align:center">'
    + '<div style="font-size:1.2rem;color:#ffffff8c;text-transform:uppercase;margin-bottom:1rem">' + (item.value >= 2000 ? 'Джекпот!' : 'Вы получили') + '</div>'
    + '<div class="item-pic ' + rclass + '" style="width:20rem;height:16rem;margin:0 auto 1rem;border-radius:.2rem"><img src="' + img(imgOf(item.key)) + '" ' + onError + '></div>'
    + '<div style="font-family:var(--head);font-size:1.8rem;font-weight:600">' + esc(item.key) + '</div>'
    + '<div style="color:#ffffff8c;font-size:1.2rem;margin:.3rem 0 1rem">' + (item.st ? 'StatTrak™ · ' : '') + esc(wearLbl) + '</div>'
    + '<div style="font-family:var(--head);font-size:2.4rem;color:#ffa800;margin-bottom:1.6rem">' + money(item.value) + ' ₽</div>'
    + '<div style="display:flex;gap:1rem">'
    +   '<button class="btn btn-green btn-block" data-keep>Забрать в инвентарь</button>'
    +   '<button class="btn btn-dark btn-block" data-sell>Продать ' + money(item.value) + ' ₽</button>'
    + '</div></div>', { cls: 'result-modal' });
  m.querySelector('[data-keep]').onclick = () => m.close();
  m.querySelector('[data-sell]').onclick = () => {
    const it = state.inv.find(x => x.uid === item.uid);
    if (it) { state.balance += it.value; state.stats.earned += it.value; state.inv = state.inv.filter(x => x.uid !== it.uid); sfx.sell(); syncBalance(); save(); toast('Продано за ' + money(it.value) + ' ₽'); }
    m.close();
  };
}

/* ============================================================
   INVENTORY
   ============================================================ */
let invSort = 'new';
function renderInventory(v) {
  const total = state.inv.reduce((s, it) => s + (it.value || priceOf(it.key, it.wear, it.st, it.sv)), 0);
  let list = state.inv.slice();
  if (invSort === 'price-desc') list.sort((a, b) => b.value - a.value);
  else if (invSort === 'price-asc') list.sort((a, b) => a.value - b.value);
  else list.sort((a, b) => b.t - a.t);

  v.innerHTML =
    '<div class="page">'
    + '<div class="inv-bar">'
    +   '<div class="stat"><div class="k">Предметов: </div><div class="v">' + state.inv.length + '</div></div>'
    +   '<div class="stat"><div class="k">Стоимость инвентаря</div><div class="v">' + money(total) + ' ₽</div></div>'
    +   '<div class="inv-sort">'
    +     '<select id="invSort">'
    +       '<option value="new"' + (invSort === 'new' ? ' selected' : '') + '>По новизне</option>'
    +       '<option value="price-desc"' + (invSort === 'price-desc' ? ' selected' : '') + '>По цене</option>'
    +       '<option value="price-asc"' + (invSort === 'price-asc' ? ' selected' : '') + '>Дешевле</option>'
    +     '</select>'
    +     '<button class="btn btn-dark btn-sm" id="sellAll"' + (state.inv.length ? '' : ' disabled') + '>Продать все предметы</button>'
    +   '</div>'
    + '</div>'
    + (state.inv.length
        ? '<div class="inv-grid" id="invGrid">' + list.map(it => itemCard(it.key, it.wear, it.st, it.sv)).join('') + '</div>'
        : '<div class="empty"><b>Ваш инвентарь пуст</b><p>Открой свой первый кейс</p></div>')
    + '</div>';

  const ss = $('#invSort'); if (ss) ss.onchange = e => { invSort = e.target.value; renderInventory(v); };
  const sa = $('#sellAll'); if (sa) sa.onclick = () => {
    if (!state.inv.length) return;
    state.balance += total; state.stats.earned += total; state.inv = []; sfx.sell(); syncBalance(); save();
    toast('Продано всё за ' + money(total) + ' ₽'); renderInventory(v);
  };
  const g = $('#invGrid'); if (g) g.onclick = e => {
    const card = e.target.closest('.item'); if (!card) return;
    const key = card.dataset.key, wear = card.dataset.wear || null, st = card.dataset.st === '1', sv = card.dataset.sv === '1';
    const item = list.find(x => x.key === key && (x.wear || '') === (wear || '') && !!x.st === st && !!x.sv === sv);
    if (item) itemActionModal(item, v);
  };
}
function itemActionModal(item, v) {
  const rclass = rarityClass(item.key);
  const m = modal(
    '<div style="text-align:center">'
    + '<div class="item-pic ' + rclass + '" style="width:18rem;height:14rem;margin:0 auto 1rem;border-radius:.2rem"><img src="' + img(imgOf(item.key)) + '" ' + onError + '></div>'
    + '<div style="font-family:var(--head);font-size:1.8rem;font-weight:600">' + esc(item.key) + '</div>'
    + '<div style="color:#ffffff8c;font-size:1.2rem;margin:.3rem 0 1rem">' + (item.st ? 'StatTrak™ · ' : '') + esc(WEAR[item.wear] || '') + '</div>'
    + '<div style="font-family:var(--head);font-size:2.2rem;color:#ffa800;margin-bottom:1.6rem">' + money(item.value) + ' ₽</div>'
    + '<div style="display:flex;gap:1rem">'
    +   '<button class="btn btn-green btn-block" data-upg>В апгрейд</button>'
    +   '<button class="btn btn-dark btn-block" data-sell>Продать</button>'
    + '</div></div>', { cls: 'result-modal' });
  m.querySelector('[data-sell]').onclick = () => {
    state.balance += item.value; state.stats.earned += item.value;
    state.inv = state.inv.filter(x => x.uid !== item.uid); sfx.sell(); syncBalance(); save();
    toast('Продано за ' + money(item.value) + ' ₽'); m.close(); renderInventory(v);
  };
  m.querySelector('[data-upg]').onclick = () => { m.close(); UP.sel = [item.uid]; UP.target = null; UP.multLabel = null; UP.manual = false; upResolveTarget(); location.hash = '#/upgrade'; };
}

/* ============================================================
   UPGRADE (Kekser-style)
   ============================================================ */
const UP_CFG = { maxItems: 6, maxChance: 75, maxBalanceShare: 0.8 };
const UP_RTP = {
  lowBalance: 2500, targetZoneMax: 20000, highBalance: 200000,
  lowRtp: 2.5, zoneRtp: 1.933, highRtp: 1.152, veryHighRtp: 0.944,
  strongBoostAt: 12, maxLuckBonus: 0.2, maxLuckPenalty: -0.1,
  maxBackendChance: 0.75, minBackendChance: 0,
  maxBuffMul: 2.5, minNerfMul: 0.438, tinyBorder: 0.07
};
const UP_TXT = {
  win:  ['ПОБЕДА!', 'ОТЛИЧНО!', 'УСПЕШНО!', 'СУПЕР!'],
  lose: ['ЭХ', 'НЕ БЕДА', 'УВЫ', 'ПОЧТИ'],
  cWin: ['вы выиграли', 'скин ваш', 'вы это сделали'],
  cLose: ['еще попытку?', 'попробуем еще?', 'еще раз?']
};
const UP_SPIN = {
  normal: { duration: 7000, turns: 6, easing: 'cubic-bezier(0.25, 0.1, 0.2, 1)' },
  turbo:  { duration: 1500, turns: 3, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }
};
const UP_MULT = [['x2', 2], ['x5', 5], ['x10', 10], ['30%', 1 / 0.3], ['50%', 2], ['75%', 1 / 0.75]];
const UP_AI = [25, 60];
const UP_PAGE = 16;
const WHEEL_BL = 291.67;
const WHEEL_R = (WHEEL_BL - 42) / 2;
const WHEEL_CIRC = 2 * Math.PI * WHEEL_R;
const UP_COLORS = {
  idle: ['#691A00', '#FFA800', '#FFA800'],
  win:  ['#0A2E1E', '#2A9B6B', '#44C987'],
  lose: ['#2F110E', '#D55548', '#D55548']
};
const UP_GLOW = {
  idle: 'drop-shadow(0 0 15px rgba(255,168,0,.55))',
  win:  'drop-shadow(0 0 10.4px rgba(68,201,135,.45))',
  lose: 'drop-shadow(0 0 10.4px rgba(213,85,72,.45))'
};
const UP_ICO = {
  sort: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h13M3 12h9M3 18h5"/></svg>',
  users: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/></svg>',
  grid: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  lock: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a5 5 0 00-5 5v3H6a2 2 0 00-2 2v9a2 2 0 002 2h12a2 2 0 002-2v-9a2 2 0 00-2-2h-1V6a5 5 0 00-5-5zm-3 8V6a3 3 0 116 0v3H9z"/></svg>',
  turbo: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
  snd: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>',
  sndOff: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  search: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  auto: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 019-9 9 9 0 018 5M21 3v5h-5M21 12a9 9 0 01-9 9 9 9 0 01-8-5M3 21v-5h5"/></svg>'
};

const UP = {
  sel: [], add: 0, target: null, multLabel: null, multNum: 0, manual: false,
  pf: '', pu: '', ps: '', mySort: false, catSort: true,
  myPage: 0, catPage: 0, turbo: false,
  phase: 'idle', angle: 180, spin: null, pending: null, lastChance: 0,
  lastTitle: null, lastComment: null
};
function upToIdle() {
  if (UP.phase === 'spin') return;
  UP.phase = 'idle'; UP.pending = null; UP.lastTitle = null; UP.lastComment = null;
}
let UP_CAT = null;

function upCatalog() {
  if (UP_CAT) return UP_CAT;
  const arr = [];
  for (const key in SKINS) {
    const s = SKINS[key]; if (!s || !s.price) continue;
    const buckets = [['nonST', s.price.nonST, false, false], ['ST', s.price.ST, true, false], ['SV', s.price.SV, false, true]];
    for (const b of buckets) {
      const bp = b[1]; if (!bp) continue;
      for (const w in bp) {
        const v = bp[w]; if (v == null || !(v > 0)) continue;
        arr.push({ key: key, wear: w, st: b[2], sv: b[3], val: v });
      }
    }
  }
  arr.sort((a, b) => a.val - b.val);
  UP_CAT = arr;
  return arr;
}
function upSame(a, b) {
  return !!a && !!b && a.key === b.key && a.wear === b.wear && !!a.st === !!b.st && !!a.sv === !!b.sv;
}
function upSelItems() {
  const ids = {};
  UP.sel.forEach(id => { ids[id] = 1; });
  return state.inv.filter(it => ids[it.uid]);
}
function upBetValue() { return upSelItems().reduce((s, it) => s + (it.value || 0), 0); }
function upTargetValue() { return UP.target ? UP.target.val : 0; }
function upMaxAdd() {
  const bet = upBetValue();
  if (!UP.target || !UP.sel.length || UP.sel.length > UP_CFG.maxItems) return 0;
  return Math.max(0, Math.floor(Math.min(UP_CFG.maxBalanceShare * UP.target.val - bet, state.balance)));
}
function upAddUsed() { return Math.min(UP.add, upMaxAdd()); }
function upStake() { return upBetValue() + upAddUsed(); }
function upChance(stake, price) {
  return (!(stake > 0) || !(price > 0)) ? 0 : Math.max(0.01, Math.min(100, stake / price * 100));
}
function upShownChance() {
  if (UP.pending) return UP.pending.chance;
  if (UP.phase === 'win' || UP.phase === 'lose') return UP.lastChance;
  return UP.target ? upChance(upStake(), UP.target.val) : 0;
}
function upCanGo() {
  return UP.phase !== 'spin' && !!UP.target && UP.sel.length > 0 && UP.sel.length <= UP_CFG.maxItems && upShownChance() <= UP_CFG.maxChance && upStake() > 0;
}
function upArcLen(c) { return Math.min(c, 100) / 100 * WHEEL_CIRC; }
function upPointerPct(shown, win) {
  const n = shown / 2;
  if (win) { const s = Math.min(2, n / 2); return 50 - n + s + Math.random() * Math.max(0, shown - s * 2); }
  const r = Math.max(0, 50 - n - 1 - 2);
  const left = Math.random() < 0.5, o = Math.random() * (r > 0 ? r : 0.5);
  return left ? 2 + o : 98 - o;
}
function upChanceLabel(c) {
  return c >= 80 ? 'Очень высокий шанс' : c >= 60 ? 'Высокий шанс' : c >= 40 ? 'Средний шанс' : c >= 20 ? 'Низкий шанс' : 'Очень низкий шанс';
}
function upLuck() {
  const s = state.stats.upLossStreak || 0;
  if (s <= 0) return 0;
  if (s >= UP_RTP.strongBoostAt) return UP_RTP.maxLuckBonus;
  return UP_RTP.maxLuckPenalty + (UP_RTP.maxLuckBonus - UP_RTP.maxLuckPenalty) * (s / UP_RTP.strongBoostAt);
}
function upRtpMul() {
  const b = state.balance;
  if (b < UP_RTP.lowBalance) return UP_RTP.lowRtp;
  if (b <= UP_RTP.targetZoneMax) return UP_RTP.zoneRtp;
  if (b <= UP_RTP.highBalance) return UP_RTP.highRtp;
  return UP_RTP.veryHighRtp;
}
function upBackend(shown) {
  const c0 = shown / 100;
  let m = upRtpMul() * (1 + upLuck());
  m = clamp(m, UP_RTP.minNerfMul, UP_RTP.maxBuffMul);
  let p = clamp(c0 * m, UP_RTP.minBackendChance, UP_RTP.maxBackendChance);
  if (c0 > 0 && c0 < UP_RTP.tinyBorder) p = Math.max(p, UP_RTP.tinyBorder);
  return p;
}
function upRoll(stake, price) {
  const shown = Math.min(upChance(stake, price), UP_CFG.maxChance);
  return { shown: shown, win: Math.random() < upBackend(shown) };
}
function upSetTargetFromMult(mult) {
  const bet = upBetValue();
  if (!(bet > 0)) return null;
  const desired = bet * mult;
  let lo = Math.round(0.95 * desired), hi = Math.round(1.05 * desired);
  if (hi <= lo) hi = lo + 1;
  UP.pf = String(lo); UP.pu = String(hi); UP.ps = '';
  const minPrice = Math.max(lo, bet / (UP_CFG.maxChance / 100));
  let best = null;
  const cat = upCatalog();
  for (let i = 0; i < cat.length; i++) {
    const it = cat[i];
    if (it.val < minPrice) continue;
    if (it.val > hi) break;
    if (!best || Math.abs(it.val - desired) < Math.abs(best.val - desired)) best = it;
  }
  return best;
}
function upResolveTarget() {
  const bet = upBetValue();
  if (!(bet > 0) || !UP.sel.length) { UP.target = null; UP.multLabel = null; UP.multNum = 0; UP.add = 0; return; }
  UP.manual = false;
  const label = UP.multLabel;
  let mult;
  if (label && label !== 'auto') {
    const m = UP_MULT.filter(x => x[0] === label)[0];
    mult = m ? m[1] : (1 + 9 * Math.random());
  } else { mult = 1 + 9 * Math.random(); UP.multLabel = 'auto'; }
  UP.multNum = mult;
  UP.target = upSetTargetFromMult(mult);
  UP.catPage = 0;
  if (!UP.target) toast('В этом диапазоне цен нет предметов', 'err');
}
function upApplyMultiplier(mult, label) {
  if (!(upBetValue() > 0)) { toast('Сначала выберите предметы из инвентаря', 'err'); return; }
  upToIdle();
  UP.multLabel = label; UP.multNum = mult;
  UP.manual = false;
  UP.target = upSetTargetFromMult(mult);
  UP.add = 0; UP.catPage = 0;
  if (!UP.target) toast('В этом диапазоне цен нет предметов', 'err');
}
function upToggleItem(id, v) {
  if (UP.phase === 'spin') return;
  if (UP.sel.indexOf(id) >= 0) UP.sel = UP.sel.filter(x => x !== id);
  else {
    if (UP.sel.length >= UP_CFG.maxItems) { toast('Максимум ' + UP_CFG.maxItems + ' предметов', 'err'); return; }
    UP.sel.push(id);
  }
  sfx.click && sfx.click();
  if (UP.sel.length) {
    upToIdle();
    if (UP.manual && UP.target && upShownChance() <= UP_CFG.maxChance) { /* keep manual target */ }
    else upResolveTarget();
  } else { UP.target = null; UP.multLabel = null; UP.manual = false; UP.add = 0; }
  renderUpgrade(v);
}
function upCardHtml(item, price, opts) {
  opts = opts || {};
  const parts = String(item.key).split(' | ');
  return '<div class="upc ' + rarityClass(item.key) + (opts.sel ? ' is-selected' : '') + (opts.locked ? ' is-locked' : '') + (opts.click ? ' is-click' : '') + '" data-uid="' + (item.uid || '') + '" data-key="' + esc(item.key) + '" data-wear="' + esc(item.wear || '') + '" data-st="' + (item.st ? 1 : 0) + '" data-sv="' + (item.sv ? 1 : 0) + '">'
    + '<img loading="lazy" draggable="false" src="' + img(imgOf(item.key)) + '" ' + onError + '>'
    + '<span class="upc-price">' + money(price) + COIN + '</span>'
    + (item.wear && item.wear !== 'NW' ? '<span class="upc-wear">' + esc(item.wear) + '</span>' : '')
    + (opts.locked ? '<span class="upc-lock">' + UP_ICO.lock + '</span>' : '')
    + '<span class="upc-name"><b>' + esc(parts[0] || item.key) + '</b><span>' + esc(parts[1] || ' ') + '</span></span>'
    + '</div>';
}
function upSlotHtml(items, total, placeholder, glow) {
  if (!items.length) return '<div class="up-slot is-empty">' + esc(placeholder) + '</div>';
  if (items.length > 1) {
    return '<div class="up-slot is-multi"><div class="up-slot-cards">'
      + items.map(it => upCardHtml(it, it.value || 0)).join('')
      + '</div><span class="up-slot-total">' + money(total) + COIN + '</span></div>';
  }
  const it = items[0], parts = String(it.key).split(' | ');
  return '<div class="up-slot ' + rarityClass(it.key) + (glow ? ' is-won' : '') + '">'
    + '<span class="up-slot-price">' + money(total) + COIN + '</span>'
    + (it.wear && it.wear !== 'NW' ? '<span class="up-slot-wear">' + esc(it.wear) + '</span>' : '')
    + '<img draggable="false" src="' + img(imgOf(it.key)) + '" ' + onError + '>'
    + '<div class="up-slot-name"><b>' + esc(parts[0] || it.key) + '</b><span>' + esc(parts[1] || ' ') + '</span></div>'
    + '</div>';
}
function upWheelHtml() {
  const shown = upShownChance();
  const phase = UP.phase === 'win' ? 'win' : UP.phase === 'lose' ? 'lose' : 'idle';
  const col = UP_COLORS[phase];
  const arc = upArcLen(shown);
  const dash = arc + ' ' + (WHEEL_CIRC - arc);
  const off = arc / 2 - WHEEL_CIRC / 4;
  const cx = WHEEL_BL / 2;
  let centerTxt, subTxt;
  if (phase === 'win') { centerTxt = UP.lastTitle || pick(UP_TXT.win); subTxt = UP.lastComment || pick(UP_TXT.cWin); }
  else if (phase === 'lose') { centerTxt = UP.lastTitle || pick(UP_TXT.lose); subTxt = UP.lastComment || pick(UP_TXT.cLose); }
  else { centerTxt = (shown > 0 && UP.target) ? upChanceLabel(shown) : 'Выберите предмет'; subTxt = ''; }
  const ptrTransition = 'none';
  return '<div class="wheel-box"><div class="wheel is-' + phase + '">'
    + '<div class="wheel-plate"></div>'
    + '<svg class="wheel-ring" viewBox="0 0 ' + WHEEL_BL + ' ' + WHEEL_BL + '">'
    +   '<defs><linearGradient id="upGrad" x1="50%" y1="100%" x2="50%" y2="0%"><stop offset="0%" stop-color="' + col[0] + '"/><stop offset="74%" stop-color="' + col[1] + '"/><stop offset="100%" stop-color="' + col[2] + '"/></linearGradient>'
    +   '<filter id="upGlow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="' + col[2] + '" flood-opacity="' + (phase === 'idle' ? '0.55' : '0.45') + '"/></filter></defs>'
    +   '<circle cx="' + cx + '" cy="' + cx + '" r="' + WHEEL_R + '" fill="none" stroke="#00000073" stroke-width="42"/>'
    +   '<g filter="url(#upGlow)"><circle cx="' + cx + '" cy="' + cx + '" r="' + WHEEL_R + '" fill="none" stroke="url(#upGrad)" stroke-width="42" stroke-linecap="butt" stroke-dasharray="' + dash + '" stroke-dashoffset="' + off + '"/></g>'
    + '</svg>'
    + '<span class="wheel-label is-top">100%</span>'
    + '<span class="wheel-label is-left">50%</span>'
    + '<span class="wheel-label is-right">50%</span>'
    + '<span class="wheel-label is-bottom">0%</span>'
    + '<div class="wheel-center"><b>' + shown.toFixed(2) + '%</b><span>' + esc(centerTxt) + '</span>' + (subTxt ? '<span class="wheel-comment">' + esc(subTxt) + '</span>' : '') + '</div>'
    + '<div class="wheel-pointer" id="wheelPtr" style="transform:rotate(' + UP.angle + 'deg)' + (ptrTransition !== 'none' ? ';transition:' + ptrTransition : '') + '"><svg class="wheel-arrow" viewBox="0 0 40 40"><path d="M20 3l9 26-9-6-9 6z" fill="#ffcf6b" stroke="#5c3d00" stroke-width="1.4" stroke-linejoin="round"/></svg></div>'
    + '</div></div>';
}
function upBalanceHtml(cur, maxAdd) {
  return '<div class="up-balance">'
    + '<span class="up-balance-title">' + COIN + 'Добавить баланс</span>'
    + '<div class="up-balance-range"><input type="range" id="upBalRange" min="0" max="' + maxAdd + '" step="1" value="' + cur + '"' + (maxAdd <= 0 ? ' disabled' : '') + '></div>'
    + '<button class="up-balance-max" id="upBalMax"' + (maxAdd <= 0 ? ' disabled' : '') + '>Макс. <span>' + COIN + money(maxAdd) + '</span></button>'
    + '</div>';
}
function upPresetsHtml() {
  return '<div class="up-presets">'
    + '<button class="btn btn-dark' + (UP.multLabel === 'auto' ? ' is-on' : '') + '" id="upAuto" aria-label="Случайный множитель">' + UP_ICO.auto + '</button>'
    + UP_MULT.map(m => '<button class="btn btn-dark' + (UP.multLabel === m[0] ? ' is-on' : '') + '" data-mult="' + esc(m[0]) + '">' + esc(m[0]) + '</button>').join('')
    + '</div>';
}
function upPagerHtml(which, cur, pages) {
  const span = 4;
  let a = Math.max(0, cur - span), b = Math.min(pages - 1, cur + span);
  let h = '<div class="up-pager">';
  h += '<button data-pg="' + which + '" data-i="' + Math.max(0, cur - 1) + '"' + (cur <= 0 ? ' disabled' : '') + '>‹</button>';
  if (a > 0) h += '<button data-pg="' + which + '" data-i="0">1</button>' + (a > 1 ? '<span class="up-pager-dots">…</span>' : '');
  for (let i = a; i <= b; i++) h += '<button data-pg="' + which + '" data-i="' + i + '"' + (i === cur ? ' class="on"' : '') + '>' + (i + 1) + '</button>';
  if (b < pages - 1) h += (b < pages - 2 ? '<span class="up-pager-dots">…</span>' : '') + '<button data-pg="' + which + '" data-i="' + (pages - 1) + '">' + pages + '</button>';
  h += '<button data-pg="' + which + '" data-i="' + Math.min(pages - 1, cur + 1) + '"' + (cur >= pages - 1 ? ' disabled' : '') + '>›</button>';
  return h + '</div>';
}
function upGhosts(shown, pageSize) {
  if (!shown || shown >= pageSize) return '';
  return Array(pageSize - shown).fill('<div class="upc is-ghost"></div>').join('');
}
function renderUpgrade(v) {
  if (!v) return;
  UP.sel = UP.sel.filter(id => state.inv.some(x => x.uid === id)).slice(0, UP_CFG.maxItems);
  const selItems = upSelItems();
  const bet = upBetValue();
  const maxAdd = upMaxAdd();
  if (UP.add > maxAdd) UP.add = maxAdd;
  const spinning = UP.phase === 'spin';
  const done = UP.phase === 'win' || UP.phase === 'lose';
  const shown = upShownChance();
  const overMax = !!UP.target && !done && shown > UP_CFG.maxChance;

  let myList = state.inv.slice();
  if (UP.mySort) myList.sort((a, b) => (b.value || 0) - (a.value || 0));
  const myPages = Math.max(1, Math.ceil(myList.length / UP_PAGE));
  UP.myPage = clamp(UP.myPage, 0, myPages - 1);
  const myShown = myList.slice(UP.myPage * UP_PAGE, (UP.myPage + 1) * UP_PAGE);

  const lo = parseFloat(UP.pf) || 0;
  const hi = UP.pu === '' || UP.pu == null ? Infinity : (parseFloat(UP.pu) || Infinity);
  const q = UP.ps.trim().toLowerCase();
  let cat = upCatalog().filter(it => it.val >= lo && it.val <= hi && (!q || it.key.toLowerCase().indexOf(q) >= 0));
  if (!UP.catSort) cat = cat.slice().reverse();
  const minTarget = upStake() > 0 ? upStake() / (UP_CFG.maxChance / 100) : 0;
  const catPages = Math.max(1, Math.ceil(cat.length / UP_PAGE));
  UP.catPage = clamp(UP.catPage, 0, catPages - 1);
  const catShown = cat.slice(UP.catPage * UP_PAGE, (UP.catPage + 1) * UP_PAGE);

  const selTitle = !selItems.length
    ? 'Выберите предметы и/или баланс для использования'
    : 'Выбран' + (selItems.length === 1 ? '' : 'о') + ' ' + selItems.length + ' предмет' + (selItems.length === 1 ? '' : (selItems.length < 5 ? 'а' : 'ов'));

  const html = '<div class="page"><div class="upgrade">'
    + '<div class="up-tools">'
    +   '<button class="icon-btn' + (UP.turbo ? ' is-on' : '') + '" id="upTurbo" title="Турбо-режим"' + (spinning ? ' disabled' : '') + '>' + UP_ICO.turbo + '</button>'
    +   '<button class="icon-btn" id="upSound" title="Звук">' + (state.sound ? UP_ICO.snd : UP_ICO.sndOff) + '</button>'
    + '</div>'
    + '<div class="up-top">'
    +   '<div class="up-col">'
    +     '<div class="up-col-head"><span>' + esc(selTitle) + '</span><button class="btn btn-dark" id="upClearSel"' + (spinning ? ' disabled' : '') + '>Очистить</button></div>'
    +     upSlotHtml(selItems, bet, 'Выбранные предметы появятся здесь', false)
    +     upBalanceHtml(upAddUsed(), maxAdd)
    +   '</div>'
    +   '<div class="up-mid">'
    +     upWheelHtml()
    +     (overMax ? '<div class="up-chance-warn">Шанс не может превышать ' + UP_CFG.maxChance + '% — выберите предмет дороже</div>' : '')
    +     '<button class="btn btn-green up-go" id="upGo"' + (upCanGo() ? '' : ' disabled') + '>' + (spinning ? 'Апгрейд...' : 'Апгрейд') + '</button>'
    +   '</div>'
    +   '<div class="up-col">'
    +     '<div class="up-col-head"><span>Предмет для апгрейда</span><button class="btn btn-dark" id="upClearTgt"' + (spinning ? ' disabled' : '') + '>Очистить</button></div>'
    +     upSlotHtml(UP.target ? [UP.target] : [], UP.target ? UP.target.val : 0, 'Выберите предмет из списка ниже', UP.phase === 'win')
    +     upPresetsHtml()
    +   '</div>'
    + '</div>'
    + '<div class="up-lists">'
    +   '<div class="up-list">'
    +     '<div class="up-list-head"><span>' + UP_ICO.users + 'Мои предметы</span>'
    +       (state.inv.length ? '<button class="icon-btn' + (UP.mySort ? ' is-on' : '') + '" id="upMySort" title="Сортировка по цене">' + UP_ICO.sort + '</button>' : '')
    +     '</div>'
    +     (state.inv.length === 0
          ? '<div class="up-empty">Ваш инвентарь пуст<button class="btn btn-green" data-go="cases">Открой первый кейс</button></div>'
          : '<div class="up-grid" id="upMyGrid">' + myShown.map(it => upCardHtml(it, it.value || 0, { sel: UP.sel.indexOf(it.uid) >= 0, click: true })).join('') + upGhosts(myShown.length, UP_PAGE) + '</div>'
            + (myPages > 1 ? upPagerHtml('my', UP.myPage, myPages) : ''))
    +   '</div>'
    +   '<div class="up-list">'
    +     '<div class="up-list-head"><span>' + UP_ICO.grid + 'Выбрать предмет</span></div>'
    +     '<div class="up-filters">'
    +       '<button class="icon-btn' + (UP.catSort ? ' is-on' : '') + '" id="upCatSort" title="Сортировка по цене">' + UP_ICO.sort + '</button>'
    +       '<div class="up-price"><input inputmode="numeric" maxlength="8" id="upPF" placeholder="От" value="' + esc(UP.pf) + '"><span>—</span><input inputmode="numeric" maxlength="8" id="upPU" placeholder="До" value="' + esc(UP.pu) + '"></div>'
    +       '<label class="up-search">' + UP_ICO.search + '<input maxlength="40" id="upPS" placeholder="Поиск..." value="' + esc(UP.ps) + '"></label>'
    +     '</div>'
    +     (catShown.length === 0
          ? '<div class="up-empty">Ничего не найдено</div>'
          : '<div class="up-grid" id="upCatGrid">' + catShown.map(it => upCardHtml(it, it.val, { sel: upSame(it, UP.target), locked: it.val < minTarget, click: true })).join('') + upGhosts(catShown.length, UP_PAGE) + '</div>'
            + (catPages > 1 ? upPagerHtml('cat', UP.catPage, catPages) : ''))
    +   '</div>'
    + '</div>'
    + '</div></div>';
  v.innerHTML = html;
  attachUpgrade(v);
}
function attachUpgrade(v) {
  const click = (sel, fn) => { const el = $(sel, v); if (el) el.onclick = fn; };
  click('#upTurbo', () => { if (UP.phase === 'spin') return; UP.turbo = !UP.turbo; sfx.click && sfx.click(); renderUpgrade(v); });
  click('#upSound', () => { state.sound = !state.sound; save(); renderUpgrade(v); });
  click('#upClearSel', () => { if (UP.phase === 'spin') return; UP.sel = []; UP.target = null; UP.multLabel = null; UP.manual = false; UP.add = 0; upToIdle(); renderUpgrade(v); });
  click('#upClearTgt', () => { if (UP.phase === 'spin') return; UP.target = null; UP.multLabel = null; UP.manual = false; UP.pf = ''; UP.pu = ''; UP.ps = ''; upToIdle(); renderUpgrade(v); });
  click('#upAuto', () => { if (UP.phase === 'spin') return; upApplyMultiplier(1 + 9 * Math.random(), 'auto'); renderUpgrade(v); });
  click('#upBalMax', () => { if (UP.phase === 'spin') return; UP.add = upMaxAdd(); renderUpgrade(v); });
  click('#upGo', () => upGo(v));
  click('#upMySort', () => { UP.mySort = !UP.mySort; UP.myPage = 0; renderUpgrade(v); });
  click('#upCatSort', () => { UP.catSort = !UP.catSort; UP.catPage = 0; renderUpgrade(v); });
  const go = $('[data-go]', v); if (go) go.onclick = () => { location.hash = '#/' + go.dataset.go; };

  $$('[data-mult]', v).forEach(b => b.onclick = () => {
    if (UP.phase === 'spin') return;
    const m = UP_MULT.filter(x => x[0] === b.dataset.mult)[0];
    if (m) { upApplyMultiplier(m[1], m[0]); renderUpgrade(v); }
  });
  const rng = $('#upBalRange', v);
  if (rng) rng.oninput = e => { UP.add = clamp(parseInt(e.target.value, 10) || 0, 0, upMaxAdd()); renderUpgrade(v); };

  const mg = $('#upMyGrid', v);
  if (mg) mg.onclick = e => { const c = e.target.closest('.upc.is-click'); if (c && c.dataset.uid) upToggleItem(c.dataset.uid, v); };
  const cg = $('#upCatGrid', v);
  if (cg) cg.onclick = e => {
    if (UP.phase === 'spin') return;
    const c = e.target.closest('.upc.is-click'); if (!c) return;
    const key = c.dataset.key, wear = c.dataset.wear, st = c.dataset.st === '1', sv = c.dataset.sv === '1';
    if (c.classList.contains('is-locked')) { toast('Шанс выше ' + UP_CFG.maxChance + '% — выберите предмет дороже', 'err'); return; }
    const found = upCatalog().filter(x => x.key === key && x.wear === wear && !!x.st === st && !!x.sv === sv)[0];
    if (!found) return;
    upToIdle();
    UP.target = { key: found.key, wear: found.wear, st: found.st, sv: found.sv, val: found.val };
    UP.multLabel = null; UP.multNum = 0; UP.manual = true;
    sfx.click && sfx.click();
    renderUpgrade(v);
  };
  const pf = $('#upPF', v); if (pf) pf.oninput = e => { UP.pf = e.target.value.replace(/[^\d]/g, ''); UP.catPage = 0; debounceUp(v, e.target, 'pf'); };
  const pu = $('#upPU', v); if (pu) pu.oninput = e => { UP.pu = e.target.value.replace(/[^\d]/g, ''); UP.catPage = 0; debounceUp(v, e.target, 'pu'); };
  const ps = $('#upPS', v); if (ps) ps.oninput = e => { UP.ps = e.target.value; UP.catPage = 0; debounceUp(v, e.target, 'ps'); };
  const pgr = $('.up-pager', v);
  if (pgr) pgr.onclick = e => { const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return; if (b.dataset.pg === 'my') UP.myPage = parseInt(b.dataset.i, 10) || 0; else UP.catPage = parseInt(b.dataset.i, 10) || 0; renderUpgrade(v); };
}
let upDeb = null;
function debounceUp(v, input, field) {
  clearTimeout(upDeb);
  upDeb = setTimeout(() => {
    const focused = document.activeElement;
    renderUpgrade(v);
    const el = $('#' + (field === 'pf' ? 'upPF' : field === 'pu' ? 'upPU' : 'upPS'), v);
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
    else if (focused) focused.blur();
  }, 260);
}
let upTweenId = 0;
function upSpinTween(fromAngle, toAngle, duration) {
  const id = ++upTweenId;
  const start = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 4);
  const tick = now => {
    if (id !== upTweenId) return;
    const t = Math.min(1, (now - start) / duration);
    const a = fromAngle + (toAngle - fromAngle) * ease(t);
    const ptr = document.getElementById('wheelPtr');
    if (ptr) { ptr.style.transition = 'none'; ptr.style.transform = 'rotate(' + a + 'deg)'; }
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function upGo(v) {
  if (UP.phase === 'spin' || !upCanGo()) {
    if (UP.target && upShownChance() > UP_CFG.maxChance) toast('Шанс не может превышать ' + UP_CFG.maxChance + '%', 'err');
    return;
  }
  const sel = upSelItems();
  const stake = upStake();
  const roll = upRoll(stake, UP.target.val);
  UP.pending = { items: sel, stake: stake, add: upAddUsed(), target: UP.target, chance: roll.shown, win: roll.win };
  const cfg = UP.turbo ? UP_SPIN.turbo : UP_SPIN.normal;
  const pct = upPointerPct(roll.shown, roll.win);
  const targetAngle = pct / 100 * 360;
  const delta = ((targetAngle - UP.angle) % 360 + 360) % 360;
  const fromAngle = UP.angle;
  const newAngle = UP.angle + 360 * cfg.turns + delta;

  UP.phase = 'spin'; UP.spin = cfg;
  renderUpgrade(v);
  UP.angle = newAngle;
  sfx.upSpin && sfx.upSpin();
  upSpinTween(fromAngle, newAngle, cfg.duration);

  setTimeout(() => {
    UP.lastChance = roll.shown;
    upApplyResult(roll.win);
    UP.pending = null; UP.spin = null;
    UP.phase = roll.win ? 'win' : 'lose';
    UP.lastTitle = roll.win ? pick(UP_TXT.win) : pick(UP_TXT.lose);
    UP.lastComment = roll.win ? pick(UP_TXT.cWin) : pick(UP_TXT.cLose);
    UP.sel = []; UP.add = 0;
    UP.angle = ((UP.angle % 360) + 360) % 360;
    const onPage = (location.hash || '').replace('#', '') === '/upgrade';
    if (roll.win) { sfx.bigwin(); burst(110, [rarity(UP.target.key).color, '#44c987', '#ffd700']); }
    else sfx.lose();
    if (onPage) renderUpgrade(v);
  }, cfg.duration + 80);
}
function upApplyResult(win) {
  const p = UP.pending; if (!p) return;
  const ids = {}; p.items.forEach(i => { ids[i.uid] = 1; });
  state.inv = state.inv.filter(i => !ids[i.uid]);
  state.balance -= p.add;
  state.stats.upgraded = (state.stats.upgraded || 0) + 1;
  if (win) {
    const t = p.target;
    state.inv.push({ uid: uid(), key: t.key, wear: t.wear, st: t.st, sv: t.sv, value: t.val, t: Date.now() });
    state.stats.upWon = (state.stats.upWon || 0) + 1;
    state.stats.upLossStreak = 0;
    state.stats.earned += t.val;
    if (!state.stats.best || t.val > state.stats.best.value) state.stats.best = { key: t.key, value: t.val };
    liveDropAdd(t.key, t.wear, t.val);
  } else {
    state.stats.upLossStreak = (state.stats.upLossStreak || 0) + 1;
  }
  save(); syncBalance();
}

/* ============================================================
   PROFILE
   ============================================================ */
function inventoryValue() { return state.inv.reduce((s, it) => s + (it.value || 0), 0); }
function achievements() {
  const inv = state.inv.length, opened = state.stats.opened, best = state.stats.best ? state.stats.best.value : 0;
  return [
    { id: 'first', icon: '🎁', t: 'Первый кейс', d: 'Откройте свой первый кейс', done: opened >= 1 },
    { id: 'ten', icon: '📦', t: 'Коллекционер', d: 'Откройте 10 кейсов', done: opened >= 10 },
    { id: 'fifty', icon: '💰', t: 'Азартный', d: 'Откройте 50 кейсов', done: opened >= 50 },
    { id: 'inv10', icon: '🎉', t: 'Богач', d: '10 предметов в инвентаре', done: inv >= 10 },
    { id: 'best1k', icon: '💎', t: 'Ценный улов', d: 'Получите предмет дороже 1 000 ₽', done: best >= 1000 },
    { id: 'best10k', icon: '🎰', t: 'Джекпот', d: 'Получите предмет дороже 10 000 ₽', done: best >= 10000 },
    { id: 'upg', icon: '⬆️', t: 'Апгрейдер', d: 'Сделайте 5 апгрейдов', done: state.stats.upgraded >= 5 },
    { id: 'upgwin', icon: '🏆', t: 'Удачный апгрейд', d: 'Выиграйте апгрейд', done: state.stats.upWon >= 1 }
  ];
}
function renderProfile(v) {
  const best = state.stats.best;
  v.innerHTML =
    '<div class="page"><div class="profile">'
    + '<div class="profile-top">'
    +   '<div class="profile-avatar"><img src="assets/logo.png" style="width:100%;height:100%;object-fit:cover"></div>'
    +   '<div class="profile-user">'
    +     '<div class="profile-user-name">Гость</div>'
    +     '<div class="profile-user-sub">Гостевой режим: прогресс хранится на этом устройстве</div>'
    +     '<div class="profile-balance"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v10M9 9.5a3 3 0 013-1.5c1.6 0 3 .8 3 2s-1.4 2-3 2-3 .8-3 2 1.4 2 3 2a3 3 0 003-1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>' + money(state.balance) + '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="profile-counters">'
    +   '<div class="profile-card"><div class="profile-label">Баланс</div><div class="big">' + money(state.balance) + ' ₽</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Стоимость инвентаря</div><div class="big">' + money(inventoryValue()) + ' ₽</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Открыто кейсов</div><div class="big">' + state.stats.opened + '</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Потрачено</div><div class="big">' + money(state.stats.spent) + ' ₽</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Заработано</div><div class="big">' + money(state.stats.earned) + ' ₽</div></div>'
    +   '<div class="profile-card"><div class="profile-label">Сделано апгрейдов</div><div class="big">' + state.stats.upgraded + '</div></div>'
    + '</div>'
    + (best
        ? '<div class="section-h">Лучший дроп</div><div class="profile-best ' + rarityClass(best.key) + '"><div class="profile-best-pic"><img src="' + img(imgOf(best.key)) + '" ' + onError + '></div><div class="profile-best-info"><div class="nm">' + esc(best.key) + '</div><div class="pr">' + money(best.value) + ' ₽</div></div></div>'
        : '')
    + '<div class="section-h">Скины <span class="profile-skins-sum">' + state.inv.length + ' шт · ' + money(inventoryValue()) + ' ₽</span></div>'
    + (state.inv.length
        ? '<div class="profile-skins">' + state.inv.map(it => itemCard(it.key, it.wear, it.st, it.sv, { hideWear: true })).join('') + '</div>'
        : '<div class="empty"><b>Скинов пока нет</b><p>Откройте кейс, чтобы получить первый скин</p></div>')
    + '<div style="margin-top:3rem"><button class="btn btn-dark" id="resetBtn">Сбросить прогресс</button></div>'
    + '</div></div>';
  $('#resetBtn').onclick = () => {
    const m = modal(
      '<h2 style="font-family:var(--head);font-size:2.4rem;text-transform:uppercase;margin-bottom:1rem">Сбросить прогресс?</h2>'
      + '<div class="m-sub">Баланс, инвентарь и статистика будут удалены.</div>'
      + '<div style="display:flex;gap:1rem;margin-top:2rem"><button class="btn btn-dark btn-block" data-close>Отмена</button><button class="btn btn-green btn-block" id="doReset">Сбросить</button></div>');
    m.querySelector('#doReset').onclick = () => {
      state = { balance: 10000, inv: [], stats: { opened: 0, spent: 0, earned: 0, upgraded: 0, upWon: 0, best: null }, sound: state.sound };
      save(); syncBalance(); toast('Прогресс сброшен'); m.close(); location.hash = '#/cases';
    };
  };
}

/* ============================================================
   MINI GAMES
   ============================================================ */
const GAMES = [
  { slug: 'crash', name: 'Краш', desc: 'Забери до разрыва', ready: true },
  { slug: 'slots', name: 'Слоты', desc: 'Три барабана', ready: true },
  { slug: 'mines', name: 'Мины', desc: 'Копай и забирай', ready: true },
  { slug: 'coin', name: 'Орёл и решка', desc: 'Ставка на монету', ready: true }
];
const GAME_ART = {
  crash: '<defs><linearGradient id="gArt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#44c987" stop-opacity=".55"/><stop offset="1" stop-color="#44c987" stop-opacity="0"/></linearGradient></defs><path d="M0 176 L34 168 L60 172 L84 150 L104 156 L126 120 L146 128 L168 84 L192 96 L214 44 L238 54 L260 10 L260 188 L0 188 Z" fill="url(#gArt)"/><path d="M0 176 L34 168 L60 172 L84 150 L104 156 L126 120 L146 128 L168 84 L192 96 L214 44 L238 54 L260 10" fill="none" stroke="#44c987" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="260" cy="10" r="8" fill="#44c987"/>',
  slots: '<rect x="26" y="44" width="60" height="100" rx="6" fill="#1a2a22" stroke="#44c987" stroke-width="3"/><rect x="100" y="44" width="60" height="100" rx="6" fill="#1a2a22" stroke="#44c987" stroke-width="3"/><rect x="174" y="44" width="60" height="100" rx="6" fill="#1a2a22" stroke="#44c987" stroke-width="3"/><path d="M40 78h32M40 100h32M114 78h32M114 100h32M188 78h32M188 100h32" stroke="#44c987" stroke-width="7" stroke-linecap="round" opacity=".85"/>',
  mines: '<g stroke="#44c987" stroke-width="3" fill="#152019"><rect x="42" y="34" width="42" height="42" rx="5"/><rect x="109" y="34" width="42" height="42" rx="5"/><rect x="176" y="34" width="42" height="42" rx="5"/><rect x="42" y="96" width="42" height="42" rx="5"/><rect x="109" y="96" width="42" height="42" rx="5"/><rect x="176" y="96" width="42" height="42" rx="5"/></g><path d="M130 105l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#d55548"/><circle cx="63" cy="55" r="9" fill="#44c987"/><circle cx="230" cy="55" r="9" fill="#44c987"/>',
  coin: '<circle cx="130" cy="94" r="58" fill="#1a2a22" stroke="#ffa800" stroke-width="5"/><circle cx="130" cy="94" r="42" fill="none" stroke="#ffa800" stroke-width="2.5" opacity=".55"/><path d="M130 66v56M116 76a17 17 0 0117-9c10 0 18 6 18 15s-8 15-18 15-18 6-18 15 8 15 18 15a17 17 0 0017-9" fill="none" stroke="#ffa800" stroke-width="7" stroke-linecap="round"/>'
};
function gameArt(kind) {
  return '<svg viewBox="0 0 260 188" class="game-art-svg">' + (GAME_ART[kind] || '') + '</svg>';
}
function renderGames(v) {
  v.innerHTML =
    '<div class="page games">'
    + '<div class="games-head"><h1>Мини игры</h1></div>'
    + '<div class="games-grid">'
    + GAMES.map(g =>
        '<button class="game-card is-ready" onclick="location.hash=\'#/games/' + g.slug + '\'">'
        + '<span class="game-art">' + gameArt(g.slug) + '</span>'
        + '<span class="game-card-info"><span class="game-card-name">' + esc(g.name) + '</span></span>'
        + '<span class="game-card-go">Играть</span></button>'
      ).join('')
    + '</div></div>';
}

/* ---------------- crash game ---------------- */
let cr = null;
const crR = x => Math.round(x * 100) / 100;
const crTxt = x => crR(x).toFixed(2);
function crashPoint() {
  const t = Math.random();
  if (t < 0.04) return 10 + 18 * Math.random();
  if (t < 0.14) return 4 + 4.5 * Math.random();
  if (t < 0.48) return 2 + 2.8 * Math.random();
  if (t < 0.82) return 1.2 + 1.1 * Math.random();
  return 1.03 + 0.2 * Math.random();
}
const CR_NAMES = ['Kaban', 'Sniker', 'ProGamer', 'Дядя Витя', 'Snob228', 'M4X', 'Товарищ', 'Cuba', 'Zeta', 'Rush', 'B1T', 'Нагибатор', 'Легион', 'Fenix'];
function crashStop() {
  if (!cr) return;
  cr.stopped = true;
  if (cr.raf) cancelAnimationFrame(cr.raf);
  if (cr.timer) clearTimeout(cr.timer);
  cr = null;
}
function crashStart() {
  crashStop();
  if (!$('#crStage')) return;
  cr = { stopped: false, raf: 0, timer: 0, phase: 'waiting', crashAt: 2, runningMs: 4000, t0: 0, elapsed: 0, hist: [], players: [], bet: null, amount: 100, target: 2, lastRow: 0 };
  crashGrid(10000);
  crashRenderHist();
  crashRenderPlayers(true);
  crashAct();
  crashWaiting();
}
function crashCenter(txt, kind) {
  const b = $('#crMult'), s = $('#crState'), st = $('#crStage');
  if (b) b.textContent = txt;
  if (st) { st.classList.remove('is-run', 'is-crash', 'is-wait'); st.classList.add('is-' + kind); }
  return s;
}
function crashSub(txt) { const s = $('#crState'); if (s) s.textContent = txt; }

function crashWaiting() {
  if (!cr || cr.stopped) return;
  cr.phase = 'waiting';
  cr.crashAt = crashPoint();
  cr.bet = null;
  crashCenter('×—', 'wait');
  crashSub('Ставки принимаются');
  crashGraphReset();
  crashRenderPlayers(true);
  crashAct();
  cr.timer = setTimeout(() => {
    if (!cr || cr.stopped) return;
    cr.phase = 'countdown'; cr.t0 = performance.now();
    crashCountdown();
  }, 900 + Math.floor(Math.random() * 1000));
}
function crashCountdown() {
  if (!cr || cr.stopped || cr.phase !== 'countdown') return;
  const left = 15000 - (performance.now() - cr.t0);
  if (left <= 0) { crashRun(); return; }
  crashCenter((left / 1000).toFixed(1), 'wait');
  crashSub('Ставки закроются через…');
  crashAct();
  cr.raf = requestAnimationFrame(crashCountdown);
}
function crashRun() {
  if (!cr || cr.stopped) return;
  cr.phase = 'running';
  cr.runningMs = 3600 + Math.min(5200, Math.round(cr.crashAt * 420));
  cr.t0 = performance.now();
  crashGrid(cr.runningMs);
  crashCenter('×1.00', 'run');
  crashSub('Заберите выигрыш!');
  crashAct();
  cr.raf = requestAnimationFrame(crashRunning);
}
function crashRunning() {
  if (!cr || cr.stopped || cr.phase !== 'running') return;
  const el = performance.now() - cr.t0;
  const t = Math.min(1, el / cr.runningMs);
  const m = t <= 0 ? 1 : crR(Math.exp(Math.log(cr.crashAt) * t));
  cr.elapsed = el;
  crashCenter('×' + crTxt(m), 'run');
  crashGraph(el, cr.runningMs, cr.crashAt);
  if (cr.bet && !cr.bet.cashed && m >= cr.bet.target) crashCashout(m, true);
  const now = performance.now();
  if (now - cr.lastRow > 120) { cr.lastRow = now; crashRenderPlayers(false, m); }
  crashAct(m);
  if (t >= 1) { crashEnd(m); return; }
  cr.raf = requestAnimationFrame(crashRunning);
}
function crashEnd(m) {
  if (!cr || cr.stopped) return;
  cr.phase = 'crashed';
  const won = cr.bet && cr.bet.cashed;
  if (cr.bet && !cr.bet.cashed) { sfx.lose(); }
  state.stats.crashPlayed = (state.stats.crashPlayed || 0) + 1;
  if (m > (state.stats.crashBest || 0)) state.stats.crashBest = crR(m);
  save();
  crashCenter('×' + crTxt(m), 'crash');
  crashSub(won ? 'Вы забрали ' + money(cr.bet.win) + ' ₽' : (cr.bet ? 'Ставка сгорела' : 'Разрыв!'));
  crashRenderPlayers(false, m);
  crashAct();
  cr.hist.unshift(cr.crashAt);
  if (cr.hist.length > 10) cr.hist.length = 10;
  crashRenderHist();
  if (won) { sfx.win(); burst(40, ['#44c987', '#ffd700']); }
  cr.timer = setTimeout(() => { if (cr && !cr.stopped) crashWaiting(); }, 1200);
}
function crashGrid(ms) {
  const g = $('#crGrid'); if (!g) return;
  const W = 649, H = 350, secs = Math.max(1, Math.ceil(ms / 1000));
  let s = '';
  for (let i = 0; i <= secs; i++) {
    const x = (i / secs) * W;
    s += '<line x1="' + x.toFixed(1) + '" y1="0" x2="' + x.toFixed(1) + '" y2="' + H + '" class="cr-gl"/>';
    if (i) s += '<text x="' + x.toFixed(1) + '" y="' + (H - 8) + '" class="cr-axis" text-anchor="middle">' + i + 'с</text>';
  }
  for (let i = 0; i <= 4; i++) {
    const y = (i / 4) * H;
    s += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" class="cr-gl"/>';
  }
  g.innerHTML = s;
}
function crashGraphReset() {
  const l = $('#crLine'), f = $('#crFill'), d = $('#crDot');
  if (l) l.setAttribute('d', '');
  if (f) f.setAttribute('d', '');
  if (d) d.setAttribute('opacity', '0');
}
function crashGraph(el, ms, crashAt) {
  const W = 649, H = 350, N = 48, yMax = Math.max(crashAt, 1.05);
  const xn = ms > 0 ? (el / ms) * W : 0;
  let d = '', x = 0, y = H - 10;
  for (let i = 0; i <= N; i++) {
    const frac = i / N;
    const tf = ms > 0 ? (frac * el) / ms : 0;
    const mm = tf <= 0 ? 1 : crR(Math.exp(Math.log(crashAt) * tf));
    x = frac * xn;
    y = H - ((mm - 1) / (yMax - 1)) * (H - 20) - 10;
    d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  const l = $('#crLine'), f = $('#crFill'), dot = $('#crDot');
  if (l) l.setAttribute('d', d);
  if (f) f.setAttribute('d', d + ' L' + xn.toFixed(1) + ' ' + H + ' L0 ' + H + ' Z');
  if (dot) { dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); dot.setAttribute('opacity', '1'); }
}
function crashRenderHist() {
  const box = $('#crHist'); if (!box || !cr) return;
  if (!cr.hist.length) { box.innerHTML = '<span class="cr-hist-empty">История раундов появится здесь</span>'; return; }
  box.innerHTML = cr.hist.map(h => {
    let cls = 'is-red';
    if (h >= 10) cls = 'is-jack';
    else if (h >= 2) cls = 'is-green';
    else if (h >= 1.2) cls = 'is-yellow';
    return '<span class="cr-chip ' + cls + '">' + crTxt(h) + '</span>';
  }).join('');
}
function crashRenderPlayers(reset, m) {
  const box = $('#crPlayers'); if (!box || !cr) return;
  if (reset || !cr.players.length) {
    const n = 4 + Math.floor(Math.random() * 5);
    const used = {};
    cr.players = [];
    for (let i = 0; i < n; i++) {
      let nm = pick(CR_NAMES); let g = 0;
      while (used[nm] && g++ < 6) nm = pick(CR_NAMES);
      used[nm] = 1;
      cr.players.push({
        name: nm, stake: pick([50, 100, 200, 500, 1000, 2000, 5000]),
        target: Math.random() < 0.45 ? crR(10 + Math.random() * 40) : crR(1.3 + Math.random() * 3),
        cashed: false, win: 0, out: Math.random() < 0.25
      });
    }
  }
  const live = (m != null && cr.phase === 'running') ? m : 0;
  cr.players.forEach(p => {
    if (cr.phase === 'running' && !p.cashed && !p.out && live >= p.target) { p.cashed = true; p.win = crR(p.stake * p.target); }
    if (cr.phase === 'crashed' && !p.cashed) p.out = true;
  });
  const bank = (cr.bet ? cr.bet.stake : 0) + cr.players.filter(p => !p.out).reduce((s, p) => s + p.stake, 0);
  const el = $('#crBank');
  if (el) el.textContent = money(bank) + ' ₽';
  const cnt = $('#crCount');
  if (cnt) cnt.textContent = cr.players.filter(p => !p.out).length + (cr.bet ? 1 : 0);
  const rows = [];
  if (cr.bet) {
    const st = cr.bet.cashed ? 'won' : (cr.phase === 'crashed' ? 'lose' : 'wait');
    rows.push('<div class="cr-row is-me is-' + st + '"><b>Вы</b><span>' + money(cr.bet.stake) + ' ₽</span>'
      + '<i>' + (cr.bet.cashed ? '+' + money(cr.bet.win) + ' ₽' : (st === 'lose' ? '0,00' : 'в игре')) + '</i></div>');
  }
  cr.players.forEach(p => {
    const st = p.cashed ? 'won' : (p.out ? 'lose' : (cr.phase === 'running' ? 'wait' : 'wait'));
    rows.push('<div class="cr-row is-' + st + '"><b>' + esc(p.name) + '</b><span>' + money(p.stake) + ' ₽</span>'
      + '<i>' + (p.cashed ? '+' + money(p.win) + ' ₽' : (st === 'lose' ? '0,00' : (cr.phase === 'running' ? money(crR(p.stake * live)) + ' ₽' : 'ждёт'))) + '</i></div>');
  });
  box.innerHTML = rows.join('');
}
function crashAct(mult) {
  const b = $('#crAct'); if (!b || !cr) return;
  const info = $('#crInfo');
  if (cr.phase === 'waiting' || cr.phase === 'countdown') {
    if (cr.bet) { b.textContent = 'Отменить ставку'; b.disabled = false; b.className = 'btn btn-dark cr-act'; if (info) info.innerHTML = 'Ставка <b>' + money(cr.bet.stake) + ' ₽</b> · авто-забор ×' + crTxt(cr.bet.target); }
    else {
      b.textContent = 'Поставить ' + money(cr.amount) + ' ₽';
      b.disabled = cr.amount < 10 || state.balance < cr.amount;
      b.className = 'btn btn-green cr-act';
      if (info) info.innerHTML = state.balance < cr.amount ? '<span class="is-bad">Недостаточно средств</span>' : 'До конца раунда — <b>' + (cr.phase === 'countdown' ? 'секунды' : 'минуты') + '</b>';
    }
  } else if (cr.phase === 'running') {
    if (cr.bet && !cr.bet.cashed) {
      const m = mult != null ? mult : 1;
      b.textContent = 'Забрать ' + money(crR(cr.bet.stake * m)) + ' ₽';
      b.disabled = false; b.className = 'btn btn-green cr-act';
      if (info) info.innerHTML = 'Ставка ×' + crTxt(cr.bet.target) + ' — или заберите раньше';
    } else {
      b.textContent = cr.bet ? 'Забрано' : 'Раунд идёт';
      b.disabled = true; b.className = 'btn btn-dark cr-act';
      if (info) info.innerHTML = cr.bet ? 'Вы уже забрали <b>' + money(cr.bet.win) + ' ₽</b>' : 'Ставка возможна до старта раунда';
    }
  } else {
    b.textContent = 'Разрыв ×' + crTxt(cr.crashAt);
    b.disabled = true; b.className = 'btn btn-dark cr-act';
    if (info) info.innerHTML = 'Следующий раунд скоро…';
  }
}
function crashBetInput() {
  if (!cr) return;
  const a = $('#crAmount'), t = $('#crTarget');
  cr.amount = clamp(parseInt(a.value, 10) || 0, 0, Math.min(state.balance, 1000000));
  cr.target = clamp(parseFloat(t.value) || 2, 1.1, 1000);
  crashAct();
}
function crashClick() {
  if (!cr || !$('#crAct')) return;
  if (cr.phase === 'waiting' || cr.phase === 'countdown') {
    if (cr.bet) {
      state.balance += cr.bet.stake;
      cr.bet = null;
      toast('Ставка отменена');
      syncBalance(); save(); sfx.click();
    } else {
      crashBetInput();
      const a = cr.amount;
      if (a < 10) { toast('Минимальная ставка — 10 ₽', 'warn'); return; }
      if (state.balance < a) { toast('Недостаточно средств', 'err'); return; }
      state.balance -= a;
      cr.bet = { stake: a, target: cr.target, cashed: false, win: 0 };
      sfx.click();
      toast('Ставка ' + money(a) + ' ₽ принята');
      syncBalance(); save();
    }
    crashRenderPlayers(false);
    crashAct();
    updateLacksAll();
    return;
  }
  if (cr.phase === 'running' && cr.bet && !cr.bet.cashed) {
    const el = performance.now() - cr.t0;
    const m = el <= 0 ? 1 : crR(Math.exp(Math.log(cr.crashAt) * Math.min(1, el / cr.runningMs)));
    crashCashout(m, false);
  }
}
function crashCashout(m, auto) {
  if (!cr || !cr.bet || cr.bet.cashed) return;
  const win = crR(cr.bet.stake * m);
  cr.bet.cashed = true; cr.bet.win = win;
  state.balance += win;
  state.stats.earned += win;
  state.stats.crashEarned = (state.stats.crashEarned || 0) + win;
  syncBalance(); save();
  if (m > (state.stats.crashBest || 0)) { state.stats.crashBest = crR(m); save(); }
  if (auto) toast('Авто-забор ×' + crTxt(m) + ' · +' + money(win) + ' ₽');
  sfx.win(); burst(40, ['#44c987', '#ffd700']);
  crashRenderPlayers(false, m);
  crashAct(m);
  updateLacksAll();
}
function crashBind() {
  const amt = $('#crAmount'), tgt = $('#crTarget'), act = $('#crAct');
  if (!amt || !tgt || !act) return;
  amt.addEventListener('input', () => { cr.amount = clamp(parseInt(amt.value, 10) || 0, 0, Math.min(state.balance, 1000000)); crashAct(); });
  tgt.addEventListener('input', () => { cr.target = clamp(parseFloat(tgt.value) || 2, 1.1, 1000); });
  act.onclick = crashClick;
  $$('[data-crq]').forEach(b => b.onclick = () => {
    const q = b.dataset.crq;
    amt.value = q === 'max' ? Math.min(state.balance, 1000000) : Math.min(state.balance, parseInt(q, 10));
    crashBetInput(); sfx.click();
  });
  $$('[data-crt]').forEach(b => b.onclick = () => {
    tgt.value = b.dataset.crt; crashBetInput(); sfx.click();
  });
  const setAmt = d => { amt.value = clamp((parseInt(amt.value, 10) || 0) + d, 10, Math.min(state.balance, 1000000)); crashBetInput(); sfx.click(); };
  const m = $('[data-crstep="1"]'); if (m) m.onclick = () => setAmt(100);
  const p = $('[data-crstep="-1"]'); if (p) p.onclick = () => setAmt(-100);
}
function renderCrash(v) {
  v.innerHTML =
    '<div class="page crashpage">'
    + '<div class="cr-top">'
    +   '<a class="cr-back" href="#/games">← Мини игры</a>'
    +   '<div class="cr-stats">'
    +     '<div class="cr-stat"><span>Баланс</span><b id="crBal">' + money(state.balance) + ' ₽</b></div>'
    +     '<div class="cr-stat"><span>Лучший множитель</span><b>×' + (state.stats.crashBest || 0).toFixed(2) + '</b></div>'
    +   '</div>'
    + '</div>'
    + '<div class="cr-hist" id="crHist"></div>'
    + '<div class="cr-main">'
    +   '<div class="cr-stage is-wait" id="crStage">'
    +     '<svg class="cr-graph" viewBox="0 0 649 350">'
    +       '<defs><linearGradient id="crFillG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cdb90" stop-opacity=".38"/><stop offset=".55" stop-color="#5cdb90" stop-opacity=".16"/><stop offset="1" stop-color="#5cdb90" stop-opacity="0"/></linearGradient></defs>'
    +       '<g id="crGrid"></g>'
    +       '<path id="crFill" fill="url(#crFillG)" d=""/>'
    +       '<path id="crLine" class="cr-line" fill="none" stroke="#44c987" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" d=""/>'
    +       '<circle id="crDot" r="6.5" fill="#44c987" stroke="#0b1a12" stroke-width="3" opacity="0"/>'
    +     '</svg>'
    +     '<div class="cr-center"><b id="crMult">×—</b><span id="crState">Ставки принимаются</span></div>'
    +   '</div>'
    +   '<div class="cr-panel">'
    +     '<div class="cr-panel-head"><span>Ваша ставка</span><b id="crBal2"></b></div>'
    +     '<div class="cr-field">'
    +       '<label>Сумма ставки</label>'
    +       '<div class="cr-input"><button type="button" data-crstep="-1">−</button><input id="crAmount" type="number" value="100" min="10" step="10"><button type="button" data-crstep="1">+</button></div>'
    +     '</div>'
    +     '<div class="cr-quick">'
    +       '<button type="button" data-crq="100">100</button><button type="button" data-crq="1000">1 000</button><button type="button" data-crq="5000">5 000</button><button type="button" data-crq="max">МАКС</button>'
    +     '</div>'
    +     '<div class="cr-field"><label>Авто-забор при</label><div class="cr-input cr-input-x"><input id="crTarget" type="number" value="2.00" min="1.1" step="0.05"><i>×</i></div></div>'
    +     '<div class="cr-quick"><button type="button" data-crt="1.5">1.5×</button><button type="button" data-crt="2">2×</button><button type="button" data-crt="3">3×</button><button type="button" data-crt="10">10×</button></div>'
    +     '<button class="btn btn-green cr-act" id="crAct" type="button">Поставить</button>'
    +     '<div class="cr-info" id="crInfo"></div>'
    +     '<div class="cr-bank"><span>Банк раунда</span><b id="crBank">0 ₽</b></div>'
    +     '<div class="cr-bank"><span>Игроков в раунде</span><b id="crCount">0</b></div>'
    +     '<div class="cr-players-head">Игроки</div>'
    +     '<div class="cr-players" id="crPlayers"></div>'
    +   '</div>'
    + '</div>'
    + '</div>';
  crashBind();
  const bal = $('#crBal2'); if (bal) bal.textContent = money(state.balance) + ' ₽';
}

/* ---------------- shared bet panel ---------------- */
function betPanelHtml(id, extra) {
  return '<div class="cr-panel">'
    + '<div class="cr-panel-head"><span>Ставка</span><b id="' + id + 'Bal">' + money(state.balance) + ' ₽</b></div>'
    + '<div class="cr-field"><div class="cr-input"><button type="button" data-bs="-1">−</button><input id="' + id + 'Amount" type="number" value="100" min="10" step="10"><button type="button" data-bs="1">+</button></div></div>'
    + '<div class="cr-quick"><button type="button" data-bq="100">100</button><button type="button" data-bq="1000">1 000</button><button type="button" data-bq="10000">10 000</button><button type="button" data-bq="max">МАКС</button></div>'
    + (extra || '')
    + '</div>';
}
function betBind(id, onChange, onGo) {
  const amt = $('#' + id + 'Amount');
  if (!amt) return { get: () => 0 };
  const read = () => clamp(parseInt(amt.value, 10) || 0, 0, Math.min(state.balance, 100000000));
  amt.addEventListener('input', () => { amt.value = read(); onChange && onChange(); });
  $$('[data-bs]').forEach(b => b.onclick = () => { amt.value = clamp(read() + parseInt(b.dataset.bs, 10) * 100, 10, Math.min(state.balance, 100000000)); sfx.click(); onChange && onChange(); });
  $$('[data-bq]').forEach(b => b.onclick = () => { const q = b.dataset.bq; amt.value = q === 'max' ? Math.min(state.balance, 100000000) : Math.min(state.balance, parseInt(q, 10)); sfx.click(); onChange && onChange(); });
  if (onGo) { const g = $('#' + id + 'Go'); if (g) g.onclick = onGo; }
  return { get: read, amt: amt };
}
function gameTop(title, id) {
  return '<div class="cr-top"><a class="cr-back" href="#/games">← Мини игры</a>'
    + '<div class="cr-stats"><div class="cr-stat"><span>Баланс</span><b id="' + id + 'BalTop">' + money(state.balance) + ' ₽</b></div></div></div>'
    + '<div class="games-title">' + title + '</div>';
}

/* ---------------- SLOTS ---------------- */
const SLOT_SYM = [
  { s: '7', w: 5, p: 20, c: '#ffae39' }, { s: '★', w: 6, p: 12, c: '#d32ce6' },
  { s: '♠', w: 8, p: 8, c: '#4b69ff' }, { s: '♥', w: 8, p: 8, c: '#eb4b4b' },
  { s: '♣', w: 10, p: 5, c: '#5e98d9' }, { s: '♦', w: 10, p: 5, c: '#44c987' },
  { s: '●', w: 14, p: 3, c: '#b0c3d9' }, { s: '▲', w: 14, p: 2, c: '#8847ff' }
];
const SLOT_POOL = []; SLOT_SYM.forEach(x => { for (let i = 0; i < x.w; i++) SLOT_POOL.push(x); });
let sl = null;
function slotsStop() { if (sl) { sl.stopped = true; if (sl.timers) sl.timers.forEach(clearTimeout); sl = null; } }
function slotsStart() { if (sl) { slotsAct(); } }
function slotSymHtml(x) { return '<span class="sl-sym" style="color:' + x.c + '">' + x.s + '</span>'; }
function renderSlots(v) {
  v.innerHTML = '<div class="page crashpage">' + gameTop('Слоты', 'sl')
    + '<div class="cr-main"><div class="cr-stage sl-stage" id="slStage">'
    + '<div class="sl-reels">' + [0, 1, 2].map(i => '<div class="sl-reel" id="slR' + i + '"><div class="sl-strip"></div></div>').join('') + '</div>'
    + '<div class="sl-line"></div></div>'
    + betPanelHtml('sl', '<button class="btn btn-green cr-act" id="slGo" type="button">Крутить</button><div class="cr-info" id="slInfo"></div>')
    + '</div></div>';
  sl = { stopped: false, timers: [], spinning: false, amount: 100 };
  const B = betBind('sl', null, () => slotsSpin());
  sl.getBet = B.get;
  const stripHtml = Array.from({ length: 8 }, () => SLOT_POOL.map(slotSymHtml).join('')).join('');
  [0, 1, 2].forEach(i => { const st = $('#slR' + i + ' .sl-strip'); if (st) st.innerHTML = stripHtml; });
  slotsSet(0, 2); slotsSet(1, 11); slotsSet(2, 20);
  slotsAct();
}
function slotsSet(i, n) {
  const st = $('#slR' + i + ' .sl-strip'); if (!st) return;
  st.style.transition = 'none'; st.style.transform = 'translate3d(0,' + (-n * 22) + 'rem,0)';
}
function slotsAct() {
  const b = $('#slGo'); if (!b || !sl) return;
  b.disabled = sl.spinning || (sl.getBet && sl.getBet() < 10);
  b.textContent = sl.spinning ? 'Крутим…' : 'Крутить';
}
function slotsSpin() {
  if (!sl || sl.spinning) return;
  const bet = sl.getBet ? sl.getBet() : 0;
  if (bet < 10) { toast('Минимальная ставка — 10 ₽', 'warn'); return; }
  if (state.balance < bet) { toast('Недостаточно средств', 'err'); return; }
  state.balance -= bet; syncBalance(); save(); sfx.click();
  sl.spinning = true; slotsAct();
  const info = $('#slInfo'); if (info) info.textContent = '';
  const res = [pick(SLOT_POOL), pick(SLOT_POOL), pick(SLOT_POOL)];
  const DUR = [1400, 2000, 2600];
  [0, 1, 2].forEach(i => {
    const st = $('#slR' + i + ' .sl-strip'); if (!st) return;
    const from = 0, to = SLOT_POOL.length * 8 + SLOT_POOL.indexOf(res[i]) + 18;
    st.style.transition = 'none'; st.style.transform = 'translate3d(0,' + (-from * 22) + 'rem,0)';
    void st.offsetHeight;
    st.style.transition = 'transform ' + DUR[i] + 'ms cubic-bezier(.15,.65,.25,1)';
    st.style.transform = 'translate3d(0,' + (-to * 22) + 'rem,0)';
    const tk = setInterval(() => sfx.tick(), 90); sl.timers.push(tk);
    sl.timers.push(setTimeout(() => { clearInterval(tk); }, DUR[i]));
  });
  sl.timers.push(setTimeout(() => {
    if (!sl || sl.stopped) return;
    sl.spinning = false; slotsAct();
    const a = res[0], b2 = res[1], c = res[2];
    let mult = 0, txt = 'Мимо';
    if (a.s === b2.s && b2.s === c.s) { mult = a.p; txt = 'x' + a.p + ' — ' + a.s + a.s + a.s; }
    else if (a.s === b2.s || b2.s === c.s || a.s === c.s) { mult = 1; txt = 'Малый приз'; }
    const win = Math.round(bet * mult);
    if (win > 0) {
      state.balance += win; state.stats.earned += win; syncBalance(); save();
      sfx.win(); burst(50, ['#44c987', '#ffd700']);
      $('#slStage').classList.add('is-win');
      if (info) info.innerHTML = '<span class="is-ok">' + txt + ' · +' + money(win) + ' ₽</span>';
      toast('+' + money(win) + ' ₽');
    } else {
      sfx.lose(); $('#slStage').classList.add('is-lose');
      if (info) info.innerHTML = '<span class="is-bad">Проигрыш</span>';
    }
    sl.timers.push(setTimeout(() => { const s = $('#slStage'); if (s) { s.classList.remove('is-win', 'is-lose'); } }, 900));
    updateLacksAll();
  }, 2700));
}

/* ---------------- MINES ---------------- */
const MN_SIZE = 5;
let mn = null;
function minesStop() { if (mn) { mn.stopped = true; mn = null; } }
function minesStart() { if (mn) { minesAct(); } }
function minesMult() {
  const total = MN_SIZE * MN_SIZE, open = mn.open.length, mines = mn.count;
  let m = 1;
  for (let i = 0; i < open; i++) m *= (total - i) / (total - mines - i) * 0.97;
  return m;
}
function renderMines(v) {
  v.innerHTML = '<div class="page crashpage">' + gameTop('Мины', 'mn')
    + '<div class="cr-main"><div class="cr-stage mn-stage" id="mnStage">'
    + '<div class="mn-grid" id="mnGrid"></div>'
    + '<div class="mn-ov" id="mnOv"></div></div>'
    + betPanelHtml('mn',
        '<div class="cr-field"><label>Мин</label><div class="cr-mults" id="mnCnt">'
        + [1, 3, 5, 10].map((n, i) => '<button type="button" data-mn="' + n + '"' + (i === 1 ? ' class="is-on"' : '') + '>' + n + '</button>').join('')
        + '</div></div>'
        + '<button class="btn btn-green cr-act" id="mnGo" type="button">Начать</button>'
        + '<div class="cr-info" id="mnInfo"></div>'
        + '<div class="cr-bank"><span>Множитель</span><b id="mnMult">x1.00</b></div>'
        + '<button class="btn btn-dark cr-act" id="mnCash" type="button" disabled>Забрать</button>')
    + '</div></div>';
  mn = { stopped: false, count: 3, bet: 0, open: [], mines: [], phase: 'idle' };
  const B = betBind('mn');
  mn.getBet = B.get;
  $$('[data-mn]').forEach(b => b.onclick = () => {
    if (mn.phase === 'play') return;
    mn.count = parseInt(b.dataset.mn, 10);
    $$('[data-mn]').forEach(x => x.classList.toggle('is-on', x === b)); sfx.click();
  });
  $('#mnGo').onclick = minesGo;
  $('#mnCash').onclick = minesCash;
  minesGrid();
  minesAct();
}
function minesGrid() {
  const g = $('#mnGrid'); if (!g || !mn) return;
  g.innerHTML = '';
  for (let i = 0; i < MN_SIZE * MN_SIZE; i++) {
    const d = document.createElement('button');
    d.className = 'mn-cell'; d.type = 'button'; d.dataset.i = i;
    d.onclick = () => minesPick(i);
    g.appendChild(d);
  }
}
function minesAct() {
  const g = $('#mnGo'), c = $('#mnCash'), info = $('#mnInfo');
  if (!g || !mn) return;
  if (mn.phase === 'idle') {
    g.disabled = false; g.textContent = 'Начать'; if (c) c.disabled = true;
    if (info) info.textContent = '';
  } else {
    g.disabled = true; g.textContent = 'Идёт игра'; if (c) c.disabled = mn.open.length === 0;
    if (info) info.innerHTML = 'Открыто ' + mn.open.length + ' · множитель <b>x' + minesMult().toFixed(2) + '</b>';
  }
}
function minesGo() {
  if (!mn || mn.phase === 'play') return;
  const bet = mn.getBet ? mn.getBet() : 0;
  if (bet < 10) { toast('Минимальная ставка — 10 ₽', 'warn'); return; }
  if (state.balance < bet) { toast('Недостаточно средств', 'err'); return; }
  state.balance -= bet; syncBalance(); save(); sfx.click();
  mn.bet = bet; mn.phase = 'play'; mn.open = [];
  const idx = []; for (let i = 0; i < MN_SIZE * MN_SIZE; i++) idx.push(i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  mn.mines = idx.slice(0, mn.count);
  minesGrid(); minesAct(); updateLacksAll();
}
function minesPick(i) {
  if (!mn || mn.phase !== 'play' || mn.open.indexOf(i) >= 0) return;
  const cells = $$('#mnGrid .mn-cell');
  if (mn.mines.indexOf(i) >= 0) {
    mn.phase = 'lose';
    mn.mines.forEach(m => { const el = cells[m]; if (el) { el.className = 'mn-cell is-mine'; el.textContent = '✱'; } });
    sfx.lose();
    const info = $('#mnInfo'); if (info) info.innerHTML = '<span class="is-bad">Мина! −' + money(mn.bet) + ' ₽</span>';
    if (cells[i]) { cells[i].classList.add('is-boom'); }
    $('#mnStage').classList.add('is-lose');
    setTimeout(() => { const s = $('#mnStage'); if (s) s.classList.remove('is-lose'); }, 900);
    minesAct();
    return;
  }
  mn.open.push(i);
  const el = cells[i]; if (el) { el.className = 'mn-cell is-open'; el.textContent = '●'; }
  sfx.tick();
  const mult = minesMult();
  const cm = $('#mnMult'); if (cm) cm.textContent = 'x' + mult.toFixed(2);
  const c = $('#mnCash'); if (c) { c.disabled = false; c.textContent = 'Забрать ' + money(Math.round(mn.bet * mult)) + ' ₽'; }
  if (mn.open.length >= MN_SIZE * MN_SIZE - mn.count) minesCash();
  else minesAct();
}
function minesCash() {
  if (!mn || mn.phase !== 'play' || !mn.open.length) return;
  const win = Math.round(mn.bet * minesMult());
  state.balance += win; state.stats.earned += win; syncBalance(); save();
  sfx.win(); burst(40, ['#44c987', '#ffd700']);
  mn.phase = 'idle';
  const info = $('#mnInfo'); if (info) info.innerHTML = '<span class="is-ok">+' + money(win) + ' ₽</span>';
  toast('+' + money(win) + ' ₽');
  $('#mnStage').classList.add('is-win');
  setTimeout(() => { const s = $('#mnStage'); if (s) s.classList.remove('is-win'); }, 900);
  const cm = $('#mnMult'); if (cm) cm.textContent = 'x1.00';
  mn.bet = 0; mn.open = [];
  setTimeout(() => { minesGrid(); minesAct(); }, 700);
  updateLacksAll();
}

/* ---------------- COIN ---------------- */
let cn = null;
function coinStop() { if (cn) { cn.stopped = true; if (cn.timer) clearTimeout(cn.timer); cn = null; } }
function coinStart() { }
function renderCoin(v) {
  v.innerHTML = '<div class="page crashpage">' + gameTop('Орёл и решка', 'cn')
    + '<div class="cr-main"><div class="cr-stage cn-stage" id="cnStage">'
    + '<div class="cn-coin" id="cnCoin"><div class="cn-in cn-head">ОРЕЛ</div><div class="cn-in cn-tail">РЕШКА</div></div>'
    + '<div class="cn-res" id="cnRes"></div></div>'
    + betPanelHtml('cn',
        '<div class="cr-mults" style="grid-template-columns:1fr 1fr"><button type="button" data-cn="0" class="is-on">Орёл</button><button type="button" data-cn="1">Решка</button></div>'
        + '<button class="btn btn-green cr-act" id="cnGo" type="button">Бросить</button>'
        + '<div class="cr-info" id="cnInfo"></div>'
        + '<div class="cr-bank"><span>Выплата</span><b>x1.90</b></div>')
    + '</div></div>';
  cn = { stopped: false, side: 0, timer: 0, spinning: false };
  const B = betBind('cn');
  cn.getBet = B.get;
  $$('[data-cn]').forEach(b => b.onclick = () => {
    if (cn.spinning) return;
    cn.side = parseInt(b.dataset.cn, 10);
    $$('[data-cn]').forEach(x => x.classList.toggle('is-on', x === b)); sfx.click();
  });
  $('#cnGo').onclick = coinGo;
}
function coinGo() {
  if (!cn || cn.spinning) return;
  const bet = cn.getBet ? cn.getBet() : 0;
  if (bet < 10) { toast('Минимальная ставка — 10 ₽', 'warn'); return; }
  if (state.balance < bet) { toast('Недостаточно средств', 'err'); return; }
  state.balance -= bet; syncBalance(); save(); sfx.click();
  cn.spinning = true;
  const go = $('#cnGo'); if (go) { go.disabled = true; go.textContent = '…'; }
  const res = Math.random() < 0.5 ? 0 : 1;
  const coin = $('#cnCoin'), stage = $('#cnStage'), r = $('#cnRes');
  if (r) r.textContent = '';
  if (stage) stage.classList.remove('is-win', 'is-lose');
  const spins = 5 + Math.floor(Math.random() * 3);
  if (coin) {
    coin.classList.remove('is-flip');
    coin.style.transform = 'rotateY(0deg)';
    void coin.offsetHeight;
    coin.style.transition = 'transform 2.2s cubic-bezier(.2,.7,.2,1)';
    coin.style.transform = 'rotateY(' + (spins * 360 + (res === 1 ? 180 : 0)) + 'deg)';
    coin.classList.add('is-flip');
  }
  const tk = setInterval(() => sfx.tick(), 80);
  cn.timer = setTimeout(() => {
    clearInterval(tk);
    if (!cn || cn.stopped) return;
    cn.spinning = false;
    if (go) { go.disabled = false; go.textContent = 'Бросить'; }
    const win = res === cn.side;
    if (win) {
      const w = Math.round(bet * 1.9);
      state.balance += w; state.stats.earned += w; syncBalance(); save();
      sfx.win(); burst(50, ['#44c987', '#ffd700']);
      if (stage) stage.classList.add('is-win');
      if (r) r.innerHTML = '<span class="is-ok">' + (res === 0 ? 'Орёл' : 'Решка') + ' · +' + money(w) + ' ₽</span>';
      toast('+' + money(w) + ' ₽');
    } else {
      sfx.lose(); if (stage) stage.classList.add('is-lose');
      if (r) r.innerHTML = '<span class="is-bad">' + (res === 0 ? 'Орёл' : 'Решка') + ' · −' + money(bet) + ' ₽</span>';
    }
    updateLacksAll();
  }, 2300);
}

/* ============================================================
   TOP UP
   ============================================================ */
function topUpModal() {
  const m = modal(
    '<div style="font-family:var(--head);font-size:2.4rem;text-transform:uppercase;margin-bottom:1rem">Пополнение</div>'
    + '<div class="m-sub" style="margin-bottom:1.6rem">Выберите способ пополнения баланса</div>'
    + '<div class="adv" id="advBox" style="padding:1.6rem;background:var(--accent-bg);border:1px solid var(--accent);border-radius:.2rem;cursor:pointer;text-align:center;margin-bottom:1.6rem;transition:.2s">'
    +   'Посмотреть рекламу<br><span style="font-size:1.2rem;opacity:.8" id="advSub">+1 000 ₽</span>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">'
    +   '<button class="btn btn-dark" data-add="5000">+5 000 ₽</button>'
    +   '<button class="btn btn-dark" data-add="25000">+25 000 ₽</button>'
    +   '<button class="btn btn-dark" data-add="100000">+100 000 ₽</button>'
    +   '<button class="btn btn-dark" data-add="1000000">+1 000 000 ₽</button>'
    + '</div>');
  $$('[data-add]', m).forEach(b => b.onclick = () => { const n = parseInt(b.dataset.add); state.balance += n; syncBalance(); save(); sfx.click(); toast('Баланс пополнен на ' + money(n) + ' ₽'); updateLacksAll(); });
  let busy = false;
  const adv = $('#advBox', m);
  adv.onclick = () => {
    if (busy) return; busy = true;
    let s = 4; const sub = $('#advSub', m);
    adv.style.pointerEvents = 'none'; adv.style.opacity = '.7';
    sub.textContent = 'Реклама… ' + s;
    const iv = setInterval(() => { s--; sub.textContent = 'Реклама… ' + s; if (s <= 0) { clearInterval(iv); state.balance += 1000; syncBalance(); save(); sfx.win(); toast('Награда: +1 000 ₽'); adv.style.opacity = ''; adv.style.pointerEvents = ''; sub.textContent = '+1 000 ₽'; busy = false; updateLacksAll(); } }, 1000);
  };
}
function updateLacksAll() {
  const h = (location.hash || '').slice(2);
  const parts = h.split('/');
  if (parts[0] === 'case' && parts[1]) { const c = CASES.find(x => x.slug === parts[1]); if (c) updateLacks(c); }
}

/* ============================================================
   MISC
   ============================================================ */
function addInv(item) {
  state.inv.push(item);
  if (state.inv.length > 500) state.inv.shift();
  syncBalance();
}

/* ---------- init ---------- */
function init() {
  load();
  if (typeof state.sound !== 'boolean') state.sound = true;
  syncBalance();
  resizeFx(); addEventListener('resize', resizeFx);

  const sndOn = $('#sndOn'), sndOff = $('#sndOff');
  if (sndOn) sndOn.style.display = state.sound ? '' : 'none';
  if (sndOff) sndOff.style.display = state.sound ? 'none' : '';
  $('#soundBtn').onclick = () => {
    state.sound = !state.sound; save();
    if (sndOn) sndOn.style.display = state.sound ? '' : 'none';
    if (sndOff) sndOff.style.display = state.sound ? 'none' : '';
    if (state.sound) sfx.click();
  };
  $('#topupBtn').onclick = topUpModal;

  liveDropInit();
  addEventListener('hashchange', route);
  route();

  const boot = $('#boot');
  if (boot) { setTimeout(() => { boot.style.opacity = '0'; setTimeout(() => boot.remove(), 500); }, 500); }
}
document.addEventListener('DOMContentLoaded', init);

})();
