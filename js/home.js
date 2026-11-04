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

  const today = D.todayKey();
  const isToday = ui.date === today;
  const d = D.fromKey(ui.date);
  let eyebrow, display;
  if (ui.view === 'day') {
    const rel = isToday ? 'Today' : ui.date === D.addDays(today, 1) ? 'Tomorrow' : ui.date === D.addDays(today, -1) ? 'Yesterday' : null;
    eyebrow = rel ? `${rel} · ${D.DAY_NAMES_LONG[d.getDay()]}` : `${D.DAY_NAMES_LONG[d.getDay()]} · ${d.getFullYear()}`;
    display = `${D.MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  } else if (ui.view === 'week') {
    eyebrow = D.startOfWeek(today) === D.startOfWeek(ui.date) ? 'This week' : String(d.getFullYear());
    display = D.formatWeekRange(ui.date);
  } else {
    eyebrow = String(d.getFullYear());
    display = D.MONTH_NAMES[d.getMonth()];
  }

  const body = ui.view === 'day' ? renderDay() : ui.view === 'week' ? renderWeek() : renderMonth();
  const onCurrent = ui.view === 'day' ? isToday : ui.view === 'week' ? D.startOfWeek(today) === D.startOfWeek(ui.date) : D.sameMonth(today, ui.date);

  return `
    <header class="home-header">
      <div class="home-top">
        <div class="eyebrow-row">
          <span class="eyebrow">${esc(eyebrow)}</span>
          ${!onCurrent ? '<button class="today-pill" data-action="today">Today</button>' : ''}
        </div>
        <div class="display-row">
          <button class="date-block" data-action="toggle-mini" aria-expanded="${ui.miniOpen}" aria-label="Choose a date">
            <span class="display">${esc(display)}<span class="caret ${ui.miniOpen ? 'up' : ''}">${icon('chev-down')}</span></span>
          </button>
          <div class="nav-btns">
            <button class="icon-btn" data-action="prev" aria-label="Previous">${icon('chev-left')}</button>
            <button class="icon-btn" data-action="next" aria-label="Next">${icon('chev-right')}</button>
          </div>
        </div>
      </div>
      ${ui.miniOpen ? renderMiniCalendar() : ''}
      <div class="seg" role="tablist">${seg}</div>
    </header>
    <div class="view-body">${body}</div>`;
}

// A calm summary at the top of today.
function renderSummary(key) {
  const tasks = S.tasksOn(key);
  const done = tasks.filter((t) => S.isDoneOn(t, key)).length;
  const events = S.eventsOn(key).length;
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  let line;
  if (!tasks.length && !events) line = 'A clear day. Nothing scheduled.';
  else if (tasks.length && done === tasks.length) line = tasks.length === 1 ? 'Your task is done. Nice work.' : `All ${tasks.length} tasks done. Nice work.`;
  else {
    const parts = [];
    if (tasks.length) parts.push(`${tasks.length - done} task${tasks.length - done === 1 ? '' : 's'} to go`);
    if (events) parts.push(`${events} event${events > 1 ? 's' : ''}`);
    line = parts.join(' · ');
  }
  const pctDone = tasks.length ? done / tasks.length : 0;
  return `
    <section class="summary">
      <div class="summary-text">
        <span class="summary-greet">${greet}</span>
        <span class="summary-line">${esc(line)}</span>
      </div>
      ${tasks.length ? `<div class="ring" style="--p:${Math.round(pctDone * 100)}" role="img" aria-label="${done} of ${tasks.length} tasks done">
        <span>${done}<small>/${tasks.length}</small></span></div>` : ''}
    </section>`;
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

  if (isToday) parts.push(renderSummary(today));
  if (isToday && D.weekday(today) === 0) {
    parts.push(`<button class="banner" data-action="open-planning">
      ${icon('calendar')}<span><b>It's Sunday.</b> Plan your week</span>${icon('chev-right')}</button>`);
  }
  parts.push(renderDailyCheck(ui.date)); // shows on every day
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
  } else if (key > D.todayKey()) {
    // A future day: show the same items, ready to check off on the day.
    body = `<ul class="task-list compact">
      ${items.map((i) => `<li class="task upcoming" style="--c:var(--accent)">
          <span class="check" aria-hidden="true"></span>
          <span class="task-main static"><span class="task-title">${esc(i.title)}</span></span>
        </li>`).join('')}
    </ul>
    <p class="hint left">Repeats every day. You can check these off on ${esc(D.formatShort(key))}.</p>`;
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
  const all = Array.from({ length: 7 }, (_, i) => D.addDays(start, i));
  // In the current week, days that have passed are hidden (they come back if you tap "Show").
  const pastDays = all.filter((k) => k < today);
  const isThisWeek = all.includes(today);
  const days = isThisWeek && !ui.showPastDays ? all.filter((k) => k >= today) : all;
  const toggle = isThisWeek && pastDays.length ? `<button class="past-toggle" data-action="toggle-past-days">
      ${ui.showPastDays ? `Hide earlier days` : `Show ${pastDays.length} earlier day${pastDays.length > 1 ? 's' : ''}`}</button>` : '';
  return toggle + days.map((k) => {
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
        ${weekCheckLine(k)}
        ${items || `<button class="add-inline" data-action="add-on" data-date="${k}">+ Add</button>`}
      </section>`;
  }).join('') + renderUnscheduled();
}

// A small Daily Check line for each day in Week view.
function weekCheckLine(k) {
  const items = S.getData().dailyCheck.items;
  if (!items.length) return '';
  const done = items.filter((i) => S.isChecked(i.id, k)).length;
  const all = done === items.length;
  return `<button class="wcheck ${all ? 'all' : ''} ${k > D.todayKey() ? 'future' : ''}" data-action="open-day" data-date="${k}">
    ${icon('check')}<span>Daily Check</span><b>${done}/${items.length}</b></button>`;
}

// ---------------------------------------------------------------- month
// Important events and tasks on a day (the only things Month view shows).
function importantOn(k) {
  return [
    ...S.eventsOn(k).filter((e) => e.important).map((e) => ({ kind: 'event', id: e.id, title: e.title, color: sectionColor(e.sectionId), time: e.time, start: e.date, end: S.eventLast(e) })),
    ...S.tasksOn(k).filter((t) => t.important).map((t) => ({ kind: 'task', id: t.id, title: t.title, color: sectionColor(t.sectionId), time: t.time, done: S.isDoneOn(t, k), repeat: Boolean(t.repeat) })),
  ];
}

function renderMonth() {
  const today = D.todayKey();
  const head = D.WEEK_ORDER.map((w) => `<div class="m-dow">${D.DAY_NAMES[w][0]}</div>`).join('');
  const cells = D.monthGrid(ui.date).map((k) => {
    const items = importantOn(k);
    const shown = items.slice(0, 2).map((c) =>
      `<span class="m-chip ${c.done ? 'done' : ''} ${c.kind === 'event' ? 'ev' : ''}" style="--c:${c.color}">${esc(c.title)}</span>`).join('');
    const more = items.length > 2 ? `<span class="m-more">+${items.length - 2}</span>` : '';
    const cls = ['m-cell', D.sameMonth(k, ui.date) ? '' : 'other', k === today ? 'today' : '', k < today ? 'past' : ''].join(' ');
    return `<button class="${cls}" data-action="open-day" data-date="${k}" aria-label="${esc(D.formatLong(k))}${items.length ? `, ${items.length} important` : ''}">
      <span class="m-num">${D.fromKey(k).getDate()}</span>${shown}${more}
    </button>`;
  }).join('');

  // The month's important dates as a list ("things to look forward to")
  const first = D.startOfMonth(ui.date);
  const n = D.daysInMonth(ui.date);
  const seen = new Set();
  const list = [];
  for (let i = 0; i < n; i++) {
    const k = D.addDays(first, i);
    for (const it of importantOn(k)) {
      const key = it.kind + it.id + (it.repeat ? '' : '');
      if (seen.has(key)) continue; // multi-day events and repeating tasks listed once
      seen.add(key);
      list.push({ ...it, date: k });
    }
  }
  const monthName = D.MONTH_NAMES[D.fromKey(ui.date).getMonth()];

  return `
    <div class="month-grid">${head}${cells}</div>
    <section class="card">
      <h2 class="card-title">${icon('star')} Important in ${esc(monthName)}</h2>
      ${list.length ? `<ul class="imp-list">${list.map((it) => {
        const d = D.fromKey(it.date);
        const multi = it.end && it.end !== it.start;
        const past = (it.end || it.date) < today;
        return `<li class="${past ? 'past' : ''}" style="--c:${it.color}">
          <button class="imp-row" data-action="${it.kind === 'event' ? 'edit-event' : 'edit'}" data-id="${it.id}" data-date="${it.date}">
            <span class="imp-date"><b>${d.getDate()}</b><small>${D.DAY_NAMES[d.getDay()]}</small></span>
            <span class="task-main-inner">
              <span class="task-title">${esc(it.title)}</span>
              <span class="task-meta">${multi ? `${D.formatMonthDay(it.start)} – ${D.formatMonthDay(it.end)}` : it.kind === 'event' ? 'Event' : 'Task'}${it.time ? ' · ' + D.formatTime(it.time) : ''}${it.repeat ? ' · repeats' : ''}</span>
            </span>
            ${!past ? `<span class="fc-when ${/^(Today|Tomorrow)/.test(D.countdown(today, it.date)) ? 'soon' : ''}">${it.date <= today && it.end && it.end >= today ? 'Now' : D.countdown(today, it.date)}</span>` : ''}
          </button>
        </li>`;
      }).join('')}</ul>`
      : `<p class="empty">Nothing marked important this month. When you add an event or task, turn on <b>Important</b> and it will show here.</p>`}
    </section>
    <p class="hint center">Tap any day to see everything planned for it.</p>`;
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
  'toggle-past-days': () => { ui.showPastDays = !ui.showPastDays; },
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
