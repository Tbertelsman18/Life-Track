// Shared pieces used by every screen: safe text, icons, bottom sheets,
// and the "what's on screen" state.

import * as D from './dates.js';
import * as S from './store.js';

export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Turns plain text into safe HTML with line breaks and clickable links.
export function richText(s) {
  return esc(s)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

// What's on screen right now (not saved).
export const ui = {
  tab: 'home',
  page: null, // a sub-page, e.g. { type: 'project', id }
  view: S.getData().settings.defaultView || 'day',
  date: D.todayKey(),
  miniOpen: false,
  miniMonth: D.todayKey(),
  unscheduledOpen: true,
  doneOpen: false,
  showPastDays: false,
  weekMode: 'week',
  reviewOpen: null,
  checkEdit: false,
  projectsTab: 'active',
  goalYear: new Date().getFullYear(),
  listsTab: 'lists',
  historyWeek: null,
  historyBy: 'section',
};

// Screens ask for a redraw through this (set by app.js).
export const hooks = { render: () => {} };
export const rerender = () => hooks.render();

export function go(page) {
  ui.page = page;
  rerender();
  window.scrollTo(0, 0);
}

export function back() {
  ui.page = ui.page?.parent || null;
  rerender();
  window.scrollTo(0, 0);
}

export function pct(v) {
  return v === null || v === undefined ? '' : `${Math.round(v * 100)}%`;
}

export function progressBar(v, color = 'var(--accent)') {
  const w = v === null || v === undefined ? 0 : Math.round(v * 100);
  return `<div class="bar" role="progressbar" aria-valuenow="${w}" aria-valuemin="0" aria-valuemax="100">
    <i style="width:${w}%;background:${color}"></i></div>`;
}

export function sectionColor(id) {
  return S.getSection(id)?.color || 'var(--muted)';
}

export function sectionOptions(selected, { allowNew = true } = {}) {
  const data = S.getData();
  return data.sections.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('')
    + `<option value="" ${!selected ? 'selected' : ''}>No section</option>`
    + (allowNew ? `<option value="__new">＋ New section…</option>` : '');
}

// Hook up the "＋ New section…" choice in a section dropdown.
export function wireSectionSelect(select, fallback) {
  select.addEventListener('change', () => {
    if (select.value !== '__new') return;
    const name = prompt('Name for the new section:');
    if (name && name.trim()) {
      const s = S.addSection(name);
      select.innerHTML = sectionOptions(s.id);
    } else {
      select.innerHTML = sectionOptions(fallback);
    }
  });
}

export function pageHeader(title, { backLabel = 'Back', right = '' } = {}) {
  return `
    <header class="sub-header">
      <button class="back-btn" data-action="back">${icon('chev-left')}<span>${esc(backLabel)}</span></button>
      <div class="sub-right">${right}</div>
    </header>
    <h1 class="sub-title">${esc(title)}</h1>`;
}

// ---------- bottom sheet ----------
export function openSheet(html) {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet-panel" role="dialog" aria-modal="true">${html}</div>`;
  sheet.hidden = false;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => sheet.classList.add('show'));
  return sheet.querySelector('.sheet-panel');
}

export function closeSheet() {
  const sheet = $('#sheet');
  sheet.classList.remove('show');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { if (!sheet.classList.contains('show')) { sheet.hidden = true; sheet.innerHTML = ''; } }, 200);
}

export function sheetTop(title, { save = true, saveLabel = 'Save' } = {}) {
  return `<div class="sheet-top">
    <button type="button" class="link" data-action="close-sheet">${save ? 'Cancel' : 'Close'}</button>
    <span class="sheet-title">${esc(title)}</span>
    ${save ? `<button type="submit" class="link strong">${saveLabel}</button>` : '<span class="link-spacer"></span>'}
  </div>`;
}

// A short message at the bottom of the screen.
export function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

// Drag-to-reorder using the SortableJS library (loaded in index.html).
export function makeSortable(el, onEnd) {
  if (!el || !window.Sortable) return;
  window.Sortable.create(el, {
    handle: '.drag',
    animation: 150,
    delay: 0,
    ghostClass: 'drag-ghost',
    onEnd: () => onEnd([...el.children].map((c) => c.dataset.id).filter(Boolean)),
  });
}

// ---------- icons ----------
const ICONS = {
  'chev-left': '<path d="M15 18l-6-6 6-6"/>',
  'chev-right': '<path d="M9 6l6 6-6 6"/>',
  'chev-down': '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 014-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 01-4 4H4"/>',
  share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>',
  download: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"/>',
  drag: '<path d="M4 8h16M4 12h16M4 16h16"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bell: '<path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  turtle: '<path d="M4 14a8 6 0 0116 0z"/><path d="M8 14v3M16 14v3M20 12h2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
