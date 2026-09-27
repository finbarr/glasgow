// Canvas-drawn textures that need lettering or graphics: station signage,
// departure boards, clock faces and a shop-fascia atlas.
import * as THREE from 'three';

function tex(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

export function clockFace() {
  const s = 512, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, s, s);
  g.translate(s / 2, s / 2);
  g.fillStyle = '#f2eee2';
  g.beginPath(); g.arc(0, 0, s * 0.47, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1a1a1a'; g.lineWidth = 10;
  g.beginPath(); g.arc(0, 0, s * 0.45, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#111';
  g.font = `bold ${s * 0.07}px Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.fillText(numerals[i], 0, -s * 0.36);
    g.fillRect(-3, -s * 0.445, 6, s * 0.03);
    g.restore();
  }
  // hands at ten past ten
  const hand = (ang, len, w) => {
    g.save(); g.rotate(ang); g.fillRect(-w / 2, -len, w, len + s * 0.04); g.restore();
  };
  hand((10 / 12) * Math.PI * 2 + (10 / 60) * (Math.PI * 2) / 12, s * 0.24, 14);
  hand((10 / 60) * Math.PI * 2, s * 0.36, 9);
  g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill();
  return tex(c);
}

export function lettering(text, { w = 2048, h = 256, bg = '#15233f', fg = '#e9dcb4', font = 'Georgia, serif', weight = 'bold', size = 0.62, border = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border; g.lineWidth = h * 0.05;
    g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
  }
  g.fillStyle = fg;
  g.font = `${weight} ${Math.round(h * size)}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // letter-spaced
  const spaced = text.split('').join(String.fromCharCode(8202));
  g.fillText(spaced, w / 2, h / 2 + h * 0.04, w * 0.94);
  return tex(c);
}

const DESTS = [
  ['07:42', 'Edinburgh', '11'], ['07:45', 'London Euston', '1'], ['07:48', 'Ayr', '12'],
  ['07:50', 'Gourock', '13'], ['07:51', 'East Kilbride', '9'], ['07:54', 'Largs', '14'],
  ['07:56', 'Neilston', '6'], ['07:58', 'Paisley Gilmour St', '10'], ['08:01', 'Cathcart Circle', '7'],
  ['08:03', 'Wemyss Bay', '15'], ['08:05', 'Kilmarnock', '8'], ['08:08', 'Carlisle', '2'],
  ['08:10', 'Lanark', '5'], ['08:12', 'Barrhead', '4'], ['08:15', 'Newton', '3'],
];

export function departureBoard() {
  const w = 2048, h = 512, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
  const cols = 3, rows = 5;
  const cw = w / cols, rh = h / (rows + 1);
  g.fillStyle = '#10213d'; g.fillRect(0, 0, w, rh * 0.85);
  g.fillStyle = '#ffffff';
  g.font = `bold ${rh * 0.5}px Helvetica, Arial, sans-serif`;
  g.textBaseline = 'middle';
  g.fillText('Departures', 30, rh * 0.45);
  g.textAlign = 'right';
  g.fillText('07:40', w - 30, rh * 0.45);
  g.textAlign = 'left';
  let k = 0;
  for (let col = 0; col < cols; col++) {
    for (let r = 0; r < rows; r++) {
      const [t, d, p] = DESTS[k++ % DESTS.length];
      const x = col * cw + 24, y = rh * (r + 1.5);
      g.fillStyle = '#ffb000';
      g.font = `${rh * 0.46}px "Courier New", monospace`;
      g.fillText(t, x, y);
      g.fillText(d, x + cw * 0.22, y, cw * 0.55);
      g.fillStyle = '#ffffff';
      g.fillText(p, x + cw * 0.84, y);
    }
    g.fillStyle = '#222'; g.fillRect((col + 1) * cw - 3, rh, 6, h);
  }
  const t = tex(c);
  return t;
}

// Generic shop names (no real brands).
const SHOPS = [
  'CAFÉ', 'BOOKS', 'PHARMACY', 'NEWSAGENT', 'OPTICIANS', 'BARBER', 'BAKERY', 'TOBACCONIST',
  'THE STATION BAR', 'JEWELLERS', 'CARDS & GIFTS', 'SHOES', 'FLORIST', 'DELI', 'KILTMAKERS',
  'OUTFITTERS', 'TRAVEL', 'BANK', 'ESTATE AGENTS', 'SANDWICH BAR', 'FISH & CHIPS', 'CURRY HOUSE',
  'WHISKY SHOP', 'MUSIC', 'MOBILE PHONES', 'HAIR SALON', 'TAILOR', 'PUB', 'BISTRO', 'PIZZA',
  'NAIL BAR', 'HOTEL',
];
const FASCIA = [
  ['#11261c', '#e8d9a8'], ['#1b2a4a', '#f3f0e6'], ['#0d0d0d', '#e8c872'], ['#5a1420', '#f1e7d0'],
  ['#f2efe6', '#1c1c1c'], ['#244a3a', '#ffffff'], ['#6b1a1a', '#ffffff'], ['#2d2d2d', '#ffcc33'],
  ['#e8e2d0', '#6b1a1a'], ['#123a5a', '#ffffff'], ['#3b2a1a', '#e8d9a8'], ['#b4262b', '#ffffff'],
];

export const FASCIA_ATLAS = { cols: 4, rows: 8 };

export function fasciaAtlas() {
  const { cols, rows } = FASCIA_ATLAS;
  const cw = 512, ch = 96;
  const c = document.createElement('canvas');
  c.width = cols * cw; c.height = rows * ch;
  const g = c.getContext('2d');
  let k = 0;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const [bg, fg] = FASCIA[(k * 7) % FASCIA.length];
    const name = SHOPS[k % SHOPS.length];
    const x = q * cw, y = r * ch;
    g.fillStyle = bg; g.fillRect(x, y, cw, ch);
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, cw - 12, ch - 12);
    g.fillStyle = fg;
    const serif = k % 3 === 0;
    g.font = `${serif ? '' : 'bold '}${ch * 0.48}px ${serif ? 'Georgia, serif' : 'Helvetica, Arial, sans-serif'}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, x + cw / 2, y + ch / 2 + 3, cw * 0.86);
    k++;
  }
  const t = tex(c);
  return t;
}

/** uv rect [u0,v0,u1,v1] in atlas for index */
export function fasciaUV(i) {
  const { cols, rows } = FASCIA_ATLAS;
  const k = ((i % (cols * rows)) + cols * rows) % (cols * rows);
  const q = k % cols, r = Math.floor(k / cols);
  const u0 = q / cols, u1 = (q + 1) / cols;
  const v1 = 1 - r / rows, v0 = 1 - (r + 1) / rows;
  return [u0, v0, u1, v1];
}

/** Dark blue commuter livery with a continuous window band and saltire-style ends. */
export function trainLivery() {
  const w = 2048, h = 256, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#22346a'); grad.addColorStop(1, '#162552');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // continuous window band
  g.fillStyle = '#0b0f16';
  g.fillRect(0, h * 0.2, w, h * 0.34);
  g.fillStyle = 'rgba(160,180,200,0.12)';
  for (let x = 60; x < w - 60; x += 150) g.fillRect(x, h * 0.21, 4, h * 0.32);
  // saltire stripes near each end
  g.strokeStyle = '#f4f6fb'; g.lineWidth = 12;
  for (const x0 of [30, w - 330]) {
    g.beginPath(); g.moveTo(x0, h * 0.95); g.lineTo(x0 + 300, h * 0.58); g.stroke();
    g.beginPath(); g.moveTo(x0, h * 0.58); g.lineTo(x0 + 300, h * 0.95); g.stroke();
  }
  // doors
  for (const x of [w * 0.3, w * 0.66]) {
    g.fillStyle = '#1b2b5e'; g.fillRect(x, h * 0.08, 90, h * 0.88);
    g.strokeStyle = '#0a0f1a'; g.lineWidth = 3; g.strokeRect(x, h * 0.08, 90, h * 0.88);
    g.fillStyle = '#0b0f16'; g.fillRect(x + 12, h * 0.2, 28, h * 0.32); g.fillRect(x + 50, h * 0.2, 28, h * 0.32);
    g.fillStyle = '#e8b400'; g.fillRect(x - 6, h * 0.08, 6, h * 0.88); g.fillRect(x + 90, h * 0.08, 6, h * 0.88);
  }
  return tex(c);
}

/** Blurry lit-room interior seen through a window (used by glass at night). */
export function roomInterior(seed = 1) {
  const w = 256, h = 256, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // four variants in quadrants: plain room, curtains, blinds, office
  const quad = (qx, qy, kind) => {
    const x0 = qx * 128, y0 = qy * 128;
    const grad = g.createLinearGradient(0, y0, 0, y0 + 128);
    grad.addColorStop(0, '#fff1d6'); grad.addColorStop(0.35, '#d9b88a'); grad.addColorStop(1, '#5a4330');
    g.fillStyle = grad; g.fillRect(x0, y0, 128, 128);
    // back wall furniture silhouettes
    g.fillStyle = 'rgba(40,28,20,0.55)';
    for (let i = 0; i < 3; i++) g.fillRect(x0 + r() * 100, y0 + 70 + r() * 20, 20 + r() * 30, 40);
    if (kind === 1) { g.fillStyle = 'rgba(120,40,40,0.85)'; g.fillRect(x0, y0, 26, 128); g.fillRect(x0 + 102, y0, 26, 128); }
    if (kind === 2) { g.fillStyle = 'rgba(235,225,205,0.8)'; for (let y = 0; y < 60; y += 5) g.fillRect(x0, y0 + y, 128, 3); }
    if (kind === 3) { g.fillStyle = 'rgba(255,255,245,0.9)'; g.fillRect(x0 + 20, y0 + 6, 88, 6); g.fillStyle = 'rgba(60,70,80,0.6)'; g.fillRect(x0 + 10, y0 + 80, 108, 10); }
  };
  quad(0, 0, 0); quad(1, 0, 1); quad(0, 1, 2); quad(1, 1, 3);
  const t = tex(c);
  return t;
}

export function shopInterior() {
  const w = 256, h = 256, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#f4ead8'); grad.addColorStop(1, '#8d7a63');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // shelving and displays
  for (let x = 8; x < w; x += 64) {
    g.fillStyle = 'rgba(70,55,40,0.55)'; g.fillRect(x, 90, 48, 150);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let y = 100; y < 230; y += 26) g.fillRect(x + 3, y, 42, 4);
    const hue = (x * 37) % 360;
    g.fillStyle = `hsla(${hue},30%,50%,0.6)`;
    for (let y = 104; y < 230; y += 26) g.fillRect(x + 6, y + 6, 36, 12);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, h);
  // ceiling spots
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let x = 20; x < w; x += 44) { g.beginPath(); g.arc(x, 12, 6, 0, Math.PI * 2); g.fill(); }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
