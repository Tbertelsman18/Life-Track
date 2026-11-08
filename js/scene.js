// The app background: an original, flat illustration (Beach, Mountains or
// Forest) whose sky follows the time of day: sunrise in the morning, a sunny
// sky in the daytime, a sunset in the evening and a moonlit sky at night.
// Pick the scene in More → Settings (settings.scene; 'off' turns it off).

import * as S from './store.js';

export const SCENES = [['beach', 'Beach'], ['mountains', 'Mountains'], ['forest', 'Forest'], ['off', 'Off']];

// Sky colors for each part of the day (shared by every scene).
const SKY = {
  sunrise: { sky: ['#3d4f8f', '#e58aa3', '#ffc98f'], sun: '#ffe6a6', glow: '#ffb27a' },
  day: { sky: ['#2b8fe6', '#63c1f5', '#c3ecff'], sun: '#fff7c9', glow: '#fff1a8' },
  sunset: { sky: ['#2a2d66', '#d0607a', '#ffb257'], sun: '#ffd36a', glow: '#ff9a4a' },
  night: { sky: ['#0a1330', '#18295a', '#33477e'], sun: '#f4f1e4', glow: '#9fb4ff' },
};

// Each scene's own colors for each part of the day.
const LAND = {
  beach: {
    sunrise: { sea: ['#7d7fb6', '#f3a98c'], island: '#4a3e62', palm: '#2c2338', trunk: '#2c2338', ground: '#f2d7bd', shore: '#fbe7d6' },
    day: { sea: ['#1497c2', '#43d0d6'], island: '#3f8a6c', palm: '#1d7a4b', trunk: '#8b6640', ground: '#f6e2bd', shore: '#ffffff' },
    sunset: { sea: ['#4c3c70', '#f08a4a'], island: '#2e2140', palm: '#1d1524', trunk: '#1d1524', ground: '#ebc8a2', shore: '#ffd9b8' },
    night: { sea: ['#122050', '#26407a'], island: '#0e1430', palm: '#080b1c', trunk: '#080b1c', ground: '#cdbfa8', shore: '#9fb0d8' },
  },
  mountains: {
    sunrise: { far: '#a28cbc', mid: '#6d5c8f', near: '#41365f', snow: '#ffe3d6', lake: ['#8b86bd', '#f2b096'], pine: '#2b2440', ground: '#ddd0dc' },
    day: { far: '#a9c6e2', mid: '#6f95bb', near: '#3f6b8d', snow: '#ffffff', lake: ['#3d8fc4', '#7cc7e0'], pine: '#1f5a3f', ground: '#dde9e4' },
    sunset: { far: '#a86d8c', mid: '#6f4571', near: '#3b2747', snow: '#ffd2b0', lake: ['#6a4a7c', '#f09a5c'], pine: '#22152a', ground: '#e3cbc6' },
    night: { far: '#2e3d6d', mid: '#1f2c55', near: '#131c3c', snow: '#c9d4f2', lake: ['#16244f', '#2c4580'], pine: '#0a0f22', ground: '#bcc4d2' },
  },
  forest: {
    sunrise: { hillFar: '#9480aa', hillNear: '#625d7e', treeFar: '#4f486a', treeNear: '#2e2a40', ground: '#e4d8cb' },
    day: { hillFar: '#93caa0', hillNear: '#62a872', treeFar: '#3f8b56', treeNear: '#1d5c37', ground: '#e2edd5' },
    sunset: { hillFar: '#a76c7e', hillNear: '#6e4b63', treeFar: '#4b3049', treeNear: '#24162a', ground: '#e6d0c1' },
    night: { hillFar: '#26345f', hillNear: '#1b2749', treeFar: '#131b37', treeNear: '#0a0f22', ground: '#c0c7ca' },
  },
};

function phaseFor(h) {
  if (h >= 5.5 && h < 8.5) return 'sunrise';
  if (h >= 8.5 && h < 17) return 'day';
  if (h >= 17 && h < 20.5) return 'sunset';
  return 'night';
}

const HORIZON = 252;

// ---------------------------------------------------------------- shapes
// Palm fronds: tapered leaf shapes fanning out from the top of the trunk.
function fronds(cx, cy, color) {
  const leaves = [
    [-170, 92, 26], [-145, 108, 30], [-118, 96, 22], [-80, 84, 16], [-45, 104, 22],
    [-20, 116, 32], [8, 98, 40], [-200, 70, 34], [30, 80, 52],
  ];
  return leaves.map(([deg, len, droop]) => {
    const a = (deg * Math.PI) / 180;
    const tx = cx + Math.cos(a) * len;
    const ty = cy + Math.sin(a) * len + droop;
    const mx = cx + Math.cos(a) * len * 0.55;
    const my = cy + Math.sin(a) * len * 0.55 - 6;
    const nx = -Math.sin(a) * 11, ny = Math.cos(a) * 11;
    return `<path d="M${cx},${cy} Q${mx + nx},${my + ny} ${tx},${ty} Q${mx - nx * 0.4},${my - ny * 0.4 + 8} ${cx},${cy}Z" fill="${color}"/>`;
  }).join('');
}

// A simple pine: three stacked triangles on a short trunk. (x, base y, height)
function pine(x, y, h, color) {
  const w = h * 0.42;
  const tiers = [[0, 1], [0.28, 0.82], [0.52, 0.62]].map(([up, wide]) => {
    const top = y - h * (0.42 + up);
    const bottom = y - h * (up * 0.95) - h * 0.08;
    return `<path d="M${x},${top} L${x + w * wide},${bottom} L${x - w * wide},${bottom}Z" fill="${color}"/>`;
  }).join('');
  return `<rect x="${x - h * 0.035}" y="${y - h * 0.1}" width="${h * 0.07}" height="${h * 0.1}" fill="${color}"/>${tiers}`;
}

// Snow on a mountain peak: follows both slopes a third of the way down,
// with a slightly uneven bottom edge.
function snowCap(px, py, lx, ly, rx, ry, color, f = 0.46) {
  const L = [px + (lx - px) * f, py + (ly - py) * f];
  const R = [px + (rx - px) * f, py + (ry - py) * f];
  const at = (k, lift) => [L[0] + (R[0] - L[0]) * k, L[1] + (R[1] - L[1]) * k - lift];
  const pts = [[px, py], R, at(0.75, 5), at(0.5, -2), at(0.25, 6), L];
  return `<path d="M${pts.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' L')}Z" fill="${color}"/>`;
}

// ---------------------------------------------------------------- scenes
function beach(p, sunX, sunY, sunColor, low) {
  const H = HORIZON;
  const shimmer = sunY < H - 4
    ? [0, 1, 2, 3, 4].map((i) => `<rect x="${sunX - (26 - i * 4)}" y="${H + 6 + i * 9}" width="${52 - i * 8}" height="2.4" rx="1.2" fill="${sunColor}" opacity="${(low ? 0.75 : 0.5) - i * 0.1}"/>`).join('')
    : '';
  return `
    <path d="M250 ${H} C 280 ${H - 22}, 310 ${H - 30}, 336 ${H - 18} S 380 ${H - 8}, 400 ${H - 12} L400 ${H}Z" fill="${p.island}"/>
    <rect y="${H}" width="400" height="70" fill="url(#water)"/>
    ${shimmer}
    <path d="M0 ${H + 58} C 80 ${H + 50}, 160 ${H + 64}, 240 ${H + 56} S 360 ${H + 50}, 400 ${H + 56} L400 ${H + 62} C 330 ${H + 58}, 250 ${H + 70}, 160 ${H + 66} S 40 ${H + 60}, 0 ${H + 66}Z" fill="${p.shore}" opacity="0.8"/>
    <rect y="${H + 62}" width="400" height="${480 - H - 62}" fill="url(#ground)"/>
    <path d="M8 480 C 20 400, 44 292, 80 190 L89 193 C 56 294, 36 400, 26 480Z" fill="${p.trunk}"/>
    ${fronds(84, 188, p.palm)}`;
}

function mountains(p, sunX, sunY, sunColor, low) {
  const H = HORIZON;
  const shimmer = sunY < H - 30
    ? [0, 1, 2].map((i) => `<rect x="${sunX - (20 - i * 5)}" y="${H + 10 + i * 9}" width="${40 - i * 10}" height="2.2" rx="1.1" fill="${sunColor}" opacity="${(low ? 0.6 : 0.4) - i * 0.12}"/>`).join('')
    : '';
  return `
    <path d="M0 ${H} L0 196 L48 160 L92 186 L132 146 L176 196 L214 208 L250 172 L290 142 L332 178 L368 156 L400 172 L400 ${H}Z" fill="${p.far}"/>
    ${snowCap(48, 160, 0, 196, 92, 186, p.snow)}${snowCap(132, 146, 92, 186, 176, 196, p.snow)}${snowCap(290, 142, 250, 172, 332, 178, p.snow)}
    <path d="M0 ${H} L0 212 L40 196 L86 222 L130 200 L178 230 L222 226 L262 204 L306 222 L352 198 L400 214 L400 ${H}Z" fill="${p.mid}"/>
    <path d="M0 ${H} L0 230 L36 222 L70 238 L120 228 L160 246 L230 244 L280 232 L330 244 L372 230 L400 236 L400 ${H}Z" fill="${p.near}"/>
    <rect y="${H}" width="400" height="56" fill="url(#water)"/>
    ${shimmer}
    ${[[300, H + 2, 22], [318, H + 3, 30], [340, H + 2, 18], [356, H + 3, 26], [378, H + 2, 20]].map(([x, y, h]) => pine(x, y, h, p.pine)).join('')}
    <path d="M0 ${H + 52} C 90 ${H + 46}, 200 ${H + 58}, 300 ${H + 50} S 380 ${H + 48}, 400 ${H + 52} L400 480 L0 480Z" fill="url(#ground)"/>
    ${[[30, 430, 150], [70, 400, 96], [362, 420, 104]].map(([x, y, h]) => pine(x, y, h, p.pine)).join('')}`;
}

function forest(p) {
  const H = HORIZON;
  const far = [[150, 206, 34], [176, 212, 26], [210, 204, 40], [244, 214, 28], [266, 208, 36], [300, 214, 26]];
  const near = [[0, 250, 92], [26, 246, 120], [60, 252, 84], [324, 250, 96], [356, 246, 128], [392, 252, 90]];
  return `
    <path d="M0 ${H} L0 214 C 70 196, 140 210, 200 204 S 330 192, 400 210 L400 ${H}Z" fill="${p.hillFar}"/>
    ${far.map(([x, y, h]) => pine(x, y, h, p.treeFar)).join('')}
    <path d="M0 ${H + 10} L0 236 C 80 222, 170 240, 240 232 S 350 220, 400 232 L400 ${H + 10}Z" fill="${p.hillNear}"/>
    ${[[96, 238, 46], [124, 242, 34], [276, 236, 44], [300, 240, 32]].map(([x, y, h]) => pine(x, y, h, p.treeFar)).join('')}
    <rect y="${H}" width="400" height="${480 - H}" fill="url(#ground)"/>
    ${near.map(([x, y, h]) => pine(x, y + 40, h * 1.2, p.treeNear)).join('')}`;
}

// ---------------------------------------------------------------- drawing
function sceneSVG(name, now) {
  const h = now.getHours() + now.getMinutes() / 60;
  const phase = phaseFor(h);
  const sky = SKY[phase];
  const p = LAND[name][phase];

  // Sun travels across the sky from about 6am to 7pm; the moon at night.
  let t;
  if (phase === 'night') t = ((h < 12 ? h + 24 : h) - 20.5) / 9; // 8:30pm → 5:30am
  else t = (h - 6) / 13;
  t = Math.min(1, Math.max(0, t));
  const sunX = 40 + t * 320;
  // Keep the sun inside the open window under the header so it's always in view
  const rise = name === 'beach' ? 58 : 82;
  const sunY = HORIZON + 6 - Math.sin(Math.PI * t) * rise;
  const r = phase === 'night' ? 13 : phase === 'day' ? 20 : 24;
  const low = phase === 'sunrise' || phase === 'sunset';

  const stars = phase === 'night'
    ? [[30, 30], [80, 70], [140, 24], [200, 58], [255, 22], [300, 80], [350, 40], [380, 110], [110, 150], [230, 130], [320, 190], [180, 160], [60, 200], [370, 215]]
      .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.5}" fill="#fff" opacity="${i % 2 ? 0.6 : 0.9}"/>`).join('')
    : '';
  const cy = name === 'beach' ? 196 : 150;
  const clouds = phase === 'night' ? '' : `
    <g fill="#fff" opacity="${phase === 'day' ? 0.85 : 0.35}">
      <ellipse cx="290" cy="128" rx="40" ry="10"/><ellipse cx="310" cy="120" rx="24" ry="10"/>
      <ellipse cx="170" cy="${cy}" rx="32" ry="7"/><ellipse cx="186" cy="${cy - 6}" rx="16" ry="7"/>
    </g>`;
  const water = p.sea || p.lake || ['#000', '#000'];
  const land = name === 'beach' ? beach(p, sunX, sunY, sky.sun, low)
    : name === 'mountains' ? mountains(p, sunX, sunY, sky.sun, low)
    : forest(p);

  return `
  <svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${sky.sky[0]}"/><stop offset="0.62" stop-color="${sky.sky[1]}"/><stop offset="1" stop-color="${sky.sky[2]}"/>
      </linearGradient>
      <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${water[0]}"/><stop offset="1" stop-color="${water[1]}"/>
      </linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.ground}"/><stop offset="0.55" stop-color="${p.ground}" stop-opacity="0.7"/><stop offset="1" stop-color="${p.ground}" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="${sky.glow}" stop-opacity="0.75"/><stop offset="1" stop-color="${sky.glow}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="400" height="${HORIZON + 4}" fill="url(#sky)"/>
    ${stars}
    <circle cx="${sunX}" cy="${sunY}" r="${r * 3.4}" fill="url(#glow)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${r}" fill="${sky.sun}"/>
    ${phase === 'night' ? `<circle cx="${sunX + 6}" cy="${sunY - 4}" r="${r}" fill="${sky.sky[1]}" opacity="0.9"/>` : ''}
    ${clouds}
    ${land}
  </svg>`;
}

export function currentScene() {
  const st = S.getData().settings;
  if (st.scene) return st.scene;
  return st.beach === false ? 'off' : 'beach'; // older setting
}

// Draws (or redraws) the background.
export function paintScene() {
  const el = document.getElementById('scene');
  if (!el) return;
  const name = currentScene();
  const on = name !== 'off' && Boolean(LAND[name]);
  document.body.classList.toggle('beach', on); // "beach" = any scene is showing
  document.documentElement.classList.toggle('beach', on);
  document.documentElement.dataset.scene = on ? name : '';
  if (!on) { el.innerHTML = ''; return; }
  const now = new Date();
  document.body.dataset.phase = phaseFor(now.getHours() + now.getMinutes() / 60);
  el.innerHTML = sceneSVG(name, now);
}

export function startScene() {
  paintScene();
  setInterval(paintScene, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paintScene(); });
}
