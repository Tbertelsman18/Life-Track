// The app background: an original, flat illustration (Beach, Mountains or
// Forest) whose sky follows the real time of day in St. Louis: sunrise, a
// sunny sky in the daytime, sunset, and a moonlit sky at night.
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
    sunrise: { hillFar: '#8a86a8', hillNear: '#5f6b7c', treeFar: '#4c5968', treeNear: '#2c3440', leaf: '#4a5d5a', leafLight: '#6d8072', trunk: '#3a3238', grass: '#56685a', ground: '#b9bfae' },
    day: { hillFar: '#8cc79a', hillNear: '#5aa46c', treeFar: '#3c8a52', treeNear: '#1f6a3c', leaf: '#2f8a4a', leafLight: '#55b468', trunk: '#6b4a2f', grass: '#4d9a52', ground: '#a9cf95' },
    sunset: { hillFar: '#9a6a7a', hillNear: '#5e4a5c', treeFar: '#3f3044', treeNear: '#211a27', leaf: '#4a3a40', leafLight: '#6e5250', trunk: '#2a1f26', grass: '#4a3b3f', ground: '#c9b2a4' },
    night: { hillFar: '#24345a', hillNear: '#1a2945', treeFar: '#122036', treeNear: '#0a1424', leaf: '#132a33', leafLight: '#1f3c44', trunk: '#0c1420', grass: '#14263a', ground: '#8f9ca6' },
  },
};

// ---------------------------------------------------------------- sun times
// Real sunrise and sunset for St. Louis, worked out from the date (NOAA's
// simple formula), so the sky matches what it looks like outside all year.
const LAT = 38.627, LON = -90.199;
const RAD = Math.PI / 180;

function sunTimes(date) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  const n = Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 1)) / 864e5) + 1;
  const g = (2 * Math.PI / 365) * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(LAT * RAD) * Math.cos(decl)) - Math.tan(LAT * RAD) * Math.tan(decl)) / RAD;
  const at = (mins) => new Date(Date.UTC(y, m, d) + mins * 60000);
  return { rise: at(720 - 4 * (LON + ha) - eq), set: at(720 - 4 * (LON - ha) - eq) };
}

const MIN = 60000;
// Which part of the day it is, and how far the sun (or moon) is across the sky (0–1).
function skyNow(now) {
  const today = sunTimes(now);
  const rise = today.rise.getTime(), set = today.set.getTime(), t0 = now.getTime();
  const across = (a, b) => Math.min(1, Math.max(0, (t0 - a) / (b - a)));
  if (t0 >= rise - 40 * MIN && t0 < rise + 60 * MIN) return { phase: 'sunrise', t: across(rise, set) };
  if (t0 >= rise + 60 * MIN && t0 < set - 60 * MIN) return { phase: 'day', t: across(rise, set) };
  if (t0 >= set - 60 * MIN && t0 < set + 30 * MIN) return { phase: 'sunset', t: across(rise, set) };
  // Night: the moon crosses from after dusk to before dawn
  let dusk, dawn;
  if (t0 >= set) {
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    dusk = set + 30 * MIN; dawn = sunTimes(tomorrow).rise.getTime() - 40 * MIN;
  } else {
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    dusk = sunTimes(yesterday).set.getTime() + 35 * MIN; dawn = rise - 40 * MIN;
  }
  return { phase: 'night', t: across(dusk, dawn) };
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

// A round leafy tree: trunk plus a cloud of overlapping circles. (x, base y, height)
function leafy(x, y, h, p) {
  const r = h * 0.3;
  const cy = y - h * 0.62;
  return `<rect x="${x - h * 0.04}" y="${y - h * 0.45}" width="${h * 0.08}" height="${h * 0.45}" fill="${p.trunk}"/>
    <circle cx="${x - r * 0.7}" cy="${cy + r * 0.25}" r="${r * 0.8}" fill="${p.leaf}"/>
    <circle cx="${x + r * 0.7}" cy="${cy + r * 0.25}" r="${r * 0.8}" fill="${p.leaf}"/>
    <circle cx="${x}" cy="${cy - r * 0.2}" r="${r}" fill="${p.leaf}"/>
    <circle cx="${x - r * 0.3}" cy="${cy - r * 0.45}" r="${r * 0.45}" fill="${p.leafLight}"/>`;
}

function forest(p) {
  const H = HORIZON;
  // Far hills: a soft treeline of round tops with a few pines
  const farTops = [140, 158, 176, 194, 212, 230, 248, 266, 284].map((x, i) =>
    `<circle cx="${x}" cy="${206 + (i % 3) * 3}" r="${11 + (i % 2) * 3}" fill="${p.treeFar}"/>`).join('');
  return `
    <path d="M0 ${H} L0 214 C 70 196, 140 210, 200 204 S 330 192, 400 210 L400 ${H}Z" fill="${p.hillFar}"/>
    ${farTops}
    ${[[130, 214, 36], [300, 214, 34]].map(([x, y, h]) => pine(x, y, h, p.treeFar)).join('')}
    <path d="M0 ${H + 10} L0 236 C 80 222, 170 240, 240 232 S 350 220, 400 232 L400 ${H + 10}Z" fill="${p.hillNear}"/>
    ${[[110, 244, 44], [150, 248, 36], [254, 246, 40], [292, 244, 46]].map(([x, y, h]) => leafy(x, y, h, p)).join('')}
    <path d="M0 ${H + 2} C 90 ${H - 8}, 180 ${H + 8}, 260 ${H} S 360 ${H - 6}, 400 ${H} L400 ${H + 90} L0 ${H + 90}Z" fill="${p.grass}"/>
    <rect y="${H + 88}" width="400" height="${480 - H - 88}" fill="url(#ground)"/>
    ${[[16, 300, 120], [52, 296, 92], [350, 298, 112], [386, 302, 96]].map(([x, y, h]) => pine(x, y, h * 1.25, p.treeNear)).join('')}
    ${[[88, 300, 70], [318, 300, 66]].map(([x, y, h]) => leafy(x, y, h, { ...p, leaf: p.treeNear, leafLight: p.leaf })).join('')}
    <path d="M0 ${H + 84} C 20 ${H + 66}, 50 ${H + 66}, 64 ${H + 84} C 76 ${H + 70}, 100 ${H + 72}, 108 ${H + 86} L0 ${H + 92}Z
             M300 ${H + 86} C 310 ${H + 70}, 336 ${H + 68}, 346 ${H + 82} C 358 ${H + 66}, 390 ${H + 66}, 400 ${H + 80} L400 ${H + 92}Z" fill="${p.treeNear}"/>`;
}

// ---------------------------------------------------------------- drawing
function sceneSVG(name, now) {
  const { phase, t } = skyNow(now);
  const sky = SKY[phase];
  const p = LAND[name][phase];

  // The sun travels across the sky from sunrise to sunset; the moon at night.
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
  document.body.dataset.phase = skyNow(now).phase;
  el.innerHTML = sceneSVG(name, now);
}

export function startScene() {
  paintScene();
  setInterval(paintScene, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paintScene(); });
}
