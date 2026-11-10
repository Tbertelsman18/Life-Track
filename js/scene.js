// The app background: an original, flat illustration (Beach, Mountains or
// Forest with a campfire) whose sky follows the real time of day in St. Louis: sunrise, a
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
    night: { sea: ['#122050', '#26407a'], island: '#0e1430', palm: '#080b1c', trunk: '#080b1c', ground: '#3b4566', shore: '#7f90c0' },
  },
  mountains: {
    sunrise: { far: '#a28cbc', mid: '#6d5c8f', near: '#41365f', snow: '#ffe3d6', lake: ['#8b86bd', '#f2b096'], pine: '#2b2440', ground: '#ddd0dc' },
    day: { far: '#a9c6e2', mid: '#6f95bb', near: '#3f6b8d', snow: '#ffffff', lake: ['#3d8fc4', '#7cc7e0'], pine: '#1f5a3f', ground: '#dde9e4' },
    sunset: { far: '#a86d8c', mid: '#6f4571', near: '#3b2747', snow: '#ffd2b0', lake: ['#6a4a7c', '#f09a5c'], pine: '#22152a', ground: '#e3cbc6' },
    night: { far: '#2e3d6d', mid: '#1f2c55', near: '#131c3c', snow: '#c9d4f2', lake: ['#16244f', '#2c4580'], pine: '#0a0f22', ground: '#bcc4d2' },
  },
  // Forest: misty ridges, a pine-lined clearing and a campfire (brighter as it gets dark).
  forest: {
    sunrise: { ridgeFar: '#a593b8', ridgeNear: '#7a6c96', mist: '#f6d2c8', treeFar: '#5a5576', treeMid: '#3a3a55', treeNear: '#221f33',
      grass: '#6b6a6c', ground: '#c9b9b0', log: '#3a2a2a', stone: '#8a7f86', fire: 0.8 },
    day: { ridgeFar: '#a9c4c9', ridgeNear: '#7fa3a0', mist: '#eef6f2', treeFar: '#4f8068', treeMid: '#2e5e45', treeNear: '#1b3d2c',
      grass: '#7c9c62', ground: '#b9c79a', log: '#6b4a32', stone: '#9a9a90', fire: 0.55 },
    sunset: { ridgeFar: '#b07a8e', ridgeNear: '#7d5272', mist: '#ffc7a0', treeFar: '#553a55', treeMid: '#38253d', treeNear: '#1f1524',
      grass: '#5b4148', ground: '#c9a898', log: '#2e1d22', stone: '#7a6268', fire: 0.95 },
    night: { ridgeFar: '#2c3b66', ridgeNear: '#1f2b50', mist: '#4a5a8a', treeFar: '#16213e', treeMid: '#0f182e', treeNear: '#080d1c',
      grass: '#16223a', ground: '#7c8796', log: '#1a1418', stone: '#3b4256', fire: 1 },
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
const GLOW = 30 * MIN; // how long the sunrise/sunset colors last on each side of the sun crossing the horizon
// Which part of the day it is, and how far the sun (or moon) is across the sky (0–1).
function skyNow(now) {
  const today = sunTimes(now);
  const rise = today.rise.getTime(), set = today.set.getTime(), t0 = now.getTime();
  const across = (a, b) => Math.min(1, Math.max(0, (t0 - a) / (b - a)));
  // Colors match the real sky: sunrise/sunset glow from 30 min before to 30 min after
  // (it's dark about 30 min after sunset), bright daytime in between.
  if (t0 >= rise - GLOW && t0 < rise + GLOW) return { phase: 'sunrise', t: across(rise, set) };
  if (t0 >= rise + GLOW && t0 < set - GLOW) return { phase: 'day', t: across(rise, set) };
  if (t0 >= set - GLOW && t0 < set + GLOW) return { phase: 'sunset', t: across(rise, set) };
  // Night: the moon crosses from after dusk to before dawn
  let dusk, dawn;
  if (t0 >= set) {
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    dusk = set + GLOW; dawn = sunTimes(tomorrow).rise.getTime() - GLOW;
  } else {
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    dusk = sunTimes(yesterday).set.getTime() + GLOW; dawn = rise - GLOW;
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
function beach(p, sunX, sunY, sunColor, low, phase) {
  const H = HORIZON;
  const shimmer = sunY < H - 4
    ? [0, 1, 2, 3, 4].map((i) => `<rect x="${sunX - (26 - i * 4)}" y="${H + 6 + i * 9}" width="${52 - i * 8}" height="2.4" rx="1.2" fill="${sunColor}" opacity="${(low ? 0.75 : 0.5) - i * 0.1}"/>`).join('')
    : '';
  return `
    <path d="M250 ${H} C 280 ${H - 22}, 310 ${H - 30}, 336 ${H - 18} S 380 ${H - 8}, 400 ${H - 12} L400 ${H}Z" fill="${p.island}"/>
    <rect y="${H}" width="400" height="70" fill="url(#water)"/>
    ${shimmer}
    ${phase === 'day' ? seaLife(H) : ''}
    <path d="M0 ${H + 58} C 80 ${H + 50}, 160 ${H + 64}, 240 ${H + 56} S 360 ${H + 50}, 400 ${H + 56} L400 ${H + 62} C 330 ${H + 58}, 250 ${H + 70}, 160 ${H + 66} S 40 ${H + 60}, 0 ${H + 66}Z" fill="${p.shore}" opacity="0.8"/>
    <rect y="${H + 62}" width="400" height="${480 - H - 62}" fill="url(#ground)"/>
    ${phase === 'night' ? beachFire(H) : ''}
    <path d="M8 480 C 20 400, 44 292, 80 190 L89 193 C 56 294, 36 400, 26 480Z" fill="${p.trunk}"/>
    ${fronds(84, 188, p.palm)}`;
}

// Night on the beach: a stretch of sand comes forward on the right, just under
// the horizon (so it shows above the cards), with a campfire on it whose glow
// lights up the sand. From the end of sunset until sunrise.
function beachFire(H) {
  const x = 318, y = H + 10;
  const night = { fire: 1, log: '#241a1c', stone: '#5a5468' };
  return `<g class="beach-fire">
    <defs>
      <linearGradient id="nightsand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4a5680"/><stop offset="0.35" stop-color="#323c60"/><stop offset="1" stop-color="#1e2540"/>
      </linearGradient>
      <radialGradient id="firesand" cx="0.5" cy="0.4" r="0.6">
        <stop offset="0" stop-color="#ff9a48" stop-opacity="0.55"/><stop offset="0.55" stop-color="#d9673a" stop-opacity="0.18"/><stop offset="1" stop-color="#d9673a" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <path d="M160 480 L160 ${H + 60} C 200 ${H + 30}, 240 ${H + 8}, 286 ${H + 3} S 370 ${H - 1}, 400 ${H + 1} L400 480Z" fill="url(#nightsand)"/>
    <path d="M196 ${H + 36} C 232 ${H + 14}, 264 ${H + 6}, 296 ${H + 3} S 372 ${H}, 400 ${H + 2}" stroke="#aebde8" stroke-opacity="0.45" stroke-width="1.4" fill="none"/>
    <ellipse cx="${x}" cy="${y + 8}" rx="80" ry="30" fill="url(#firesand)"/>
    <g transform="translate(${x} ${y}) scale(0.9) translate(${-x} ${-y})">${campfire(x, y, night)}</g>
    <rect x="${x + 26}" y="${y - 1}" width="34" height="7" rx="3.5" fill="#2e2226" transform="rotate(-6 ${x + 43} ${y + 2})"/>
  </g>`;
}

// ---------------------------------------------------------------- sea life
// Daytime beach only: dolphins leaping across the water, and every so often a
// shark that leaps at one, misses completely and belly-flops. (CSS animations
// in styles.css: .dol-run / .dol-jump / .shark-*.)
const DOLPHIN = `
  <path d="M0,0 C8,-9 26,-11 38,-5 C42,-3 45,0 46,2 L53,-5 L51,3 L55,10 L46,6 C36,9 18,10 6,6 L-3,5 C-4,3 -2,1 0,0 Z" fill="#5a86b0"/>
  <path d="M8,4 C18,8 34,7 44,4 C34,9 18,10 8,6Z" fill="#cfe3f2"/>
  <path d="M21,-9 L27,-19 L31,-8 Z" fill="#4c76a0"/>
  <path d="M18,5 L22,12 L26,6 Z" fill="#4c76a0"/>
  <circle cx="6" cy="-1" r="1.4" fill="#1c2b3a"/>
  <path d="M-2,3 C2,5 6,5 9,3" stroke="#1c2b3a" stroke-width="0.9" fill="none" stroke-linecap="round"/>`;

const SHARK = `
  <path d="M0,0 C14,-15 52,-18 74,-7 L86,-19 L84,-2 L91,10 L74,5 C52,14 16,13 0,0 Z" fill="#6f7c8a"/>
  <path d="M6,3 C22,10 50,11 70,5 C50,14 22,13 6,6Z" fill="#e6ebef"/>
  <path d="M34,-12 L42,-28 L48,-11 Z" fill="#5f6b78"/>
  <path d="M-1,1 L14,-4 L13,6 Z" fill="#7a2531"/>
  <path d="M1,0 L3,-3 L5,0 L7,-3 L9,0 L11,-3 L13,0 M2,3 L4,5 L6,3 L8,5 L10,3 L12,5" stroke="#fff" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
  <circle cx="16" cy="-6" r="2" fill="#fff"/><circle cx="16.6" cy="-6" r="1" fill="#1c2b3a"/>`;

function seaLife(H) {
  const y = H + 9; // the dolphins' "water line", just under the horizon so it shows above the cards
  const dolphin = (dur, delay, jump, scale) => `
    <g transform="translate(0,${y})"><g class="dol-run" style="animation-duration:${dur}s;animation-delay:${delay}s">
      <g class="dol-jump" style="animation-duration:${jump}s;animation-delay:${delay}s"><g transform="scale(${scale})">${DOLPHIN}</g></g>
    </g></g>`;
  return `<g class="sea-life">
    ${dolphin(19, 0, 7.2, 0.85)}${dolphin(24, -11, 8.4, 0.74)}
    <g transform="translate(0,${y + 4})"><g class="shark-fin"><path d="M0,0 L9,-15 L20,0 Z" fill="#5f6b78"/><path d="M-6,1 Q10,-3 26,1" stroke="#fff" stroke-width="1.4" fill="none" opacity="0.8"/></g></g>
    <g transform="translate(160,${y})"><g class="shark-leap"><g transform="scale(0.85)">${SHARK}</g></g></g>
    <g transform="translate(232,${y + 2})"><g class="shark-splash">
      <ellipse cx="0" cy="0" rx="22" ry="5" fill="#fff" opacity="0.9"/>
      <path d="M-16,-2 L-22,-16 M-6,-4 L-8,-22 M6,-4 L9,-21 M16,-2 L23,-15" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    </g></g>
    <g transform="translate(232,${y - 26})"><g class="shark-stars">
      <text x="-14" y="0" font-size="9">⭐</text><text x="4" y="-6" font-size="8">💫</text><text x="10" y="6" font-size="8">⭐</text>
    </g></g>
    <g transform="translate(292,${y - 2})"><g class="shark-nope">
      <g transform="scale(0.75)">${DOLPHIN}</g>
      <g transform="translate(-6,-34)"><rect x="0" y="0" width="58" height="20" rx="10" fill="#fff"/>
        <path d="M14,19 L10,27 L22,19 Z" fill="#fff"/>
        <text x="29" y="14" font-size="11" font-weight="700" text-anchor="middle" fill="#1c2b3a" font-family="-apple-system, sans-serif">Nope! 😂</text></g>
    </g></g>
  </g>`;
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

// A slim evergreen: a tall, narrow spire with layered, slightly drooping
// branches. (x, base y, height)
function slimPine(x, y, h, color) {
  const w = h * 0.2;
  const tiers = 4;
  let d = '';
  for (let k = 0; k < tiers; k++) {
    const top = y - h + (h * 0.78 * k) / tiers;
    const bot = y - h * 0.08 - (h * 0.66 * (tiers - 1 - k)) / tiers * 0.55;
    const half = w * (0.55 + (0.45 * (k + 1)) / tiers);
    d += `M${x},${top} L${x + half},${bot} L${x + half * 0.45},${bot - h * 0.03} L${x},${bot + h * 0.01} L${x - half * 0.45},${bot - h * 0.03} L${x - half},${bot}Z `;
  }
  return `<rect x="${x - h * 0.025}" y="${y - h * 0.12}" width="${h * 0.05}" height="${h * 0.12}" fill="${color}"/><path d="${d}" fill="${color}"/>`;
}

// A row of pines that leaves an open clearing in the middle (gapFrom–gapTo).
function treeLine(from, to, step, baseY, minH, maxH, color, seed, gapFrom, gapTo) {
  let out = '';
  for (let x = from, i = 0; x <= to; x += step, i++) {
    if (x > gapFrom && x < gapTo) continue;
    const wobble = ((i * 37 + seed) % 13) / 12;
    const edge = Math.min(1, Math.min(Math.abs(x - gapFrom), Math.abs(x - gapTo)) / 50); // shorter at the clearing's edge
    const h = (minH + (maxH - minH) * wobble) * (0.65 + 0.35 * edge);
    out += slimPine(x + ((i * 5 + seed) % 4) - 2, baseY + ((i * 7 + seed) % 5), h, color);
  }
  return out;
}

// The campfire: a ring of stones, crossed logs, flickering flames, sparks and a warm glow.
function campfire(x, y, p) {
  const f = p.fire;
  const flame = (w, h, color, cls) => `<path class="${cls}" d="M${x},${y - h} C ${x + w * 0.2},${y - h * 0.62} ${x + w},${y - h * 0.42} ${x + w * 0.7},${y - 2} L${x - w * 0.7},${y - 2} C ${x - w},${y - h * 0.42} ${x - w * 0.15},${y - h * 0.6} ${x},${y - h}Z" fill="${color}"/>`;
  const stones = [-17, -11, -4, 4, 11, 17].map((dx, i) =>
    `<ellipse cx="${x + dx}" cy="${y + 1 + (i % 2)}" rx="4.4" ry="2.8" fill="${p.stone}"/>`).join('');
  const sparks = [[-6, 30, 1.1], [5, 38, 0.9], [1, 46, 0.8], [-3, 54, 0.7]].map(([dx, dy, r], i) =>
    `<circle class="spark s${i}" cx="${x + dx}" cy="${y - dy}" r="${r}" fill="#ffd27a"/>`).join('');
  const smoke = f < 0.7
    ? `<path d="M${x},${y - 30} C ${x - 7},${y - 42} ${x + 7},${y - 52} ${x - 1},${y - 64} C ${x - 6},${y - 72} ${x + 4},${y - 80} ${x + 2},${y - 88}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="4.5" fill="none" stroke-linecap="round"/>`
    : '';
  return `
    <ellipse cx="${x}" cy="${y + 2}" rx="${70 + f * 40}" ry="${14 + f * 8}" fill="url(#fireglow)" opacity="${0.35 + f * 0.55}"/>
    <circle cx="${x}" cy="${y - 14}" r="${30 + f * 24}" fill="url(#fireglow)" opacity="${0.25 + f * 0.5}"/>
    ${smoke}
    <rect x="${x - 16}" y="${y - 5}" width="32" height="5" rx="2.5" fill="${p.log}" transform="rotate(-14 ${x} ${y - 2})"/>
    <rect x="${x - 16}" y="${y - 5}" width="32" height="5" rx="2.5" fill="${p.log}" transform="rotate(14 ${x} ${y - 2})"/>
    <g class="flames">
      ${flame(13, 36, '#ff7a2e', 'fl f1')}
      ${flame(9.5, 27, '#ffb43a', 'fl f2')}
      ${flame(5.5, 17, '#ffe9a0', 'fl f3')}
    </g>
    ${sparks}
    ${stones}`;
}

// A fallen log to sit on, and a stump.
function seats(x1, y1, x2, y2, p) {
  return `
    <rect x="${x1 - 26}" y="${y1 - 8}" width="52" height="9" rx="4.5" fill="${p.log}"/>
    <ellipse cx="${x1 + 26}" cy="${y1 - 3.5}" rx="3" ry="4.5" fill="${p.stone}" opacity="0.6"/>
    <rect x="${x2 - 8}" y="${y2 - 12}" width="16" height="12" rx="2" fill="${p.log}"/>
    <ellipse cx="${x2}" cy="${y2 - 12}" rx="8" ry="2.6" fill="${p.stone}" opacity="0.7"/>`;
}

function forest(p) {
  const H = HORIZON;
  return `
    <path d="M0 ${H} L0 168 C 30 150, 62 146, 96 162 C 124 176, 150 190, 200 196 C 252 190, 280 172, 312 156 C 344 142, 376 148, 400 162 L400 ${H}Z" fill="${p.ridgeFar}"/>
    <path d="M0 ${H} L0 196 C 40 182, 80 186, 120 200 C 160 212, 240 214, 290 198 C 330 186, 370 184, 400 194 L400 ${H}Z" fill="${p.ridgeNear}"/>
    <rect y="190" width="400" height="34" fill="url(#mist)"/>
    ${treeLine(-4, 404, 8, 222, 16, 30, p.treeFar, 3, 150, 250)}
    ${treeLine(-6, 406, 13, 240, 34, 62, p.treeMid, 7, 128, 272)}
    <path d="M0 ${H - 10} C 70 ${H - 18}, 140 ${H - 22}, 200 ${H - 20} S 330 ${H - 16}, 400 ${H - 10} L400 ${H + 90} L0 ${H + 90}Z" fill="${p.grass}"/>
    <rect y="${H + 88}" width="400" height="${480 - H - 88}" fill="url(#ground)"/>
    ${seats(150, H + 6, 252, H + 4, p)}
    ${campfire(200, H + 2, p)}
    ${[[6, 346, 178], [36, 334, 136], [64, 324, 100], [338, 326, 108], [368, 334, 144], [398, 346, 182]].map(([x, y, h]) => slimPine(x, y, h, p.treeNear)).join('')}`;
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
  const land = name === 'beach' ? beach(p, sunX, sunY, sky.sun, low, phase)
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
      <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.mist || '#fff'}" stop-opacity="0"/><stop offset="0.55" stop-color="${p.mist || '#fff'}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.mist || '#fff'}" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="fireglow"><stop offset="0" stop-color="#ffb04a" stop-opacity="0.9"/><stop offset="0.5" stop-color="#ff7a2e" stop-opacity="0.35"/><stop offset="1" stop-color="#ff7a2e" stop-opacity="0"/></radialGradient>
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
  document.documentElement.dataset.phase = on ? skyNow(new Date()).phase : '';
  if (!on) { el.innerHTML = ''; return; }
  const now = new Date();
  document.body.dataset.phase = skyNow(now).phase;
  el.innerHTML = sceneSVG(name, now);
}

export function startScene() {
  paintScene();
  setInterval(paintScene, 2 * 60 * 1000); // the sun moves every 2 minutes
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paintScene(); });
}
