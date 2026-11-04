// The Home tab: Day / Week / Month views, mini calendar, Daily Check, Forecast.

import * as D from './dates.js';
import * as S from './store.js';
import { ui, esc, icon, rerender, go, sectionColor, makeSortable, toast } from './ui.js';
import { openTaskSheet, openEventSheet, openAddSheet } from './forms.js';

export function renderHome() {
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
  const body = ui.view === 'day' ? renderDay() : ui.view === 'week' ? renderWeek() : renderMonth();

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
  const md = D.formatMonthDay(key);
  if (key === t) return 'Today · ' + md;
  if (key === D.addDays(t, 1)) return 'Tomorrow · ' + md;
  if (key === D.addDays(t, -1)) return 'Yesterday · ' + md;
  return D.formatShort(key);
}

function hasAnything(k) {
  return S.eventsOn(k).length > 0 || S.tasksOn(k).some((t) => !S.isDoneOn(t, k)) || S.milestonesOn(k).some((m) => !m.done);
}

function renderMiniCalendar() {
  const m = ui.miniMonth;
  const today = D.todayKey();
  const head = D.WEEK_ORDER.map((w) => `<div class="mini-dow">${D.DAY_NAMES[w][0]}</div>`).join('');
  const cells = D.monthGrid(m).map((k) => {
    const cls = ['mini-day', D.sameMonth(k, m) ? '' : 'other', k === today ? 'today' : '', k === ui.date ? 'sel' : '',
      S.blockingEventsOn(k).length ? 'blocked' : ''].join(' ');
    return `<button class="${cls}" data-action="pick-date" data-date="${k}">
      ${D.fromKey(k).getDate()}${hasAnything(k) ? '<i class="dot"></i>' : ''}
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

// ---------------------------------------------------------------- day
function renderDay() {
  const today = D.todayKey();
  const isToday = ui.date === today;
  const parts = [];

  if (isToday && D.weekday(today) === 0) {
    parts.push(`<button class="banner" data-action="open-planning">
      ${icon('calendar')}<span><b>It's Sunday.</b> Plan your week</span>${icon('chev-right')}</button>`);
  }
  if (ui.date <= today) parts.push(renderDailyCheck(ui.date));
  if (isToday) parts.push(renderForecast());

  parts.push(`
    <section class="card">
      <h2 class="card-title">${isToday ? "Today's Tasks" : 'Tasks'}</h2>
      ${dayItems(ui.date) || `<p class="empty">Nothing planned. Tap <b>+</b> to add a task.</p>`}
    </section>`);
  parts.push(renderUnscheduled());
  return parts.join('');
}

// Events, milestones and tasks for one day, as a list.
function dayItems(key, { compact = false } = {}) {
  const events = S.eventsOn(key);
  const miles = S.milestonesOn(key);
  const tasks = S.tasksOn(key);
  if (!events.length && !miles.length && !tasks.length) return '';
  return `<ul class="task-list ${compact ? 'compact' : ''}">
    ${events.map((e) => eventRow(e, key)).join('')}
    ${miles.map(milestoneRow).join('')}
    ${tasks.map((t) => taskRow(t, key)).join('')}
  </ul>`;
}

export function eventRow(e, key) {
  const last = S.eventLast(e);
  const multi = last !== e.date;
  let when = e.time ? D.formatTime(e.time) : '';
  if (multi) {
    const n = D.daysBetween(e.date, key) + 1;
    const total = D.daysBetween(e.date, last) + 1;
    when = `Day ${n} of ${total}` + (n === 1 && e.time ? ` · ${D.formatTime(e.time)}` : '');
  }
  return `
    <li class="event-row" style="--c:${sectionColor(e.sectionId)}">
      <button class="event-main" data-action="edit-event" data-id="${e.id}">
        <span class="event-bar"></span>
        <span class="task-main-inner">
          <span class="task-title">${esc(e.title)}</span>
          <span class="task-meta">${icon('calendar')} ${multi ? `${D.formatMonthDay(e.date)} – ${D.formatMonthDay(last)}` : 'Event'}${when ? ' · ' + when : ''}</span>
        </span>
      </button>
    </li>`;
}

function milestoneRow(m) {
  return `
    <li class="event-row milestone ${m.done ? 'done' : ''}" style="--c:${m.kind === 'goal' ? 'var(--accent)' : sectionColor(m.sectionId)}">
      <button class="event-main" data-action="open-${m.kind}" data-id="${m.id}">
        <span class="flag">${icon(m.kind === 'goal' ? 'target' : 'flag')}</span>
        <span class="task-main-inner">
          <span class="task-title">${esc(m.title)}</span>
          <span class="task-meta">${m.kind === 'goal' ? 'Goal milestone' : 'Project milestone'}</span>
        </span>
      </button>
    </li>`;
}

export function taskRow(t, key, { showDate = false } = {}) {
  const done = key ? S.isDoneOn(t, key) : t.done;
  const sec = S.getSection(t.sectionId);
  const color = sec ? sec.color : 'var(--muted)';
  const meta = [];
  if (showDate && t.date) meta.push(D.formatShort(t.date));
  if (t.time) meta.push(D.formatTime(t.time));
  if (sec) meta.push(esc(sec.name));
  if (t.projectId) { const p = S.getProject(t.projectId); if (p) meta.push(`${icon('folder')} ${esc(p.title)}`); }
  if (t.goalId) { const g = S.resolveGoal(t.goalId); if (g) meta.push(`${icon('target')} ${esc(g.target ? g.target.label : (g.quarterly || g.yearly)?.title)}`); }
  if (t.repeat) meta.push(`${icon('repeat')} ${repeatLabel(t.repeat.days)}`);
  if (t.pushes && t.pushes.length) meta.push(`<span class="pushed">pushed ${t.pushes.length}×</span>`);
  return `
    <li class="task ${done ? 'done' : ''}" style="--c:${color}" data-id="${t.id}">
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

// ---------------------------------------------------------------- daily check
function renderDailyCheck(key) {
  const items = S.getData().dailyCheck.items;
  const doneCount = items.filter((i) => S.isChecked(i.id, key)).length;
  const editing = ui.checkEdit;

  let body;
  if (!items.length && !editing) {
    body = `<p class="empty">Things you look at every day (e.g. Ava Notes). <button class="link inline" data-action="check-edit">Add items</button></p>`;
  } else if (editing) {
    body = `
      <ul class="task-list check-edit" id="check-sort">
        ${items.map((i) => `
          <li class="task" data-id="${i.id}">
            <span class="drag" aria-label="Drag to reorder">${icon('drag')}</span>
            <button class="task-main" data-action="check-rename" data-id="${i.id}"><span class="task-title">${esc(i.title)}</span></button>
            <button class="icon-btn sm danger" data-action="check-remove" data-id="${i.id}" aria-label="Remove">${icon('x')}</button>
          </li>`).join('')}
      </ul>
      <form class="inline-add" data-form="check-add">
        <input name="title" placeholder="Add a daily item" autocomplete="off">
        <button class="link strong" type="submit">Add</button>
      </form>`;
  } else {
    body = `<ul class="task-list compact">
      ${items.map((i) => {
        const on = S.isChecked(i.id, key);
        return `<li class="task ${on ? 'done' : ''}" style="--c:var(--accent)">
          <button class="check" data-action="check-toggle" data-id="${i.id}" data-date="${key}" aria-label="${on ? 'Uncheck' : 'Check'}">${on ? icon('check') : ''}</button>
          <button class="task-main" data-action="check-toggle" data-id="${i.id}" data-date="${key}"><span class="task-title">${esc(i.title)}</span></button>
        </li>`;
      }).join('')}
    </ul>`;
  }

  return `
    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Daily Check ${items.length ? `<span class="count ${doneCount === items.length ? 'all' : ''}">${doneCount}/${items.length}</span>` : ''}</h2>
        ${items.length || editing ? `<button class="link small" data-action="check-edit">${editing ? 'Done' : 'Edit'}</button>` : ''}
      </div>
      ${body}
    </section>`;
}

// ---------------------------------------------------------------- forecast
export function forecastList(items) {
  return `<ul class="forecast">
    ${items.map((f) => {
      const color = f.kind === 'reminder' ? 'var(--accent)' : f.sectionId ? sectionColor(f.sectionId) : 'var(--accent)';
      const action = f.kind === 'event' ? 'edit-event' : f.kind === 'project' ? 'open-project' : f.kind === 'goal' ? 'open-goal' : f.action;
      const soon = /^(Today|Tomorrow|Now)/.test(f.when);
      return `<li class="fc-row ${f.kind === 'reminder' ? 'reminder' : ''}" style="--c:${color}">
        <button class="fc-main" data-action="${action}" data-id="${f.id || ''}" data-year="${f.year || ''}" data-q="${f.q || ''}">
          <span class="fc-icon">${icon(f.kind === 'reminder' ? 'bell' : f.kind === 'event' ? 'calendar' : f.kind === 'goal' ? 'target' : 'flag')}</span>
          <span class="fc-text">
            <span class="fc-title">${esc(f.title)}</span>
            ${f.date && f.kind !== 'reminder' ? `<span class="task-meta">${D.formatShort(f.date)}${f.endDate ? ' – ' + D.formatShort(f.endDate) : ''}${f.time ? ' · ' + D.formatTime(f.time) : ''}</span>` : ''}
          </span>
          <span class="fc-when ${soon ? 'soon' : ''}">${esc(f.when)}</span>
        </button>
        ${f.kind === 'reminder' ? `<button class="fc-dismiss" data-action="dismiss" data-key="${f.key}" aria-label="Not now">${icon('x')}</button>` : ''}
      </li>`;
    }).join('')}
  </ul>`;
}

function renderForecast() {
  const items = S.forecast();
  return `
    <section class="card">
      <h2 class="card-title">Forecast</h2>
      ${items.length ? forecastList(items) : `<p class="empty">Nothing coming up. Add an <b>Event</b> with the + button and choose how far ahead to be told.</p>`}
    </section>`;
}

// ---------------------------------------------------------------- week
function renderWeek() {
  const start = D.startOfWeek(ui.date);
  const today = D.todayKey();
  const days = Array.from({ length: 7 }, (_, i) => D.addDays(start, i));
  return days.map((k) => {
    const tasks = S.tasksOn(k);
    const d = D.fromKey(k);
    const items = dayItems(k, { compact: true });
    return `
      <section class="card week-day ${k === today ? 'is-today' : ''} ${S.blockingEventsOn(k).length ? 'blocked' : ''}">
        <button class="week-head" data-action="open-day" data-date="${k}">
          <span class="wd">${D.DAY_NAMES[d.getDay()]}</span>
          <span class="wn">${d.getDate()}</span>
          <span class="wc">${tasks.length ? `${tasks.filter((t) => S.isDoneOn(t, k)).length}/${tasks.length}` : ''}</span>
        </button>
        ${items || `<button class="add-inline" data-action="add-on" data-date="${k}">+ Add</button>`}
      </section>`;
  }).join('') + renderUnscheduled();
}

// ---------------------------------------------------------------- month
function renderMonth() {
  const today = D.todayKey();
  const head = D.WEEK_ORDER.map((w) => `<div class="m-dow">${D.DAY_NAMES[w][0]}</div>`).join('');
  const cells = D.monthGrid(ui.date).map((k) => {
    const chips = [
      ...S.eventsOn(k).map((e) => ({ title: e.title, color: sectionColor(e.sectionId), ev: true })),
      ...S.milestonesOn(k).map((m) => ({ title: '⚑ ' + m.title, color: m.kind === 'goal' ? 'var(--accent)' : sectionColor(m.sectionId), done: m.done })),
      ...S.tasksOn(k).map((t) => ({ title: t.title, color: sectionColor(t.sectionId), done: S.isDoneOn(t, k) })),
    ];
    const shown = chips.slice(0, 3).map((c) =>
      `<span class="m-chip ${c.done ? 'done' : ''} ${c.ev ? 'ev' : ''}" style="--c:${c.color}">${esc(c.title)}</span>`).join('');
    const more = chips.length > 3 ? `<span class="m-more">+${chips.length - 3}</span>` : '';
    const cls = ['m-cell', D.sameMonth(k, ui.date) ? '' : 'other', k === today ? 'today' : '', k === ui.date ? 'sel' : ''].join(' ');
    return `<button class="${cls}" data-action="select-date" data-date="${k}">
      <span class="m-num">${D.fromKey(k).getDate()}</span>${shown}${more}
    </button>`;
  }).join('');

  return `
    <div class="month-grid">${head}${cells}</div>
    <section class="card">
      <h2 class="card-title">${esc(D.formatLong(ui.date))}</h2>
      ${dayItems(ui.date) || `<p class="empty">Nothing planned.</p>`}
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

// After the Home screen is drawn
export function afterHome() {
  makeSortable(document.getElementById('check-sort'), (ids) => S.reorderCheckItems(ids));
}

// ---------------------------------------------------------------- taps
export const homeActions = {
  view: (el) => { ui.view = el.dataset.view; ui.miniOpen = false; },
  prev: () => { ui.date = ui.view === 'month' ? D.addMonths(ui.date, -1) : D.addDays(ui.date, ui.view === 'week' ? -7 : -1); },
  next: () => { ui.date = ui.view === 'month' ? D.addMonths(ui.date, 1) : D.addDays(ui.date, ui.view === 'week' ? 7 : 1); },
  today: () => { ui.date = D.todayKey(); ui.miniMonth = ui.date; },
  'toggle-mini': () => { ui.miniOpen = !ui.miniOpen; ui.miniMonth = ui.date; },
  'mini-prev': () => { ui.miniMonth = D.addMonths(ui.miniMonth, -1); },
  'mini-next': () => { ui.miniMonth = D.addMonths(ui.miniMonth, 1); },
  'pick-date': (el) => { ui.date = el.dataset.date; ui.miniOpen = false; ui.view = 'day'; },
  'select-date': (el) => { ui.date = el.dataset.date; },
  'open-day': (el) => { ui.tab = 'home'; ui.page = null; ui.date = el.dataset.date; ui.view = 'day'; },
  'toggle-unscheduled': () => { ui.unscheduledOpen = !ui.unscheduledOpen; },
  toggle: (el) => { S.toggleDone(el.dataset.id, el.dataset.date || null); return false; },
  edit: (el) => { openTaskSheet({ id: el.dataset.id, date: el.dataset.date || null }); return false; },
  'edit-event': (el) => { openEventSheet({ id: el.dataset.id }); return false; },
  'add-on': (el) => { openAddSheet({ date: el.dataset.date }); return false; },
  'check-toggle': (el) => { S.toggleCheck(el.dataset.id, el.dataset.date); return false; },
  'check-edit': () => { ui.checkEdit = !ui.checkEdit; },
  'check-remove': (el) => {
    const item = S.getData().dailyCheck.items.find((i) => i.id === el.dataset.id);
    if (item && confirm(`Remove "${item.title}" from your Daily Check?`)) S.removeCheckItem(item.id);
    return false;
  },
  'check-rename': (el) => {
    const item = S.getData().dailyCheck.items.find((i) => i.id === el.dataset.id);
    const name = item && prompt('Rename item:', item.title);
    if (name && name.trim()) S.renameCheckItem(item.id, name);
    return false;
  },
  dismiss: (el) => { S.dismiss(el.dataset.key); toast('Hidden for 3 days'); return false; },
  'open-planning': () => { ui.tab = 'more'; go({ type: 'planning' }); return false; },
};

export const homeForms = {
  'check-add': (form) => {
    const v = form.title.value.trim();
    if (v) S.addCheckItem(v);
    setTimeout(() => document.querySelector('[data-form="check-add"] input')?.focus(), 0);
  },
};

export { rerender };
