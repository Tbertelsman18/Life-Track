// The screens and buttons. This file draws the app and responds to taps.

import * as D from './dates.js';
import * as S from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// What's on screen right now (not saved).
const ui = {
  tab: 'home',
  view: S.getData().settings.defaultView || 'day',
  date: D.todayKey(),
  miniOpen: false,
  miniMonth: D.todayKey(),
  unscheduledOpen: true,
};

// If the app stays open past midnight, keep "today" correct.
let lastToday = D.todayKey();
function checkNewDay() {
  const t = D.todayKey();
  if (t !== lastToday) {
    if (ui.date === lastToday) ui.date = t;
    lastToday = t;
    render();
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
setInterval(checkNewDay, 60 * 1000);

// ---------------------------------------------------------------- render
function render() {
  const main = $('#main');
  if (ui.tab === 'home') main.innerHTML = renderHome();
  else if (ui.tab === 'more') main.innerHTML = renderMore();
  else main.innerHTML = renderComingSoon(ui.tab);

  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === ui.tab);
    b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false');
  });
}

S.subscribe(render);

// ---------------------------------------------------------------- home
function renderHome() {
  const views = ['day', 'week', 'month'];
  const seg = views.map((v) => `
    <button class="seg-btn ${ui.view === v ? 'on' : ''}" data-action="view" data-view="${v}">
      ${v[0].toUpperCase() + v.slice(1)}
    </button>`).join('');

  let title;
  if (ui.view === 'day') title = dayTitle(ui.date);
  else if (ui.view === 'week') title = D.formatWeekRange(ui.date);
  else title = D.formatMonthYear(ui.date);

  const isToday = ui.date === D.todayKey();

  let body;
  if (ui.view === 'day') body = renderDay();
  else if (ui.view === 'week') body = renderWeek();
  else body = renderMonth();

  return `
    <header class="home-header">
      <div class="seg" role="tablist">${seg}</div>
      <div class="nav-row">
        <button class="icon-btn" data-action="prev" aria-label="Previous">${icon('chev-left')}</button>
        <button class="nav-title" data-action="toggle-mini" aria-expanded="${ui.miniOpen}">
          ${esc(title)} <span class="caret ${ui.miniOpen ? 'up' : ''}">${icon('chev-down')}</span>
        </button>
        <button class="icon-btn" data-action="next" aria-label="Next">${icon('chev-right')}</button>
      </div>
      ${!isToday ? '<button class="today-pill" data-action="today">Today</button>' : ''}
      ${ui.miniOpen ? renderMiniCalendar() : ''}
    </header>
    <div class="view-body">${body}</div>`;
}

function dayTitle(key) {
  const t = D.todayKey();
  if (key === t) return 'Today · ' + D.formatShort(key).split(', ')[1];
  if (key === D.addDays(t, 1)) return 'Tomorrow · ' + D.formatShort(key).split(', ')[1];
  if (key === D.addDays(t, -1)) return 'Yesterday · ' + D.formatShort(key).split(', ')[1];
  return D.formatShort(key);
}

function renderMiniCalendar() {
  const m = ui.miniMonth;
  const today = D.todayKey();
  const head = D.WEEK_ORDER.map((w) => `<div class="mini-dow">${D.DAY_NAMES[w][0]}</div>`).join('');
  const cells = D.monthGrid(m).map((k) => {
    const has = S.tasksOn(k).some((t) => !S.isDoneOn(t, k));
    const cls = [
      'mini-day',
      D.sameMonth(k, m) ? '' : 'other',
      k === today ? 'today' : '',
      k === ui.date ? 'sel' : '',
    ].join(' ');
    return `<button class="${cls}" data-action="pick-date" data-date="${k}">
      ${D.fromKey(k).getDate()}${has ? '<i class="dot"></i>' : ''}
    </button>`;
  }).join('');
  return `
    <div class="mini-cal">
      <div class="mini-head">
        <button class="icon-btn sm" data-action="mini-prev" aria-label="Previous month">${icon('chev-left')}</button>
        <span>${D.formatMonthYear(m)}</span>
        <button class="icon-btn sm" data-action="mini-next" aria-label="Next month">${icon('chev-right')}</button>
      </div>
      <div class="mini-grid">${head}${cells}</div>
    </div>`;
}

function renderDay() {
  const tasks = S.tasksOn(ui.date);
  const list = tasks.length
    ? `<ul class="task-list">${tasks.map((t) => taskRow(t, ui.date)).join('')}</ul>`
    : `<p class="empty">Nothing planned. Tap <b>+</b> to add a task.</p>`;
  return `
    <section class="card">
      <h2 class="card-title">${ui.date === D.todayKey() ? "Today's Tasks" : 'Tasks'}</h2>
      ${list}
    </section>
    ${renderUnscheduled()}`;
}

function renderWeek() {
  const start = D.startOfWeek(ui.date);
  const today = D.todayKey();
  const days = Array.from({ length: 7 }, (_, i) => D.addDays(start, i));
  return days.map((k) => {
    const tasks = S.tasksOn(k);
    const d = D.fromKey(k);
    return `
      <section class="card week-day ${k === today ? 'is-today' : ''}">
        <button class="week-head" data-action="open-day" data-date="${k}">
          <span class="wd">${D.DAY_NAMES[d.getDay()]}</span>
          <span class="wn">${d.getDate()}</span>
          <span class="wc">${tasks.length ? `${tasks.filter((t) => S.isDoneOn(t, k)).length}/${tasks.length}` : ''}</span>
        </button>
        ${tasks.length
          ? `<ul class="task-list compact">${tasks.map((t) => taskRow(t, k)).join('')}</ul>`
          : `<button class="add-inline" data-action="add-on" data-date="${k}">+ Add</button>`}
      </section>`;
  }).join('') + renderUnscheduled();
}

function renderMonth() {
  const today = D.todayKey();
  const head = D.WEEK_ORDER.map((w) => `<div class="m-dow">${D.DAY_NAMES[w][0]}</div>`).join('');
  const cells = D.monthGrid(ui.date).map((k) => {
    const tasks = S.tasksOn(k);
    const shown = tasks.slice(0, 3).map((t) => {
      const sec = S.getSection(t.sectionId);
      const done = S.isDoneOn(t, k);
      return `<span class="m-chip ${done ? 'done' : ''}" style="--c:${sec ? sec.color : 'var(--muted)'}">${esc(t.title)}</span>`;
    }).join('');
    const more = tasks.length > 3 ? `<span class="m-more">+${tasks.length - 3}</span>` : '';
    const cls = [
      'm-cell',
      D.sameMonth(k, ui.date) ? '' : 'other',
      k === today ? 'today' : '',
      k === ui.date ? 'sel' : '',
    ].join(' ');
    return `<button class="${cls}" data-action="select-date" data-date="${k}">
      <span class="m-num">${D.fromKey(k).getDate()}</span>${shown}${more}
    </button>`;
  }).join('');

  const tasks = S.tasksOn(ui.date);
  return `
    <div class="month-grid">${head}${cells}</div>
    <section class="card">
      <h2 class="card-title">${esc(D.formatLong(ui.date))}</h2>
      ${tasks.length
        ? `<ul class="task-list">${tasks.map((t) => taskRow(t, ui.date)).join('')}</ul>`
        : `<p class="empty">Nothing planned.</p>`}
      <button class="add-inline" data-action="add-on" data-date="${ui.date}">+ Add to this day</button>
    </section>`;
}

function renderUnscheduled() {
  const tasks = S.unscheduledTasks();
  if (!tasks.length) return '';
  return `
    <section class="card">
      <button class="card-title toggle" data-action="toggle-unscheduled">
        Unscheduled <span class="count">${tasks.filter((t) => !t.done).length}</span>
        <span class="caret ${ui.unscheduledOpen ? 'up' : ''}">${icon('chev-down')}</span>
      </button>
      ${ui.unscheduledOpen ? `<ul class="task-list">${tasks.map((t) => taskRow(t, null)).join('')}</ul>` : ''}
    </section>`;
}

function taskRow(t, key) {
  const done = key ? S.isDoneOn(t, key) : t.done;
  const sec = S.getSection(t.sectionId);
  const color = sec ? sec.color : 'var(--muted)';
  const meta = [];
  if (t.time) meta.push(D.formatTime(t.time));
  if (sec) meta.push(esc(sec.name));
  if (t.repeat) meta.push(`${icon('repeat')} ${repeatLabel(t.repeat.days)}`);
  if (t.pushes && t.pushes.length) meta.push(`<span class="pushed">pushed ${t.pushes.length}×</span>`);
  return `
    <li class="task ${done ? 'done' : ''}" style="--c:${color}">
      <button class="check" data-action="toggle" data-id="${t.id}" data-date="${key || ''}"
        aria-label="${done ? 'Mark not done' : 'Mark done'}">${done ? icon('check') : ''}</button>
      <button class="task-main" data-action="edit" data-id="${t.id}" data-date="${key || ''}">
        <span class="task-title">${esc(t.title)}</span>
        ${meta.length ? `<span class="task-meta">${meta.join(' · ')}</span>` : ''}
      </button>
    </li>`;
}

function repeatLabel(days) {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
  return D.WEEK_ORDER.filter((d) => set.has(d)).map((d) => D.DAY_NAMES[d]).join('/');
}

// ---------------------------------------------------------------- more
function renderMore() {
  const data = S.getData();
  const sections = data.sections.map((s) => `
    <li><button class="row" data-action="edit-section" data-id="${s.id}">
      <i class="swatch" style="background:${s.color}"></i>
      <span class="row-label">${esc(s.name)}</span>
      <span class="row-value">${S.countTasksInSection(s.id)}</span>
      ${icon('chev-right')}
    </button></li>`).join('');

  const dv = data.settings.defaultView;
  const viewSeg = ['day', 'week', 'month'].map((v) => `
    <button class="seg-btn ${dv === v ? 'on' : ''}" data-action="set-default-view" data-view="${v}">
      ${v[0].toUpperCase() + v.slice(1)}</button>`).join('');

  return `
    <header class="page-header"><h1>More</h1></header>
    <div class="view-body">
      <h3 class="group-label">Sections</h3>
      <ul class="group">${sections}
        <li><button class="row accent" data-action="add-section">${icon('plus')}<span class="row-label">Add section</span></button></li>
      </ul>

      <h3 class="group-label">Settings</h3>
      <div class="group pad">
        <div class="setting-label">Default view when the app opens</div>
        <div class="seg">${viewSeg}</div>
      </div>

      <h3 class="group-label">Backup</h3>
      <ul class="group">
        <li><button class="row" data-action="export">${icon('share')}<span class="row-label">Export backup</span></button></li>
        <li><button class="row" data-action="import">${icon('download')}<span class="row-label">Import backup</span></button></li>
      </ul>
      <p class="hint">Export saves a backup file. Choose <b>Save to Files</b> and pick iCloud Drive to keep it safe.
      Import replaces everything in the app with the backup you choose.</p>

      <p class="hint center">Life Tracker · Stage 1 · ${data.tasks.length} tasks saved on this phone</p>
    </div>`;
}

function renderComingSoon(tab) {
  const info = {
    projects: ['Projects', 'Stage 3: prioritized projects, notes, checklists and the Radar.'],
    goals: ['Goals', 'Stage 4: yearly and quarterly goals and progress.'],
    lists: ['Lists', 'Stage 5: Info and your custom lists.'],
  }[tab];
  return `
    <header class="page-header"><h1>${info[0]}</h1></header>
    <div class="view-body"><p class="empty big">Coming in ${info[1]}</p></div>`;
}

// ---------------------------------------------------------------- task sheet
function openTaskSheet({ id = null, date = null, defaults = {} } = {}) {
  const t = id ? S.getTask(id) : null;
  const data = S.getData();
  const v = t ? { ...t } : {
    title: '', notes: '', date: date === undefined ? null : date, time: null,
    sectionId: data.sections[0]?.id || null, repeat: null, ...defaults,
  };
  const repeatDays = new Set(v.repeat ? v.repeat.days : []);
  const occurrence = t && t.repeat && date ? date : null;

  const dayChips = D.WEEK_ORDER.map((d) => `
    <button type="button" class="chip ${repeatDays.has(d) ? 'on' : ''}" data-day="${d}" aria-pressed="${repeatDays.has(d)}">
      ${D.DAY_NAMES[d].slice(0, 2)}</button>`).join('');

  const pushInfo = t && t.pushes && t.pushes.length
    ? `<p class="hint">Pushed off ${t.pushes.length} time${t.pushes.length > 1 ? 's' : ''}.</p>` : '';

  openSheet(`
    <form class="sheet-form" id="task-form" autocomplete="off">
      <div class="sheet-top">
        <button type="button" class="link" data-action="close-sheet">Cancel</button>
        <span class="sheet-title">${t ? 'Edit Task' : 'New Task'}</span>
        <button type="submit" class="link strong">Save</button>
      </div>

      <input class="title-input" name="title" placeholder="What do you need to do?" value="${esc(v.title)}" required>

      <div class="field-group">
        <label class="field">
          <span>${v.repeat ? 'Starts' : 'Date'}</span>
          <input type="date" name="date" value="${v.date || ''}">
        </label>
        <div class="field-actions">
          <button type="button" class="chip" data-set-date="${D.todayKey()}">Today</button>
          <button type="button" class="chip" data-set-date="${D.addDays(D.todayKey(), 1)}">Tomorrow</button>
          <button type="button" class="chip" data-set-date="">No date</button>
        </div>
        <label class="field">
          <span>Time</span>
          <input type="time" name="time" value="${v.time || ''}">
        </label>
        <label class="field">
          <span>Section</span>
          <select name="sectionId">
            ${sectionOptions(v.sectionId)}
          </select>
        </label>
      </div>

      <div class="field-group">
        <div class="field col">
          <span>Repeat on</span>
          <div class="day-chips">${dayChips}</div>
        </div>
        <label class="field repeat-only" ${repeatDays.size ? '' : 'hidden'}>
          <span>Ends (optional)</span>
          <input type="date" name="until" value="${v.repeat?.until || ''}">
        </label>
      </div>

      <label class="field-group">
        <textarea name="notes" rows="3" placeholder="Notes">${esc(v.notes)}</textarea>
      </label>

      ${occurrence ? `
        <div class="field-group pad">
          <p class="hint left">This task repeats. Changes above apply to every day.
            For just <b>${esc(D.formatShort(occurrence))}</b>:</p>
          <div class="btn-row">
            <button type="button" class="btn" data-action="skip-occ">Skip this day</button>
            <label class="btn file-like">Move to… <input type="date" data-action="move-occ"></label>
          </div>
        </div>` : ''}

      ${t && !t.repeat && t.date && !t.done ? `
        <button type="button" class="btn wide" data-action="push-tomorrow">Push to tomorrow</button>` : ''}
      ${pushInfo}

      ${t ? `<button type="button" class="btn danger wide" data-action="delete-task">Delete task</button>` : ''}
    </form>`);

  const form = $('#task-form');
  if (!t) setTimeout(() => form.title.focus(), 50);

  form.querySelectorAll('[data-set-date]').forEach((b) => b.addEventListener('click', () => {
    form.date.value = b.dataset.setDate;
  }));

  form.querySelectorAll('.day-chips .chip').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.day);
    if (repeatDays.has(d)) repeatDays.delete(d); else repeatDays.add(d);
    b.classList.toggle('on', repeatDays.has(d));
    b.setAttribute('aria-pressed', repeatDays.has(d));
    form.querySelector('.repeat-only').hidden = repeatDays.size === 0;
    form.querySelector('.field span').textContent = repeatDays.size ? 'Starts' : 'Date';
  }));

  form.sectionId.addEventListener('change', () => {
    if (form.sectionId.value !== '__new') return;
    const name = prompt('Name for the new section:');
    if (name && name.trim()) {
      const s = S.addSection(name);
      form.sectionId.innerHTML = sectionOptions(s.id);
    } else {
      form.sectionId.innerHTML = sectionOptions(v.sectionId);
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return;
    let dateVal = form.date.value || null;
    let repeat = null;
    if (repeatDays.size) {
      if (!dateVal) dateVal = D.todayKey();
      repeat = {
        days: [...repeatDays].sort(),
        until: form.until.value || null,
        doneDates: t?.repeat?.doneDates || {},
        skips: t?.repeat?.skips || [],
      };
    }
    const fields = {
      title,
      notes: form.notes.value.trim(),
      date: dateVal,
      time: form.time.value || null,
      sectionId: form.sectionId.value || null,
      repeat,
    };
    if (t) S.updateTask(t.id, fields);
    else S.addTask(fields);
    closeSheet();
  });

  const on = (action, fn) => form.querySelector(`[data-action="${action}"]`)?.addEventListener(
    action === 'move-occ' ? 'change' : 'click', fn);

  on('delete-task', () => {
    if (confirm(`Delete "${t.title}"${t.repeat ? ' and all its repeats' : ''}?`)) {
      S.deleteTask(t.id);
      closeSheet();
    }
  });
  on('push-tomorrow', () => {
    S.updateTask(t.id, { date: D.addDays(t.date, 1) });
    closeSheet();
  });
  on('skip-occ', () => {
    S.skipOccurrence(t.id, occurrence);
    closeSheet();
  });
  on('move-occ', (e) => {
    if (!e.target.value) return;
    S.moveOccurrence(t.id, occurrence, e.target.value);
    closeSheet();
  });
}

function sectionOptions(selected) {
  const data = S.getData();
  return data.sections.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('')
    + `<option value="" ${!selected ? 'selected' : ''}>No section</option>`
    + `<option value="__new">＋ New section…</option>`;
}

// ---------------------------------------------------------------- section sheet
function openSectionSheet(id) {
  const s = id ? S.getSection(id) : null;
  let color = s ? s.color : S.SECTION_COLORS.find((c) => !S.getData().sections.some((x) => x.color === c)) || S.SECTION_COLORS[0];
  const swatches = () => S.SECTION_COLORS.map((c) => `
    <button type="button" class="swatch-btn ${c === color ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('');

  openSheet(`
    <form class="sheet-form" id="section-form">
      <div class="sheet-top">
        <button type="button" class="link" data-action="close-sheet">Cancel</button>
        <span class="sheet-title">${s ? 'Edit Section' : 'New Section'}</span>
        <button type="submit" class="link strong">Save</button>
      </div>
      <input class="title-input" name="name" placeholder="Section name" value="${esc(s?.name || '')}" required>
      <div class="field-group pad">
        <div class="setting-label">Color</div>
        <div class="swatches">${swatches()}</div>
      </div>
      ${s ? `<button type="button" class="btn danger wide" data-action="delete-section">Delete section</button>` : ''}
    </form>`);

  const form = $('#section-form');
  if (!s) setTimeout(() => form.name.focus(), 50);
  form.querySelector('.swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    color = b.dataset.color;
    form.querySelector('.swatches').innerHTML = swatches();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    if (!name) return;
    if (s) S.updateSection(s.id, { name, color });
    else S.addSection(name, color);
    closeSheet();
  });
  form.querySelector('[data-action="delete-section"]')?.addEventListener('click', () => {
    const n = S.countTasksInSection(s.id);
    const other = S.getData().sections.find((x) => x.id !== s.id);
    const msg = n
      ? `Delete "${s.name}"? Its ${n} task${n > 1 ? 's' : ''} will move to ${other ? `"${other.name}"` : 'no section'}.`
      : `Delete "${s.name}"?`;
    if (confirm(msg)) {
      S.deleteSection(s.id, other?.id);
      closeSheet();
    }
  });
}

// ---------------------------------------------------------------- sheet helpers
function openSheet(html) {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet-panel" role="dialog" aria-modal="true">${html}</div>`;
  sheet.hidden = false;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => sheet.classList.add('show'));
}

function closeSheet() {
  const sheet = $('#sheet');
  sheet.classList.remove('show');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { sheet.hidden = true; sheet.innerHTML = ''; }, 200);
}

// ---------------------------------------------------------------- backup
async function doExport() {
  const json = S.exportJSON();
  const name = S.backupFileName();
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Life Tracker backup' });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function doImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (!confirm('Replace ALL data in the app with this backup? This cannot be undone.')) return;
      S.importJSON(text);
      alert('Backup imported.');
    } catch (e) {
      alert('Could not import: ' + e.message);
    }
  });
  input.click();
}

// ---------------------------------------------------------------- taps
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-tab]');
  if (!el) return;

  if (el.dataset.tab) {
    ui.tab = el.dataset.tab;
    render();
    window.scrollTo(0, 0);
    return;
  }

  const { action } = el.dataset;
  const step = { day: 1, week: 7 }[ui.view];

  switch (action) {
    case 'view': ui.view = el.dataset.view; ui.miniOpen = false; break;
    case 'prev': ui.date = ui.view === 'month' ? D.addMonths(ui.date, -1) : D.addDays(ui.date, -step); break;
    case 'next': ui.date = ui.view === 'month' ? D.addMonths(ui.date, 1) : D.addDays(ui.date, step); break;
    case 'today': ui.date = D.todayKey(); ui.miniMonth = ui.date; break;
    case 'toggle-mini': ui.miniOpen = !ui.miniOpen; ui.miniMonth = ui.date; break;
    case 'mini-prev': ui.miniMonth = D.addMonths(ui.miniMonth, -1); break;
    case 'mini-next': ui.miniMonth = D.addMonths(ui.miniMonth, 1); break;
    case 'pick-date': ui.date = el.dataset.date; ui.miniOpen = false; ui.view = 'day'; break;
    case 'select-date': ui.date = el.dataset.date; break;
    case 'open-day': ui.date = el.dataset.date; ui.view = 'day'; break;
    case 'toggle-unscheduled': ui.unscheduledOpen = !ui.unscheduledOpen; break;
    case 'toggle': S.toggleDone(el.dataset.id, el.dataset.date || null); return;
    case 'edit': openTaskSheet({ id: el.dataset.id, date: el.dataset.date || null }); return;
    case 'add':
      openTaskSheet({ date: ui.tab === 'home' ? ui.date : D.todayKey() }); return;
    case 'add-on': openTaskSheet({ date: el.dataset.date }); return;
    case 'close-sheet': closeSheet(); return;
    case 'edit-section': openSectionSheet(el.dataset.id); return;
    case 'add-section': openSectionSheet(null); return;
    case 'set-default-view': S.setSetting('defaultView', el.dataset.view); return;
    case 'export': doExport(); return;
    case 'import': doImport(); return;
    default: return;
  }
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
});

// ---------------------------------------------------------------- icons
function icon(name) {
  const p = {
    'chev-left': '<path d="M15 18l-6-6 6-6"/>',
    'chev-right': '<path d="M9 6l6 6-6 6"/>',
    'chev-down': '<path d="M6 9l6 6 6-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 014-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 01-4 4H4"/>',
    share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>',
    download: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"/>',
  }[name];
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

// ---------------------------------------------------------------- start
render();

// Ask the phone to keep our data (not clear it when storage runs low).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// Offline support
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
