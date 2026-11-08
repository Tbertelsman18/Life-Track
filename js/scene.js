// The beach background. An original, flat illustration whose sky, sun and sea
// follow the time of day: sunrise in the morning, a sunny beach in the
// daytime, a sunset in the evening and a moonlit beach at night.

import * as S from './store.js';

// Colors for each part of the day.
const PALETTES = {
  sunrise: { sky: ['#3d4f8f', '#e58aa3', '#ffc98f'], sea: ['#7d7fb6', '#f3a98c'], sun: '#ffe6a6', glow: '#ffb27a',
    island: '#4a3e62', palm: '#2c2338', trunk: '#2c2338', sand: '#f2d7bd', shore: '#fbe7d6' },
  day: { sky: ['#2b8fe6', '#63c1f5', '#c3ecff'], sea: ['#1497c2', '#43d0d6'], sun: '#fff7c9', glow: '#fff1a8',
    island: '#3f8a6c', palm: '#1d7a4b', trunk: '#8b6640', sand: '#f6e2bd', shore: '#ffffff' },
  sunset: { sky: ['#2a2d66', '#d0607a', '#ffb257'], sea: ['#4c3c70', '#f08a4a'], sun: '#ffd36a', glow: '#ff9a4a',
    island: '#2e2140', palm: '#1d1524', trunk: '#1d1524', sand: '#ebc8a2', shore: '#ffd9b8' },
  night: { sky: ['#0a1330', '#18295a', '#33477e'], sea: ['#122050', '#26407a'], sun: '#f4f1e4', glow: '#9fb4ff',
    island: '#0e1430', palm: '#080b1c', trunk: '#080b1c', sand: '#cdbfa8', shore: '#9fb0d8' },
};

function phaseFor(h) {
  if (h >= 5.5 && h < 8.5) return 'sunrise';
  if (h >= 8.5 && h < 17) return 'day';
  if (h >= 17 && h < 20.5) return 'sunset';
  return 'night';
}

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

function sceneSVG(now) {
  const h = now.getHours() + now.getMinutes() / 60;
  const phase = phaseFor(h);
  const p = PALETTES[phase];
  const horizon = 252;

  // Sun travels across the sky from about 6am to 7pm; the moon at night.
  let t;
  if (phase === 'night') t = ((h < 12 ? h + 24 : h) - 20.5) / 9; // 8:30pm → 5:30am
  else t = (h - 6) / 13;
  t = Math.min(1, Math.max(0, t));
  const sx = 40 + t * 320;
  // Keep the sun inside the open window above the water so it is always in view
  const sy = horizon + 6 - Math.sin(Math.PI * t) * 58;
  const r = phase === 'night' ? 13 : phase === 'day' ? 20 : 24;
  const low = phase === 'sunrise' || phase === 'sunset';

  const stars = phase === 'night'
    ? [[30, 30], [80, 70], [140, 24], [200, 58], [255, 22], [300, 80], [350, 40], [380, 110], [110, 150], [230, 130], [320, 190], [180, 210], [60, 200], [370, 215]]
      .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.5}" fill="#fff" opacity="${i % 2 ? 0.6 : 0.9}"/>`).join('')
    : '';
  const clouds = phase === 'night' ? '' : `
    <g fill="#fff" opacity="${phase === 'day' ? 0.85 : 0.35}">
      <ellipse cx="290" cy="128" rx="40" ry="10"/><ellipse cx="310" cy="120" rx="24" ry="10"/>
      <ellipse cx="170" cy="196" rx="32" ry="7"/><ellipse cx="186" cy="190" rx="16" ry="7"/>
    </g>`;
  // The sun's shimmer on the water
  const shimmer = sy < horizon - 4
    ? [0, 1, 2, 3, 4].map((i) => `<rect x="${sx - (26 - i * 4)}" y="${horizon + 6 + i * 9}" width="${52 - i * 8}" height="2.4" rx="1.2" fill="${p.sun}" opacity="${(low ? 0.75 : 0.5) - i * 0.1}"/>`).join('')
    : '';

  return `
  <svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.sky[0]}"/><stop offset="0.62" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/>
      </linearGradient>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.sea[0]}"/><stop offset="1" stop-color="${p.sea[1]}"/>
      </linearGradient>
      <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.sand}"/><stop offset="1" stop-color="${p.sand}" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="${p.glow}" stop-opacity="0.75"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="400" height="${horizon}" fill="url(#sky)"/>
    ${stars}
    <circle cx="${sx}" cy="${sy}" r="${r * 3.4}" fill="url(#glow)"/>
    <circle cx="${sx}" cy="${sy}" r="${r}" fill="${p.sun}"/>
    ${phase === 'night' ? `<circle cx="${sx + 6}" cy="${sy - 4}" r="${r}" fill="${p.sky[1]}" opacity="0.9"/>` : ''}
    ${clouds}
    <path d="M250 ${horizon} C 280 ${horizon - 22}, 310 ${horizon - 30}, 336 ${horizon - 18} S 380 ${horizon - 8}, 400 ${horizon - 12} L400 ${horizon}Z" fill="${p.island}"/>
    <rect y="${horizon}" width="400" height="70" fill="url(#sea)"/>
    ${shimmer}
    <path d="M0 ${horizon + 58} C 80 ${horizon + 50}, 160 ${horizon + 64}, 240 ${horizon + 56} S 360 ${horizon + 50}, 400 ${horizon + 56} L400 ${horizon + 62} C 330 ${horizon + 58}, 250 ${horizon + 70}, 160 ${horizon + 66} S 40 ${horizon + 60}, 0 ${horizon + 66}Z" fill="${p.shore}" opacity="0.8"/>
    <rect y="${horizon + 62}" width="400" height="${480 - horizon - 62}" fill="url(#sand)"/>
    <path d="M8 480 C 20 400, 44 292, 80 190 L89 193 C 56 294, 36 400, 26 480Z" fill="${p.trunk}"/>
    ${fronds(84, 188, p.palm)}
  </svg>`;
}

// Draws (or redraws) the background, unless it's switched off in More → Settings.
export function paintScene() {
  const el = document.getElementById('scene');
  if (!el) return;
  const on = S.getData().settings.beach !== false;
  document.body.classList.toggle('beach', on);
  document.documentElement.classList.toggle('beach', on);
  if (!on) { el.innerHTML = ''; return; }
  const now = new Date();
  const phase = phaseFor(now.getHours() + now.getMinutes() / 60);
  document.body.dataset.phase = phase;
  el.innerHTML = sceneSVG(now);
}

export function startScene() {
  paintScene();
  setInterval(paintScene, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) paintScene(); });
}
