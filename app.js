(() => {
'use strict';

// ===================================================================== utils
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const root  = document.documentElement;

const measureCtx = document.createElement('canvas').getContext('2d');
function textWidth(t, font) { measureCtx.font = font; return measureCtx.measureText(t).width; }

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex).map(c => clamp(Math.round(c + amt * 255), 0, 255));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
let accentRGB = [70, 122, 242];
const rgba = a => `rgba(${accentRGB[0]},${accentRGB[1]},${accentRGB[2]},${a})`;

// Display form of the lowercase data names, same rule as the app.
function pretty(s) {
  return String(s).split(' ').map(w => {
    if (/^\d.*x$/.test(w)) return w;
    if (/\d/.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

// ===================================================================== data
const ATK = {
  ace: ['ak12', '556xi'], amaru: ['g8a1', 'supernova'], ash: ['g36c', 'r4c'],
  blackbeard: ['mk17 cqb', 'sr25'], buck: ['c8 sfw', 'camrs'], capitao: ['para 308', 'm249'],
  dokkaebi: ['mk14 ebr', 'bosg 12 2'], finka: ['spear 308', '6p41', 'sasg 12'], flores: ['ar33', 'sr25'],
  glaz: ['ots03'], hibana: ['type 89', 'supernova'], iana: ['arx200', 'g36c'],
  iq: ['aug a2', '552 commando', 'g8a1'], jackal: ['c7e', 'pdw9'], maverick: ['ar15', 'm4'],
  nomad: ['ar1', 'f90'], sledge: ['l85a2', 'm590a1'], thermite: ['556xi', 'm1014'],
  twitch: ['f2', '417'], zofia: ['lmg e', 'm762'],
};
const DEF = {
  alibi: ['mx4 storm', 'acs12'], bandit: ['mp7', 'm870'], castle: ['ump45', 'm1014'],
  doc: ['mp5', 'p90', 'sg cqb'], jager: ['416 carbine', 'm870'], kaid: ['aug a3', 'tcsg12'],
  mira: ['vector', 'its'], mozzie: ['commando 9', 'p10 roni'], mute: ['mp5k', 'm590a1'],
  rook: ['mp5', 'p90'], smoke: ['fmg9', 'm590a1'], valkyrie: ['mpx', 'spas12'],
  vigil: ['k1a', 'bosg 12 2'], wamai: ['aug a2', 'mp5k'],
};
const SIDES   = ['Attackers', 'Defenders'];
const SCOPES  = ['1x', '2.5x'];
const GRIPS   = ['vertical grip', 'angled grip', 'horizontal grip', 'none'];
const BARRELS = ['compensator', 'muzzle brake', 'flash hider', 'suppressor', 'extended barrel', 'none'];
const MICE    = ['G Pro Superlight', 'G502 X', 'Viper V3 Pro', 'DeathAdder V3', 'Model O', 'Other'];
const MODES   = ['Operator', 'Text', 'Animation'];
const IFACES  = ['Desktop', 'Web UI'];

const DEFAULT_COLORS = { accent: '#467af2', bg: '#0c0c0c', panel: '#101010', text: '#f0f0f2', control: '#111111' };

const state = {
  page: 0,
  side: 0, op: 'ash', gun: 1, scope: 1, grip: 0, barrel: 0,
  enable: true, requireToggle: true, toggleKey: 'CapsLock', hCtrl: true, vCtrl: true, atkScope: 1, defScope: 0,
  horiz: 0.84, vert: 0.86, human: 0.06, attach: 1.0, startDelay: 0, resetTime: 0, delayRate: 7,
  mouse: 0, dpi: 800, hsens: 10, vsens: 10, fov: 90, sensMult: 0.02,
  advAds: true, globalAds: 50, ads1: 42, ads25: 61,
  matrixMode: 0, matrixText: 'IND', anim: 7, animSpeed: 1,
  driverInput: true, menuKey: 'Insert', debug: false,
  iface: 0, anims: true,
  colors: { ...DEFAULT_COLORS },
  lastSent: '',
};

const opList = () => Object.keys(state.side === 0 ? ATK : DEF).sort();
const gunList = () => (state.side === 0 ? ATK : DEF)[state.op] || [];

// ===================================================================== LED font
const GLYPH_DIGITS = [[2,5,5,5,2],[6,2,2,2,7],[6,1,2,4,7],[7,1,2,1,7],[5,5,7,1,1],[7,4,6,1,6],[2,4,6,5,2],[7,1,2,2,2],[2,5,2,5,2],[2,5,3,1,2]];
const GLYPH_ALPHA = [[2,5,7,5,5],[6,5,6,5,6],[3,4,4,4,3],[6,5,5,5,6],[7,4,6,4,7],[7,4,6,4,4],[3,4,5,5,3],[5,5,7,5,5],[7,2,2,2,7],[1,1,1,5,2],[5,5,6,5,5],[4,4,4,4,7],[5,7,5,5,5],[4,6,5,3,1],[2,5,5,5,2],[6,5,6,4,4],[2,5,5,7,3],[6,5,6,5,5],[3,4,2,1,6],[7,2,2,2,2],[5,5,5,5,2],[5,5,5,2,2],[5,5,5,7,5],[5,5,2,5,5],[5,5,2,2,2],[7,1,2,4,7]];
function glyph(ch) {
  const c = ch.toUpperCase();
  if (c >= '0' && c <= '9') return GLYPH_DIGITS[c.charCodeAt(0) - 48];
  if (c >= 'A' && c <= 'Z') return GLYPH_ALPHA[c.charCodeAt(0) - 65];
  return null;
}
// ===================================================================== LED animations
// JavaScript port of mouse_arduino/matrix_anim.h, so the demo plays the same
// effects the board does.
const ANIM_NAMES = ['Scrolling Text', 'Matrix Rain', 'Knight Rider', 'Bouncing Balls',
  'Sine Wave', 'Ripple', 'Plasma', 'Fire', 'Snake', 'Game of Life', 'Pong', 'Starfield',
  'Twinkle', 'Spectrum Bars', 'Heartbeat', 'Spiral', 'Metaballs'];
const ANIM_MSG = 'INDICA.GG';
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function animReset(id, seed) {
  const s = { id, rng: (seed | 1) >>> 0, t: 0, acc: 0, f: new Float32Array(96), a: new Float32Array(16),
              sx: new Int8Array(96), sy: new Int8Array(96), len: 0, dir: 0, fx: 0, fy: 0, g: new Uint8Array(96) };
  const rf = () => animRf(s);
  if (id === 1) for (let c = 0; c < 12; c++) { s.f[c] = -rf() * 10; s.f[12 + c] = 5 + rf() * 9; }
  if (id === 3) for (let b = 0; b < 3; b++) { s.a[b * 4] = 1 + rf() * 10; s.a[b * 4 + 1] = rf() * 3; s.a[b * 4 + 2] = (rf() < .5 ? -1 : 1) * (3 + rf() * 4); s.a[b * 4 + 3] = 0; }
  if (id === 5) { s.a[0] = 5.5; s.a[1] = 3.5; s.a[2] = 0; }
  if (id === 8) snakeReset(s);
  if (id === 9) lifeSeed(s);
  if (id === 10) { s.a[4] = s.a[5] = 3.5; pongServe(s, 1); }
  if (id === 11) for (let i = 0; i < 16; i++) starNew(s, i, false);
  if (id === 13) for (let c = 0; c < 12; c++) s.f[12 + c] = 1 + rf() * 7;
  return s;
}
function animRand(s) { let x = s.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = (x >>> 0) || 0x9E3779B9; return s.rng; }
function animRf(s) { return (animRand(s) & 0xFFFFFF) / 16777216; }
function animRi(s, n) { return animRand(s) % n; }
function aset(out, x, y) { if (x >= 0 && x < 12 && y >= 0 && y < 8) out[y * 12 + x] = 1; }
function alum(out, x, y, v) { if (x >= 0 && x < 12 && y >= 0 && y < 8 && v > (BAYER[y & 3][x & 3] + .5) / 16) out[y * 12 + x] = 1; }
const wrapDist = (a, b, n) => { const d = Math.abs(a - b); return Math.min(d, n - d); };
function snakeFood(s) {
  for (let k = 0; k < 60; k++) {
    const x = animRi(s, 12), y = animRi(s, 8);
    let hit = false;
    for (let i = 0; i < s.len; i++) if (s.sx[i] === x && s.sy[i] === y) { hit = true; break; }
    if (!hit) { s.fx = x; s.fy = y; return; }
  }
}
function snakeReset(s) { s.len = 3; s.dir = 0; for (let i = 0; i < 3; i++) { s.sx[i] = 5 - i; s.sy[i] = 4; } snakeFood(s); }
function lifeSeed(s) { for (let i = 0; i < 96; i++) s.g[i] = animRf(s) < .36 ? 1 : 0; s.len = 0; }
function pongServe(s, dir) { s.a[0] = 5.5; s.a[1] = 1 + animRf(s) * 5; s.a[2] = dir * 7; s.a[3] = (animRf(s) - .5) * 7; }
function starNew(s, i, far) { s.f[i * 3] = animRf(s) * 2 - 1; s.f[i * 3 + 1] = animRf(s) * 2 - 1; s.f[i * 3 + 2] = far ? 1 : .15 + animRf(s) * .85; }
const HEART_BIG = ['.###..###.', '##########', '##########', '.########.', '..######..', '...####...', '....##....'];
const HEART_SMALL = ['.##..##.', '########', '########', '.######.', '..####..', '...##...'];

function animFrame(s, dt, out) {
  dt = Math.max(0, Math.min(.1, dt));
  s.t += dt;
  const t = s.t, rf = () => animRf(s);
  out.fill(0);
  switch (s.id) {
  case 0: {
    const msgW = ANIM_MSG.length * 4 + 8, off = Math.floor(t * 9) % (msgW + 12);
    for (let k = 0; k < ANIM_MSG.length; k++) {
      const g = ANIM_MSG[k] === '.' ? [0, 0, 0, 0, 2] : glyph(ANIM_MSG[k]);
      if (!g) continue;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if ((g[r] >> (2 - c)) & 1) aset(out, 12 - off + k * 4 + c, r + 1);
    }
    break;
  }
  case 1:
    for (let c = 0; c < 12; c++) {
      s.f[c] += s.f[12 + c] * dt;
      if (s.f[c] > 13) { s.f[c] = -rf() * 6; s.f[12 + c] = 5 + rf() * 9; }
      const head = Math.floor(s.f[c]);
      aset(out, c, head);
      for (let k = 1; k <= 4; k++) alum(out, c, head - k, 1 - k / 4.5);
    }
    break;
  case 2: {
    const pos = (Math.sin(t * 2.4) * .5 + .5) * 11, dir = Math.cos(t * 2.4) >= 0 ? 1 : -1;
    for (let x = 0; x < 12; x++) {
      const d = (x - pos) * dir;
      const v = Math.abs(d) < .8 ? 1 : (d < 0 ? 1 + d / 6 : 1 - d / 1.6);
      for (let y = 2; y <= 5; y++) alum(out, x, y, (y === 2 || y === 5) ? v * .7 : v);
    }
    break;
  }
  case 3:
    for (let b = 0; b < 3; b++) {
      const p = b * 4, a = s.a;
      a[p + 3] += 22 * dt; a[p] += a[p + 2] * dt; a[p + 1] += a[p + 3] * dt;
      if (a[p] < 0) { a[p] = -a[p]; a[p + 2] = -a[p + 2]; }
      if (a[p] > 11) { a[p] = 22 - a[p]; a[p + 2] = -a[p + 2]; }
      if (a[p + 1] > 7) { a[p + 1] = 7; a[p + 3] = -a[p + 3] * .9; if (a[p + 3] > -6) a[p + 3] = -11 - rf() * 4; }
      aset(out, Math.floor(a[p] + .5), Math.floor(a[p + 1] + .5));
    }
    break;
  case 4:
    for (let x = 0; x < 12; x++) {
      const y1 = 3.5 + 3 * Math.sin(x * .6 + t * 3), y2 = 3.5 + 2.2 * Math.sin(x * .35 - t * 2.1 + 1);
      for (let y = 0; y < 8; y++) alum(out, x, y, Math.max(1 - Math.abs(y - y1) / .8, (1 - Math.abs(y - y2) / .8) * .55));
    }
    break;
  case 5:
    s.a[2] += 7 * dt;
    if (s.a[2] > 12) { s.a[0] = 2 + rf() * 8; s.a[1] = 1.5 + rf() * 5; s.a[2] = 0; }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x - s.a[0], y - s.a[1]);
      const fade = Math.max(0, Math.min(1, 1.25 - s.a[2] / 12));
      alum(out, x, y, Math.max(1 - Math.abs(d - s.a[2]) / 1.3, (1 - Math.abs(d - (s.a[2] - 3.5)) / 1.3) * .7) * fade);
    }
    break;
  case 6:
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      const v = Math.sin(x * .55 + t) + Math.sin(y * .7 - t * 1.3) + Math.sin((x + y) * .4 + t * .7) + Math.sin(Math.hypot(x - 5.5, y - 3.5) * .8 - t * 1.6);
      alum(out, x, y, .5 + .5 * Math.sin(v * 1.4));
    }
    break;
  case 7:
    s.acc += dt;
    while (s.acc > .05) {
      s.acc -= .05;
      for (let x = 0; x < 12; x++) s.f[84 + x] = rf() < .7 ? .85 + rf() * .15 : .35;
      for (let y = 0; y < 7; y++) for (let x = 0; x < 12; x++) {
        const b = (y + 1) * 12;
        let sum = s.f[b + x] * 2 + s.f[b + (x > 0 ? x - 1 : x)] + s.f[b + (x < 11 ? x + 1 : x)], cnt = 4;
        if (y + 2 < 8) { sum += s.f[(y + 2) * 12 + x]; cnt++; }
        s.f[y * 12 + x] = Math.max(0, sum / cnt - (.05 + rf() * .09));
      }
    }
    for (let i = 0; i < 96; i++) alum(out, i % 12, Math.floor(i / 12), s.f[i] * 1.15);
    break;
  case 8: {
    const dxs = [1, 0, -1, 0], dys = [0, 1, 0, -1];
    s.acc += dt;
    while (s.acc > .12) {
      s.acc -= .12;
      let best = -1, bestD = 1e9;
      for (let d = 0; d < 4; d++) {
        if (d === (s.dir + 2) % 4) continue;
        const nx = (s.sx[0] + dxs[d] + 12) % 12, ny = (s.sy[0] + dys[d] + 8) % 8;
        let hit = false;
        for (let i = 0; i < s.len - 1; i++) if (s.sx[i] === nx && s.sy[i] === ny) { hit = true; break; }
        if (hit) continue;
        const dist = wrapDist(nx, s.fx, 12) + wrapDist(ny, s.fy, 8) + rf() * .6;
        if (dist < bestD) { bestD = dist; best = d; }
      }
      if (best < 0) { snakeReset(s); continue; }
      s.dir = best;
      const nx = (s.sx[0] + dxs[best] + 12) % 12, ny = (s.sy[0] + dys[best] + 8) % 8;
      const eat = nx === s.fx && ny === s.fy;
      if (eat && s.len < 96) s.len++;
      for (let i = s.len - 1; i > 0; i--) { s.sx[i] = s.sx[i - 1]; s.sy[i] = s.sy[i - 1]; }
      s.sx[0] = nx; s.sy[0] = ny;
      if (eat) { if (s.len >= 26) snakeReset(s); else snakeFood(s); }
    }
    for (let i = 0; i < s.len; i++) aset(out, s.sx[i], s.sy[i]);
    if (t % .4 < .25) aset(out, s.fx, s.fy);
    break;
  }
  case 9:
    s.acc += dt;
    while (s.acc > .22) {
      s.acc -= .22;
      const next = new Uint8Array(96);
      let changes = 0, alive = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
        let n = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++)
          if (ox || oy) n += s.g[((y + oy + 8) % 8) * 12 + (x + ox + 12) % 12];
        const v = s.g[y * 12 + x], nv = (n === 3 || (v && n === 2)) ? 1 : 0;
        next[y * 12 + x] = nv; changes += nv !== v; alive += nv;
      }
      s.g.set(next);
      if (changes === 0 || alive < 3 || ++s.len > 70) lifeSeed(s);
    }
    for (let i = 0; i < 96; i++) if (s.g[i]) out[i] = 1;
    break;
  case 10: {
    const a = s.a;
    a[0] += a[2] * dt; a[1] += a[3] * dt;
    if (a[1] < 0) { a[1] = -a[1]; a[3] = Math.abs(a[3]); }
    if (a[1] > 7) { a[1] = 14 - a[1]; a[3] = -Math.abs(a[3]); }
    const tl = a[2] < 0 ? a[1] + Math.sin(t * 1.7) * .9 : 3.5, tr = a[2] > 0 ? a[1] + Math.sin(t * 1.3 + 2) * .9 : 3.5;
    const step = 6.5 * dt, mv = (from, to) => from + Math.max(-step, Math.min(step, to - from));
    a[4] = Math.max(1, Math.min(6, mv(a[4], tl)));
    a[5] = Math.max(1, Math.min(6, mv(a[5], tr)));
    if (a[2] < 0 && a[0] <= 1) {
      if (Math.abs(a[1] - a[4]) <= 1.7) { a[0] = 2 - a[0]; a[2] = -a[2] * 1.04; a[3] += (a[1] - a[4]) * 2.5; }
      else if (a[0] < -1) pongServe(s, 1);
    }
    if (a[2] > 0 && a[0] >= 10) {
      if (Math.abs(a[1] - a[5]) <= 1.7) { a[0] = 20 - a[0]; a[2] = -a[2] * 1.04; a[3] += (a[1] - a[5]) * 2.5; }
      else if (a[0] > 12) pongServe(s, -1);
    }
    a[2] = Math.max(-14, Math.min(14, a[2]));
    for (let k = -1; k <= 1; k++) { aset(out, 0, Math.floor(a[4] + .5) + k); aset(out, 11, Math.floor(a[5] + .5) + k); }
    aset(out, Math.floor(a[0] + .5), Math.floor(a[1] + .5));
    break;
  }
  case 11:
    for (let i = 0; i < 16; i++) {
      const p = i * 3;
      s.f[p + 2] -= dt * .55;
      if (s.f[p + 2] <= .05) starNew(s, i, true);
      const px = 5.5 + s.f[p] / s.f[p + 2] * 3, py = 3.5 + s.f[p + 1] / s.f[p + 2] * 2.2;
      if (px < -.5 || px > 11.5 || py < -.5 || py > 7.5) { starNew(s, i, true); continue; }
      alum(out, Math.floor(px + .5), Math.floor(py + .5), 1.15 - s.f[p + 2]);
    }
    break;
  case 12:
    for (let i = 0; i < 96; i++) {
      if (s.f[i] > 0) { s.f[i] += dt * 1.6; if (s.f[i] >= 2) s.f[i] = 0; }
      else if (rf() < dt * .12) s.f[i] = .001;
      const v = s.f[i] < 1 ? s.f[i] : 2 - s.f[i];
      alum(out, i % 12, Math.floor(i / 12), s.f[i] > 0 ? v : 0);
    }
    break;
  case 13:
    s.acc += dt;
    while (s.acc > .11) {
      s.acc -= .11;
      for (let c = 0; c < 12; c++) {
        let g = s.f[12 + c] + (rf() - .5) * 5;
        if (rf() < .12) g = 6 + rf() * 2;
        s.f[12 + c] = Math.max(1, Math.min(8, g));
      }
    }
    for (let c = 0; c < 12; c++) {
      s.f[c] += (s.f[12 + c] - s.f[c]) * Math.min(1, dt * 14);
      const full = Math.floor(s.f[c]);
      for (let k = 0; k < full; k++) aset(out, c, 7 - k);
      alum(out, c, 7 - full, s.f[c] - full);
    }
    break;
  case 14: {
    const p = t % 1.1, beat = Math.exp(-p * 9) + .7 * Math.exp(-Math.abs(p - .28) * 14);
    if (beat > .45) HEART_BIG.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && aset(out, 1 + x, y)));
    else HEART_SMALL.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && aset(out, 2 + x, 1 + y)));
    break;
  }
  case 15:
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      const dx = x - 5.5, dy = y - 3.5;
      alum(out, x, y, (Math.sin(Math.atan2(dy, dx) * 2 + Math.hypot(dx, dy) * 1.1 - t * 4) - .1) * 1.4);
    }
    break;
  case 16: {
    const bx = [], by = [];
    for (let i = 0; i < 3; i++) { bx.push(5.5 + 4.6 * Math.sin(t * (.7 + .3 * i) + i * 2)); by.push(3.5 + 2.8 * Math.cos(t * (.9 + .2 * i) + i * 1.3)); }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 12; x++) {
      let field = 0;
      for (let i = 0; i < 3; i++) field += 2.6 / ((x - bx[i]) ** 2 + (y - by[i]) ** 2 + .05);
      alum(out, x, y, (field - .55) / .6);
    }
    break;
  }
  }
}

let animState = animReset(0, 0x1234567);
const animOut = new Uint8Array(96);

const matrixLetters = () => (state.matrixMode === 1 ? state.matrixText : state.op).slice(0, 3).toUpperCase();
function buildMatrix() {
  if (state.matrixMode === 2) return [...animOut].map(Boolean);
  const px = new Array(96).fill(false);
  const t = matrixLetters();
  for (let k = 0; k < 3; k++) {
    const g = t[k] && glyph(t[k]);
    if (!g) continue;
    for (let r = 0; r < 5; r++)
      for (let x = 0; x < 3; x++)
        px[r * 12 + k * 4 + x] = !!((g[r] >> (2 - x)) & 1);
  }
  return px;
}

// ===================================================================== toasts
function toast(msg) {
  const t = el('div', 'toast', `<i></i><span>${msg}</span>`);
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2600);
}

// ===================================================================== matrix + config
function sendMatrix() { renderGrid(); }
function sendConfig() {
  const gun = gunList()[state.gun] || '';
  state.lastSent = `${pretty(state.op)} / ${gun.toUpperCase()}`;
  toast(`Config sent: ${state.lastSent}`);
}
// ===================================================================== menu: icons
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  crosshair: svg('<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>'),
  recoil:    svg('<path d="M20 11a8 8 0 0 0-14.6-4.5M4 13a8 8 0 0 0 14.6 4.5"/><path d="M5 2.5v4h4M19 21.5v-4h-4"/>'),
  mouse:     svg('<rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 2.5v7M6 9.5h12"/>'),
  grid:      svg('<rect x="3" y="5" width="4" height="4" rx="1"/><rect x="10" y="5" width="4" height="4" rx="1" fill="currentColor"/><rect x="17" y="5" width="4" height="4" rx="1"/><rect x="3" y="15" width="4" height="4" rx="1" fill="currentColor"/><rect x="10" y="15" width="4" height="4" rx="1"/><rect x="17" y="15" width="4" height="4" rx="1" fill="currentColor"/>'),
  gear:      svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  palette:   svg('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1" fill="currentColor"/><circle cx="10" cy="7" r="1.1" fill="currentColor"/><circle cx="15" cy="7.5" r="1.1" fill="currentColor"/>'),
};

// ===================================================================== menu: widgets
const menu = $('#menu');
const panelsEl = $('#m-panels');
const layer = $('#m-popup-layer');

function row(label, strong) {
  const r = el('div', 'm-row' + (strong ? ' strong' : ''));
  r.append(el('span', 'm-label', label));
  return r;
}

function toggle(label, key, onChange) {
  const r = row(label);
  r.classList.add('clickable');
  const c = el('div', 'm-check' + (state[key] ? ' on' : ''));
  r.append(c);
  r.addEventListener('click', () => {
    state[key] = !state[key];
    c.classList.toggle('on', state[key]);
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    onChange && onChange();
  });
  return r;
}

function slider(label, key, min, max, step, dec, suffix = '') {
  const r = row(label);
  const s = el('div', 'm-slider');
  const bar = el('div', 'm-bar');
  const fill = el('div', 'm-fill');
  const val = el('div', 'm-val');
  bar.append(fill);
  s.append(bar, val);
  r.append(s);
  const W = 150, INNER = 144;
  const text = () => state[key].toFixed(dec) + suffix;
  function paint() {
    const t = (state[key] - min) / (max - min);
    fill.style.width = (t * INNER) + 'px';
    const tw = textWidth(text(), '13.5px "Segoe UI", Inter, sans-serif');
    val.textContent = text();
    val.style.left = clamp(3 + t * INNER, tw / 2, W - tw / 2) + 'px';
  }
  function setFrom(e) {
    const rect = bar.getBoundingClientRect();
    const t = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    let v = min + t * (max - min);
    if (step) v = Math.round((v - min) / step) * step + min;
    state[key] = clamp(+v.toFixed(6), min, max);
    paint();
  }
  s.addEventListener('pointerdown', e => {
    if (e.button !== 0 || s.querySelector('input')) return;
    e.preventDefault();
    s.setPointerCapture(e.pointerId);
    s.classList.add('drag');
    setFrom(e);
  });
  s.addEventListener('pointermove', e => { if (s.classList.contains('drag')) setFrom(e); });
  const end = () => s.classList.remove('drag');
  s.addEventListener('pointerup', end);
  s.addEventListener('pointercancel', end);
  function edit(e) {
    e.preventDefault();
    if (s.querySelector('input')) return;
    const inp = el('input');
    inp.value = state[key].toFixed(dec);
    s.append(inp);
    inp.focus(); inp.select();
    let done = false;
    const close = apply => {
      if (done) return;
      done = true;
      if (apply) {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) {
          let nv = clamp(v, min, max);
          if (step) nv = Math.round((nv - min) / step) * step + min;
          state[key] = clamp(nv, min, max);
        }
      }
      inp.remove();
      paint();
    };
    inp.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') close(true);
      if (ev.key === 'Escape') close(false);
    });
    inp.addEventListener('blur', () => close(true));
  }
  s.addEventListener('dblclick', edit);
  s.addEventListener('contextmenu', edit);
  paint();
  return r;
}

function combo(label, items, getIdx, setIdx, w = 150) {
  const r = row(label, true);
  const list = () => (typeof items === 'function' ? items() : items);
  const b = el('div', 'm-box m-combo', pretty(list()[getIdx()] ?? ''));
  b.style.width = w + 'px';
  r.append(b);
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (openPop && openPop.anchor === b) { closePopup(); return; }
    openPopup(b, list(), getIdx(), i => { setIdx(i); renderPage(false); });
  });
  return r;
}

let waiting = null;
function keybind(label, key) {
  const r = row(label, true);
  const b = el('div', 'm-box m-key', state[key]);
  r.append(b);
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (waiting) return;
    waiting = { b, key };
    b.classList.add('waiting');
    b.textContent = 'Press a key...';
  });
  return r;
}
function finishBind(name) {
  if (!waiting) return;
  const { b, key } = waiting;
  waiting = null;
  if (name !== null) state[key] = name;
  b.classList.remove('waiting');
  b.textContent = state[key];
  if (key === 'menuKey') updateMenuKey();
}

function button(label, text, fn) {
  const r = row(label, true);
  const b = el('div', 'm-box m-btn', text);
  r.append(b);
  b.addEventListener('click', e => {
    const rp = el('span', 'ripple');
    const sz = b.offsetWidth;
    rp.style.width = rp.style.height = sz + 'px';
    rp.style.left = (e.offsetX - sz / 2) + 'px';
    rp.style.top = (e.offsetY - sz / 2) + 'px';
    b.append(rp);
    setTimeout(() => rp.remove(), 600);
    fn();
  });
  return r;
}

function info(label, text, cls = '') {
  const r = row(label);
  r.append(el('span', 'm-info ' + cls, text));
  return r;
}

function color(label, key) {
  const r = row(label);
  const inp = el('input', 'm-swatch');
  inp.type = 'color';
  inp.value = state.colors[key];
  inp.addEventListener('input', () => { state.colors[key] = inp.value; applyColors(); });
  r.append(inp);
  return r;
}

// ===================================================================== menu: popup
let openPop = null;
function offsetIn(node) {
  let x = 0, y = 0;
  while (node && node !== menu) { x += node.offsetLeft; y += node.offsetTop; node = node.offsetParent; }
  return { x, y };
}
function openPopup(anchor, items, idx, onPick) {
  closePopup(true);
  anchor.classList.add('open');
  const w = Math.max(anchor.offsetWidth, 190);
  const pop = el('div', 'm-popup');
  pop.style.width = w + 'px';
  const listEl = el('div', 'm-list');
  let input = null;
  const fill = q => {
    listEl.innerHTML = '';
    let n = 0;
    items.forEach((it, i) => {
      if (q && !String(it).toLowerCase().includes(q)) return;
      const d = el('div', 'm-item' + (i === idx ? ' sel' : ''), pretty(it));
      d.style.animationDelay = Math.min(n++, 8) * 18 + 'ms';
      d.addEventListener('click', e => { e.stopPropagation(); closePopup(); onPick(i); });
      listEl.append(d);
    });
    if (!n) listEl.append(el('div', 'm-item', '<span style="color:var(--text-dim)">No matches</span>'));
  };
  if (items.length > 8) {
    input = el('input');
    input.placeholder = 'Search';
    input.addEventListener('input', () => fill(input.value.trim().toLowerCase()));
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closePopup(); });
    pop.append(input);
  }
  fill('');
  pop.append(listEl);
  layer.append(pop);

  const o = offsetIn(anchor);
  let left = o.x + anchor.offsetWidth - w;
  let top = o.y + anchor.offsetHeight + 4;
  if (top + pop.offsetHeight > 532) { top = o.y - 4 - pop.offsetHeight; pop.classList.add('up'); }
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  listEl.scrollTop = Math.max(0, idx * 34 - 102);
  if (input) setTimeout(() => input.focus(), 30);
  openPop = { pop, anchor };
}
function closePopup(instant) {
  if (!openPop) return;
  const { pop, anchor } = openPop;
  openPop = null;
  anchor.classList.remove('open');
  if (instant) { pop.remove(); return; }
  pop.classList.add('closing');
  setTimeout(() => pop.remove(), 160);
}
document.addEventListener('pointerdown', e => {
  if (openPop && !openPop.pop.contains(e.target) && e.target !== openPop.anchor) closePopup();
  if (waiting && e.button === 0 && e.target !== waiting.b) finishBind(null);
});

// ===================================================================== menu: pages
let gridCells = [];
let gridEl = null;
function renderGrid() {
  if (!gridEl) return;
  const px = buildMatrix();
  gridCells.forEach((c, i) => c.classList.toggle('on', px[i]));
}

function lettersRow() {
  const r = row('Letters', true);
  const inp = el('input', 'm-letters');
  inp.maxLength = 3;
  inp.value = state.matrixText;
  inp.placeholder = 'ABC';
  inp.addEventListener('keydown', e => e.stopPropagation());
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3);
    state.matrixText = inp.value;
    renderGrid();
    sendMatrix();
  });
  r.append(inp);
  return r;
}

function previewGrid() {
  const wrap = el('div');
  gridEl = el('div', 'm-grid' + (state.matrixMode === 2 ? ' anim' : ''));
  gridCells = [];
  for (let i = 0; i < 96; i++) {
    const c = el('div', 'm-cell');
    gridEl.append(c);
    gridCells.push(c);
  }
  wrap.append(gridEl, el('div', 'm-grid-hint',
    state.matrixMode === 2 ? 'Runs on the board by itself' : 'What the board shows'));
  renderGrid();
  return wrap;
}

// The selected animation keeps playing in the preview while Animation mode is on.
let animLast = performance.now();
(function animLoop(now) {
  requestAnimationFrame(animLoop);
  const dt = (now - animLast) / 1000;
  animLast = now;
  if (state.matrixMode !== 2) return;
  if (animState.id !== state.anim) animState = animReset(state.anim, 0x1234567);
  animFrame(animState, dt * state.animSpeed, animOut);
  renderGrid();
})(animLast);

const PAGES = [
  { name: 'Loadout', crumb: 'loadout', icon: 'crosshair', panels: () => [
    { title: 'Loadout', rows: [
      combo('Side', SIDES, () => state.side, i => { state.side = i; state.op = opList()[0]; state.gun = 0; }),
      combo('Operator', opList, () => opList().indexOf(state.op), i => { state.op = opList()[i]; state.gun = 0; }),
      combo('Weapon', gunList, () => state.gun, i => { state.gun = i; }),
      combo('Scope', SCOPES, () => state.scope, i => { state.scope = i; }),
      combo('Grip', GRIPS, () => state.grip, i => { state.grip = i; }),
      combo('Barrel', BARRELS, () => state.barrel, i => { state.barrel = i; }),
    ]},
    { title: 'Arduino', rows: [
      info('Status', 'Connected', 'ok'),
      button('Send Config', 'Send', () => { sendConfig(); renderPage(false); }),
      state.lastSent ? info('Last Sent', state.lastSent) : null,
      button('Connection', 'Reload', () => toast('Arduino reconnected on COM4')),
    ]},
  ]},
  { name: 'RCS', crumb: 'rcs', icon: 'recoil', panels: () => [
    { title: 'Recoil', rows: [
      toggle('Enable', 'enable'),
      toggle('Require Toggle', 'requireToggle'),
      keybind('Toggle Key', 'toggleKey'),
      toggle('Horizontal Control', 'hCtrl'),
      toggle('Vertical Control', 'vCtrl'),
      combo('Attacker Scope', SCOPES, () => state.atkScope, i => { state.atkScope = i; }, 90),
      combo('Defender Scope', SCOPES, () => state.defScope, i => { state.defScope = i; }, 90),
    ]},
    { title: 'Settings', rows: [
      slider('Horizontal', 'horiz', 0, 10, 0.01, 2),
      slider('Vertical', 'vert', 0, 10, 0.01, 2),
      slider('Humanizer', 'human', 0, 0.9, 0.01, 2),
      slider('Attachment Mult', 'attach', 0, 2, 0.01, 2),
      slider('Start Delay', 'startDelay', 0, 2000, 1, 0, ' ms'),
      slider('Reset Time', 'resetTime', 0, 500, 1, 0, ' ms'),
      slider('Delay Rate', 'delayRate', 1, 50, 1, 0, ' ms'),
    ]},
  ]},
  { name: 'Sensitivity', crumb: 'sensitivity', icon: 'mouse', panels: () => [
    { title: 'Mouse', rows: [
      combo('Mouse Model', MICE, () => state.mouse, i => { state.mouse = i; }, 170),
      slider('DPI', 'dpi', 0, 16000, 50, 0),
      slider('Horizontal Sens', 'hsens', 0, 100, 1, 1),
      slider('Vertical Sens', 'vsens', 0, 100, 1, 1),
      slider('FOV', 'fov', 60, 90, 1, 0),
      slider('Sens Multiplier', 'sensMult', 0.001, 0.2, 0.001, 3),
    ]},
    { title: 'ADS', rows: [
      toggle('Advanced ADS', 'advAds'),
      slider('Global ADS', 'globalAds', 0, 100, 1, 0),
      slider('1x Scope', 'ads1', 0, 100, 1, 0),
      slider('2.5x Scope', 'ads25', 0, 100, 1, 0),
    ]},
  ]},
  { name: 'Display', crumb: 'display', icon: 'grid', panels: () => [
    { title: 'Display', rows: [
      combo('Mode', MODES, () => state.matrixMode, i => { state.matrixMode = i; sendMatrix(); }),
      state.matrixMode === 1 ? lettersRow() : null,
      state.matrixMode === 2 ? combo('Animation', ANIM_NAMES, () => state.anim, i => { state.anim = i; }, 170) : null,
      state.matrixMode === 2 ? slider('Speed', 'animSpeed', 0.25, 3, 0.05, 2, 'x') : null,
      info('Arduino', 'Updates live', 'ok'),
    ]},
    { title: 'Preview', custom: previewGrid },
  ]},
  { name: 'Misc', crumb: 'misc', icon: 'gear', panels: () => [
    { title: 'Input', rows: [
      toggle('Driver Input', 'driverInput'),
      info('Arduino', 'Arduino on COM4 @ 115200 baud'),
      button('Connection', 'Reload', () => toast('Arduino reconnected on COM4')),
    ]},
    { title: 'Controls', rows: [
      keybind('Menu Key', 'menuKey'),
      toggle('Debug Mode', 'debug', () => toast(state.debug ? 'Debug output on' : 'Debug output off')),
    ]},
  ]},
  { name: 'Style', crumb: 'style', icon: 'palette', panels: () => [
    { title: 'Interface', rows: [
      combo('Interface', IFACES, () => state.iface, i => {
        state.iface = i;
        if (i === 1) toast('In the app, Web UI opens on localhost:8000');
      }),
      toggle('Animations', 'anims', () => menu.classList.toggle('no-anim', !state.anims)),
    ]},
    { title: 'Colors', rows: [
      color('Accent', 'accent'),
      color('Background', 'bg'),
      color('Panels', 'panel'),
      color('Text', 'text'),
      color('Controls', 'control'),
      button('Reset Colors', 'Reset', () => { state.colors = { ...DEFAULT_COLORS }; applyColors(); renderPage(false); }),
    ]},
  ]},
];

function renderPage(animate) {
  gridEl = null;
  panelsEl.innerHTML = '';
  PAGES[state.page].panels().forEach(p => {
    const pe = el('div', 'm-panel' + (animate ? ' enter' : ''));
    pe.append(el('div', 'm-panel-head', p.title));
    const body = el('div', 'm-panel-body');
    if (p.custom) body.append(p.custom());
    else p.rows.filter(Boolean).forEach((r, i) => { r.style.setProperty('--i', i); body.append(r); });
    pe.append(body);
    panelsEl.append(pe);
  });
}

// sidebar
const side = $('#m-side');
const hl = $('#m-nav-hl');
const crumb = $('#crumb');
PAGES.forEach((p, i) => {
  const n = el('div', 'm-nav' + (i === state.page ? ' sel' : ''), ICONS[p.icon] + `<span>${p.name}</span>`);
  n.addEventListener('click', () => setPage(i));
  side.append(n);
});
function setPage(i) {
  if (i === state.page) return;
  closePopup(true);
  finishBind(null);
  state.page = i;
  hl.style.transform = `translateY(${i * 55}px)`;
  $$('.m-nav', side).forEach((n, k) => n.classList.toggle('sel', k === i));
  crumb.textContent = PAGES[i].crumb;
  crumb.classList.remove('swap'); void crumb.offsetWidth; crumb.classList.add('swap');
  renderPage(true);
}
renderPage(true);

// colours
function applyColors() {
  const c = state.colors;
  accentRGB = hexToRgb(c.accent);
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--accent-rgb', accentRGB.join(', '));
  root.style.setProperty('--menu-bg', c.bg);
  root.style.setProperty('--panel', c.panel);
  root.style.setProperty('--panel-head', shade(c.panel, .02));
  root.style.setProperty('--text', c.text);
  root.style.setProperty('--control', c.control);
  root.style.setProperty('--control-hov', shade(c.control, .045));
}

// menu key + global keys
function keyName(e) {
  if (e.key === ' ') return 'Space';
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}
function updateMenuKey() {
  $('#m-foot-key').innerHTML = `${state.menuKey}&nbsp;&nbsp;menu toggle`;
  $('#menu-key-hint').textContent = state.menuKey;
  $$('.menu-closed-hint kbd').forEach(k => k.textContent = state.menuKey);
}
function toggleMenu(force) {
  const closed = force !== undefined ? !force : !menu.classList.contains('closed');
  menu.classList.toggle('closed', closed);
  $('#menu-closed-hint').classList.toggle('show', closed);
  closePopup(true);
}
document.addEventListener('keydown', e => {
  if (waiting) {
    e.preventDefault();
    finishBind(e.key === 'Escape' ? 'None' : keyName(e));
    return;
  }
  if (e.key === 'Escape') closePopup();
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (keyName(e) === state.menuKey) { e.preventDefault(); toggleMenu(); }
}, true);
document.addEventListener('mousedown', e => {
  if (!waiting || e.button === 0) return;
  e.preventDefault();
  finishBind(['', 'Mouse 3', 'Mouse 2', 'Mouse 4', 'Mouse 5'][e.button] || null);
}, true);
document.addEventListener('contextmenu', e => { if (waiting) e.preventDefault(); });
$('#reopen').addEventListener('click', () => toggleMenu(true));

// scale the menu to the column width
const stage = $('#stage');
const fit = $('#menu-fit');
const scaleEl = $('#menu-scale');
function fitMenu() {
  const s = Math.min(1, stage.clientWidth / 920);
  scaleEl.style.transform = `scale(${s})`;
  fit.style.width = 920 * s + 'px';
  fit.style.height = 540 * s + 'px';
}
window.addEventListener('resize', fitMenu);
fitMenu();

// ===================================================================== page effects
// rotating accent word in the headline
const ROT_WORDS = ['Controlled', 'Perfected', 'Locked In', 'On Target'];
const rot = $('#rot');
let rotIdx = 0;
function sizeRot() {
  const cur = rot.lastElementChild;
  if (cur) rot.style.width = cur.offsetWidth + 'px';
}
sizeRot();
if (document.fonts) document.fonts.ready.then(sizeRot);
addEventListener('resize', sizeRot);
setInterval(() => {
  rotIdx = (rotIdx + 1) % ROT_WORDS.length;
  const old = rot.lastElementChild;
  const next = el('span', 'in', ROT_WORDS[rotIdx]);
  rot.append(next);
  old.classList.add('out');
  rot.style.width = next.offsetWidth + 'px';
  setTimeout(() => old.remove(), 600);
}, 2800);

// plan picker next to Get Started: flips the price chip
const PLANS = [
  { name: 'Month',    price: '$24.99 / month' },
  { name: 'Lifetime', price: '$79.99 once' },
  { name: 'Week',     price: '$9.99 / week' },
];
let planIdx = 0;
function showPlan(dir) {
  planIdx = (planIdx + dir + PLANS.length) % PLANS.length;
  $('#pk-label').textContent = PLANS[planIdx].name;
  const pr = $('#chip-price');
  pr.textContent = PLANS[planIdx].price;
  pr.classList.remove('flip'); void pr.offsetWidth; pr.classList.add('flip');
}
$('#pk-prev').addEventListener('click', () => showPlan(-1));
$('#pk-next').addEventListener('click', () => showPlan(1));

// scroll reveals: hero items in order, cards in a row one after another
function startReveals() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const n = e.target;
    n.classList.add('in');
    io.unobserve(n);
    setTimeout(() => { n.style.transitionDelay = ''; }, 1500);   // hovers react instantly afterwards
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  let heroIdx = 0;
  $$('[data-reveal]').forEach(n => {
    if (n.closest('.hero')) n.style.transitionDelay = (.1 + heroIdx++ * .12) + 's';
    else if (n.parentElement.matches('.bento, .plans, .specs, .boards, .stats'))
      n.style.transitionDelay = [...n.parentElement.children].indexOf(n) * .1 + 's';
    io.observe(n);
  });
}
startReveals();

// nav: becomes a floating pill on scroll; the highlight follows the section in view
const nav = $('#nav');
const navLinks = $$('#nav-links a');
const navHl = $('#nav-hl');
function spy() {
  nav.classList.toggle('scrolled', scrollY > 40);
  let cur = navLinks[0];
  for (const a of navLinks) {
    const sec = $(a.getAttribute('href'));
    if (sec && sec.getBoundingClientRect().top < innerHeight * .45) cur = a;
  }
  navLinks.forEach(a => a.classList.toggle('active', a === cur));
  navHl.style.width = cur.offsetWidth + 'px';
  navHl.style.transform = `translateX(${cur.offsetLeft}px)`;
}
addEventListener('scroll', spy, { passive: true });
addEventListener('resize', spy);
nav.addEventListener('transitionend', spy);
spy();

// card spotlight
$$('.bcard').forEach(c => c.addEventListener('mousemove', e => {
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  c.style.setProperty('--my', (e.clientY - r.top) + 'px');
}));

// LED matrices in the feature cards cycle through operator names
function lettersToPx(word) {
  const px = new Array(96).fill(false);
  for (let k = 0; k < 3; k++) {
    const g = word[k] && glyph(word[k]);
    if (!g) continue;
    for (let r = 0; r < 5; r++)
      for (let x = 0; x < 3; x++)
        px[(r + 1) * 12 + k * 4 + x] = !!((g[r] >> (2 - x)) & 1);
  }
  return px;
}
function makeLeds(host) {
  const list = [];
  for (let i = 0; i < 96; i++) { const d = document.createElement('i'); host.append(d); list.push(d); }
  return list;
}
const ledSets = [makeLeds($('#bento-matrix')), makeLeds($('#mb-matrix'))];
const OPS_CYCLE = ['ASH', 'ACE', 'IQ', 'ZOF', 'JAG', 'THM', 'SLG'];
let opCycle = 0;
function showOp() {
  const px = lettersToPx(OPS_CYCLE[opCycle]);
  ledSets.forEach(set => set.forEach((d, i) => d.classList.toggle('on', px[i])));
  opCycle = (opCycle + 1) % OPS_CYCLE.length;
}
showOp();
setInterval(showOp, 1700);

// ===================================================================== star sky (inside the hero)
const sky = $('#sky');
const sk = sky.getContext('2d');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
let stars = [], shooters = [], skyW = 0, skyH = 0, nextShooter = 0, skyVisible = true;
const skyMouse = { x: 0, y: 0, tx: 0, ty: 0 };
function makeStars() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  skyW = sky.clientWidth; skyH = sky.clientHeight;
  sky.width = skyW * dpr; sky.height = skyH * dpr;
  sk.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = Math.round(skyW * skyH / 2400);
  stars = Array.from({ length: n }, () => {
    const depth = Math.random();
    return {
      x: Math.random() * skyW, y: Math.random() * skyH,
      r: .3 + depth * 1.3, depth,
      base: .2 + Math.random() * .6,
      speed: .5 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
    };
  });
}
addEventListener('resize', makeStars);
addEventListener('mousemove', e => { skyMouse.tx = e.clientX / innerWidth - .5; skyMouse.ty = e.clientY / innerHeight - .5; }, { passive: true });
new IntersectionObserver(es => es.forEach(e => { skyVisible = e.isIntersecting; })).observe(sky);
makeStars();

function drawSky(t) {
  requestAnimationFrame(drawSky);
  if (!skyVisible) return;
  sk.clearRect(0, 0, skyW, skyH);
  skyMouse.x = lerp(skyMouse.x, skyMouse.tx, .04);
  skyMouse.y = lerp(skyMouse.y, skyMouse.ty, .04);

  for (const s of stars) {
    const px = s.x - skyMouse.x * 30 * s.depth;
    let py = (s.y - scrollY * s.depth * .15 - skyMouse.y * 20 * s.depth) % skyH;
    if (py < 0) py += skyH;
    const tw = calm ? s.base : s.base * (.55 + .45 * Math.sin(t / 1000 * s.speed + s.phase));
    sk.fillStyle = `rgba(255,255,255,${tw})`;
    sk.beginPath(); sk.arc(px, py, s.r, 0, Math.PI * 2); sk.fill();
    if (s.r > 1.25 && tw > .6) {
      sk.fillStyle = `rgba(255,255,255,${tw * .12})`;
      sk.beginPath(); sk.arc(px, py, s.r * 4, 0, Math.PI * 2); sk.fill();
    }
  }

  if (!calm && t > nextShooter) {
    nextShooter = t + 2500 + Math.random() * 4500;
    const fromLeft = Math.random() < .5;
    shooters.push({
      x: fromLeft ? Math.random() * skyW * .5 : skyW * .5 + Math.random() * skyW * .5,
      y: Math.random() * skyH * .35,
      vx: (fromLeft ? 1 : -1) * (7 + Math.random() * 5), vy: 3 + Math.random() * 2.5,
      life: 0, max: 50 + Math.random() * 30,
    });
  }
  shooters = shooters.filter(s => s.life < s.max);
  for (const s of shooters) {
    s.life++; s.x += s.vx; s.y += s.vy;
    const a = Math.sin(Math.PI * s.life / s.max);
    const tail = 14;
    const grad = sk.createLinearGradient(s.x, s.y, s.x - s.vx * tail, s.y - s.vy * tail);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    sk.strokeStyle = grad; sk.lineWidth = 1.6; sk.lineCap = 'round';
    sk.beginPath(); sk.moveTo(s.x, s.y); sk.lineTo(s.x - s.vx * tail, s.y - s.vy * tail); sk.stroke();
  }
}
requestAnimationFrame(drawSky);

// menu pop-in when it scrolls into view
menu.classList.add('pre');
new IntersectionObserver((es, o) => es.forEach(e => {
  if (!e.isIntersecting) return;
  menu.classList.remove('pre');
  o.disconnect();
}), { threshold: .25 }).observe(stage);

applyColors();
updateMenuKey();
})();
