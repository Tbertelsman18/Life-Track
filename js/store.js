// The data store. All of your data lives in one object that is saved to
// this device's storage (localStorage) every time something changes.
// Nothing is ever sent anywhere.

import * as D from './dates.js';

const STORAGE_KEY = 'lifeTracker.data';
export const DATA_VERSION = 2;

export const SECTION_COLORS = [
  '#4f7cac', // dusk blue
  '#5b8c6b', // sage green
  '#b5654f', // terracotta
  '#c39239', // ochre
  '#8a76b5', // lavender
  '#b86f8f', // rose
  '#3f8f8a', // teal
  '#c47c48', // clay
  '#6b7a86', // slate
  '#8f7356', // walnut
];

// The brighter colors used before the redesign, mapped to their calmer versions.
const OLD_COLORS = ['#3b82f6', '#22a06b', '#e5484d', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#a16207'];
const calmer = (c) => { const i = OLD_COLORS.indexOf(c); return i >= 0 ? SECTION_COLORS[i] : c; };

export const LEAD_TIMES = [
  { id: '1d', label: '1 day', days: 1 },
  { id: '3d', label: '3 days', days: 3 },
  { id: '1w', label: '1 week', days: 7 },
  { id: '2w', label: '2 weeks', days: 14 },
  { id: '1m', label: '1 month', days: 30 },
];

// The Goals feature is switched off for now. Your goals data is kept safe in
// storage and backups; set this back to true to bring the Goals tab back.
export const GOALS_ON = false;

export const PROJECT_STATUSES = ['Not started', 'In progress', 'Stuck', 'Done'];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const nowISO = () => new Date().toISOString();

function defaultData() {
  return {
    version: DATA_VERSION,
    settings: { defaultView: 'day' },
    sections: [
      { id: 'work', name: 'Work', color: '#4f7cac' },
      { id: 'personal', name: 'Personal', color: '#5b8c6b' },
    ],
    tasks: [],
    events: [],
    dailyCheck: { items: [], done: {} },
    projects: [],
    yearlyGoals: [],
    quarterlyGoals: [],
    dismissed: {},
    info: [],
    lists: [],
    grades: {},
    dayOrder: {},
  };
}

/*
  What each kind of item looks like:

  task:     { id, title, notes, date|null, time|null, sectionId, projectId, goalId, atWork,
              done, doneAt, repeat: null | { days:[0-6], until, doneDates:{date:iso}, skips:[] },
              pushes:[{from,to,at}], seriesId?, createdAt }
  event:    { id, title, date, endDate|null, time|null, sectionId, lead:'1w', notes }
  project:  { id, title, notes, sectionId, status, targetDate, state:'active'|'radar'|'done',
              order, miniGoals:[{id,title,date,done}], lastWorkedAt, completedAt, createdAt }
  yearly:   { id, year, title, notes, createdAt }
  quarterly:{ id, yearlyId, year, q, title, notes, miniGoals:[{id,title,date,done}],
              targets:[{ id, label, perWeek, manual:{weekStart:n} }], createdAt }
  info:     { id, title, body, createdAt }
  list:     { id, name, checkable, items:[{id,text,note,checked}], createdAt }
  dayOrder: { 'YYYY-MM-DD': [taskId, ...] }  the order you dragged tasks into on that day
*/

let data = load();
orderSteps();
// Routines made before "stay until done" existed start counting from today.
for (const i of data.dailyCheck.items) if (!i.since) i.since = D.todayKey();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Could not read saved data', e);
  }
  return defaultData();
}

// Fills in anything missing so older saved data keeps working as the app grows.
function migrate(d) {
  const base = defaultData();
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    ...base,
    ...d,
    version: DATA_VERSION,
    settings: { ...base.settings, ...(d.settings || {}) },
    sections: Array.isArray(d.sections) ? d.sections.map((x) => ({ ...x, color: calmer(x.color) })) : base.sections,
    tasks: arr(d.tasks),
    events: arr(d.events),
    dailyCheck: {
      items: arr(d.dailyCheck?.items),
      done: d.dailyCheck?.done && typeof d.dailyCheck.done === 'object' ? d.dailyCheck.done : {},
    },
    projects: arr(d.projects),
    yearlyGoals: arr(d.yearlyGoals),
    quarterlyGoals: arr(d.quarterlyGoals),
    dismissed: d.dismissed && typeof d.dismissed === 'object' ? d.dismissed : {},
    info: arr(d.info),
    lists: arr(d.lists),
    grades: d.grades && typeof d.grades === 'object' ? d.grades : {},
    dayOrder: d.dayOrder && typeof d.dayOrder === 'object' ? d.dayOrder : {},
  };
}

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); }

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    alert('Could not save. Your device storage may be full.');
  }
  listeners.forEach((fn) => fn());
}

export function getData() { return data; }

// Save without redrawing the screen (used while typing notes).
export function saveQuietly() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* shown on next save */ }
}

// ---------- Settings ----------
export function setSetting(key, value) {
  data.settings[key] = value;
  save();
}

export function dismiss(key) {
  data.dismissed[key] = nowISO();
  save();
}

// ---------- Sections ----------
export function getSection(id) {
  return data.sections.find((s) => s.id === id) || null;
}

export function addSection(name, color) {
  const used = new Set(data.sections.map((s) => s.color));
  const section = {
    id: uid(),
    name: name.trim(),
    color: color || SECTION_COLORS.find((c) => !used.has(c)) || SECTION_COLORS[0],
  };
  data.sections.push(section);
  save();
  return section;
}

export function updateSection(id, changes) {
  const s = getSection(id);
  if (s) Object.assign(s, changes);
  save();
}

// Tasks, events and projects in a deleted section move to another section.
export function deleteSection(id, moveToId) {
  data.sections = data.sections.filter((s) => s.id !== id);
  for (const list of [data.tasks, data.events, data.projects]) {
    list.forEach((x) => { if (x.sectionId === id) x.sectionId = moveToId || null; });
  }
  save();
}

export function countTasksInSection(id) {
  return data.tasks.filter((t) => t.sectionId === id).length;
}

// ---------- Tasks ----------
export function getTask(id) {
  return data.tasks.find((t) => t.id === id) || null;
}

export function addTask(fields) {
  const task = {
    id: uid(),
    title: '',
    notes: '',
    date: null,
    time: null,
    sectionId: data.sections[0]?.id || null,
    projectId: null,
    goalId: null,
    atWork: false,
    done: false,
    doneAt: null,
    repeat: null,
    pushes: [],
    createdAt: nowISO(),
    ...fields,
  };
  data.tasks.push(task);
  touchProject(task.projectId);
  save();
  return task;
}

export function updateTask(id, changes) {
  const t = getTask(id);
  if (!t) return;
  // Moving a one-time task to a later day (or off the calendar) = "pushed off"
  if (!t.repeat && !changes.repeat && 'date' in changes && t.date && changes.date !== t.date) {
    if (!changes.date || changes.date > t.date) {
      t.pushes = t.pushes || [];
      t.pushes.push({ from: t.date, to: changes.date || null, at: nowISO() });
    }
  }
  Object.assign(t, changes);
  save();
}

export function deleteTask(id) {
  data.tasks = data.tasks.filter((t) => t.id !== id);
  save();
}

// Does a task happen on this date?
export function occursOn(task, key) {
  if (!task.repeat) return task.date === key;
  const r = task.repeat;
  if (task.date && key < task.date) return false;
  if (r.until && key > r.until) return false;
  if ((r.skips || []).includes(key)) return false;
  return r.days.includes(D.weekday(key));
}

export function isDoneOn(task, key) {
  if (task.repeat) return Boolean(task.repeat.doneDates && task.repeat.doneDates[key]);
  return task.done;
}

export function toggleDone(id, key) {
  const t = getTask(id);
  if (!t) return;
  if (t.repeat) {
    t.repeat.doneDates = t.repeat.doneDates || {};
    if (t.repeat.doneDates[key]) delete t.repeat.doneDates[key];
    else t.repeat.doneDates[key] = nowISO();
  } else {
    t.done = !t.done;
    t.doneAt = t.done ? nowISO() : null;
  }
  touchProject(t.projectId);
  save();
}

export function skipOccurrence(id, key) {
  const t = getTask(id);
  if (!t || !t.repeat) return;
  t.repeat.skips = [...new Set([...(t.repeat.skips || []), key])];
  save();
}

// Move one day of a recurring series to another day. This creates a
// one-time copy on the new day and records it as pushed off.
export function moveOccurrence(id, fromK, toK) {
  const t = getTask(id);
  if (!t || !t.repeat) return null;
  t.repeat.skips = [...new Set([...(t.repeat.skips || []), fromK])];
  const copy = {
    id: uid(),
    title: t.title,
    notes: t.notes,
    date: toK || null,
    time: t.time,
    sectionId: t.sectionId,
    projectId: t.projectId,
    goalId: t.goalId,
    atWork: Boolean(t.atWork),
    done: false,
    doneAt: null,
    repeat: null,
    seriesId: t.id,
    pushes: (!toK || toK > fromK) ? [{ from: fromK, to: toK || null, at: nowISO() }] : [],
    createdAt: nowISO(),
  };
  data.tasks.push(copy);
  save();
  return copy;
}

const byTimeThenCreated = (key) => (a, b) => {
  const da = isDoneOn(a, key), db = isDoneOn(b, key);
  if (da !== db) return da ? 1 : -1;
  // Your own drag order for the day comes first; new tasks go to the end.
  const order = data.dayOrder[key] || [];
  const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return (a.createdAt || '').localeCompare(b.createdAt || '');
};

// Tasks on a day: not done first (in the order you dragged them into,
// otherwise timed in time order, then untimed), then finished tasks at the bottom.
export function tasksOn(key) {
  return data.tasks.filter((t) => occursOn(t, key)).sort(byTimeThenCreated(key));
}

// Save the order you dragged a day's tasks into. workIds are the tasks now in
// the "At work" box; the rest are taken out of it.
export function setDayOrder(key, ids, workIds = null) {
  data.dayOrder[key] = ids;
  if (workIds) {
    const work = new Set(workIds);
    for (const id of ids) { const t = getTask(id); if (t) t.atWork = work.has(id); }
  }
  // Forget orders older than 60 days so this doesn't grow forever
  const cutoff = D.addDays(D.todayKey(), -60);
  for (const k of Object.keys(data.dayOrder)) if (k < cutoff) delete data.dayOrder[k];
  save();
}

// Undated tasks that aren't inside a project (project tasks live in the project).
export function unscheduledTasks() {
  return data.tasks
    .filter((t) => !t.date && !t.repeat && !t.projectId)
    .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
}

// Every completion as { task, date } where date is the day it counts for.
export function completions() {
  const out = [];
  for (const t of data.tasks) {
    if (t.repeat) {
      for (const k of Object.keys(t.repeat.doneDates || {})) out.push({ task: t, date: k });
    } else if (t.done) {
      out.push({ task: t, date: t.doneAt ? D.keyOfISO(t.doneAt) : (t.date || D.todayKey()) });
    }
  }
  return out;
}

// ---------- Events ----------
export function getEvent(id) {
  return data.events.find((e) => e.id === id) || null;
}

export function addEvent(fields) {
  const ev = {
    id: uid(), title: '', date: D.todayKey(), endDate: null, time: null,
    sectionId: data.sections[0]?.id || null, lead: '1w', notes: '', createdAt: nowISO(), ...fields,
  };
  data.events.push(ev);
  save();
  return ev;
}

export function updateEvent(id, changes) {
  const ev = getEvent(id);
  if (ev) Object.assign(ev, changes);
  save();
}

export function deleteEvent(id) {
  data.events = data.events.filter((e) => e.id !== id);
  save();
}

export function eventLast(ev) {
  return ev.endDate && ev.endDate > ev.date ? ev.endDate : ev.date;
}

export function eventsOn(key) {
  return data.events
    .filter((e) => e.date <= key && key <= eventLast(e))
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

// Multi-day events covering a date (used for "you're away" warnings).
export function blockingEventsOn(key) {
  return data.events.filter((e) => e.endDate && e.endDate > e.date && e.date <= key && key <= e.endDate);
}

export function leadDays(id) {
  return (LEAD_TIMES.find((l) => l.id === id) || LEAD_TIMES[2]).days;
}

// ---------- Forecast ----------
// Upcoming things to know about, nearest first.
export function forecast(today = D.todayKey()) {
  const items = [];

  for (const e of data.events) {
    const last = eventLast(e);
    if (last < today) continue;
    if (e.date > today && D.daysBetween(today, e.date) > leadDays(e.lead)) continue;
    const ongoing = e.date <= today && today <= last && last !== e.date;
    items.push({
      kind: 'event', id: e.id, title: e.title, date: e.date, endDate: e.endDate, time: e.time,
      sectionId: e.sectionId,
      when: ongoing ? `Now · ends ${D.formatMonthDay(last)}` : D.countdown(today, e.date),
      sort: ongoing ? today : e.date,
    });
  }

  // Project target dates and mini goals in the next 7 days
  for (const p of data.projects) {
    if (p.state === 'done') continue;
    if (p.targetDate && p.targetDate >= today && D.daysBetween(today, p.targetDate) <= 7) {
      items.push({ kind: 'project', id: p.id, title: `${p.title} — target date`, date: p.targetDate,
        sectionId: p.sectionId, when: D.countdown(today, p.targetDate), sort: p.targetDate });
    }
    for (const m of p.miniGoals || []) {
      if (!m.done && m.date && m.date >= today && D.daysBetween(today, m.date) <= 7) {
        items.push({ kind: 'project', id: p.id, title: `${m.title} (${p.title})`, date: m.date,
          sectionId: p.sectionId, when: D.countdown(today, m.date), sort: m.date });
      }
    }
  }

  // Goal mini goals in the next 7 days
  for (const g of GOALS_ON ? data.quarterlyGoals : []) {
    for (const m of g.miniGoals || []) {
      if (!m.done && m.date && m.date >= today && D.daysBetween(today, m.date) <= 7) {
        items.push({ kind: 'goal', id: g.id, title: `${m.title} (${g.title})`, date: m.date,
          when: D.countdown(today, m.date), sort: m.date });
      }
    }
  }

  items.push(...goalReminders(today));
  return items.sort((a, b) => a.sort.localeCompare(b.sort));
}

// "Set your goals" reminders.
export function goalReminders(today = D.todayKey()) {
  const out = [];
  if (!GOALS_ON) return out;
  const cur = D.quarterOf(today);
  const next = D.nextQuarter(cur.year, cur.q);
  const nextStart = D.quarterStart(next.year, next.q);
  const untilNext = D.daysBetween(today, nextStart);

  // 2 weeks before a quarter starts (and until goals are set)
  if (untilNext <= 14 && !hasQuarterPlan(next.year, next.q)) {
    out.push({ kind: 'reminder', action: 'plan-quarter', year: next.year, q: next.q,
      key: `q-${next.year}-${next.q}`,
      title: `Set your goals for ${D.quarterLabel(next.year, next.q)}`,
      when: D.countdown(today, nextStart), sort: today });
  }
  // A quarter has started with no goals
  if (!hasQuarterPlan(cur.year, cur.q) && data.yearlyGoals.some((g) => g.year === cur.year)) {
    out.push({ kind: 'reminder', action: 'plan-quarter', year: cur.year, q: cur.q,
      key: `q-${cur.year}-${cur.q}`,
      title: `Set your goals for ${D.quarterLabel(cur.year, cur.q)}`, when: 'Now', sort: today });
  }
  // Early December: next year's yearly goals
  const month = D.fromKey(today).getMonth();
  if (month === 11 && !data.yearlyGoals.some((g) => g.year === cur.year + 1)) {
    out.push({ kind: 'reminder', action: 'plan-year', year: cur.year + 1,
      key: `y-${cur.year + 1}`,
      title: `Set your yearly goals for ${cur.year + 1}`,
      when: D.countdown(today, `${cur.year + 1}-01-01`), sort: today });
  }
  // No yearly goals at all for this year
  if (!data.yearlyGoals.some((g) => g.year === cur.year)) {
    out.push({ kind: 'reminder', action: 'plan-year', year: cur.year,
      key: `y-${cur.year}`,
      title: `Set your yearly goals for ${cur.year}`, when: 'Now', sort: today });
  }
  // "Not now" hides a reminder for 3 days
  const seen = new Set();
  const snoozed = (k) => data.dismissed[k] && D.daysBetween(D.keyOfISO(data.dismissed[k]), today) < 3;
  return out.filter((r) => !snoozed(r.key) && !seen.has(r.key) && seen.add(r.key));
}

// ---------- Routines (was "Daily Check") ----------
// Simple things you repeat each week. Each item has the weekdays it shows on
// (0 = Sunday ... 6 = Saturday); items saved before this have no days = every day.
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export function routineDays(item) {
  return Array.isArray(item.days) && item.days.length ? item.days : ALL_DAYS;
}

// A routine on just one day a week (like a fish tank water change) stays on
// your list from that day until you check it off, then waits for next week.
export function isWeeklyRoutine(item) {
  return routineDays(item).length === 1;
}

// The day this routine was last due, on or before `key` (null if not yet due).
export function routineDueSince(item, key) {
  const days = routineDays(item);
  for (let n = 0; n < 7; n++) {
    const k = D.addDays(key, -n);
    if (item.since && k < item.since) return null;
    if (days.includes(D.weekday(k))) return k;
  }
  return null;
}

// Is a weekly routine showing on `key` only because it hasn't been done yet?
export function routineCarried(item, key) {
  if (!isWeeklyRoutine(item)) return false;
  const due = routineDueSince(item, key);
  if (!due || due === key) return false;
  for (let k = due; k < key; k = D.addDays(k, 1)) if (isChecked(item.id, k)) return false;
  return true;
}

// The routine items that show on a given day, in your order.
export function routinesOn(key) {
  const wd = D.weekday(key);
  return data.dailyCheck.items.filter((i) => routineDays(i).includes(wd) || routineCarried(i, key));
}

// Routine categories in the order they first appear (e.g. Work, Maintenance).
export function routineCategories() {
  return [...new Set(data.dailyCheck.items.map((i) => (i.category || '').trim()).filter(Boolean))];
}

export function addCheckItem(title, days = ALL_DAYS, category = '') {
  data.dailyCheck.items.push({ id: uid(), title: title.trim(), days: [...days].sort(),
    category: (category || '').trim(), since: D.todayKey() });
  save();
}

export function updateCheckItem(id, { title, days, category }) {
  const i = data.dailyCheck.items.find((x) => x.id === id);
  if (!i) return;
  if (title !== undefined) i.title = title.trim();
  if (days !== undefined) i.days = [...days].sort();
  if (category !== undefined) i.category = (category || '').trim();
  save();
}

export function removeCheckItem(id) {
  data.dailyCheck.items = data.dailyCheck.items.filter((i) => i.id !== id);
  save();
}

export function renameCheckItem(id, title) {
  const i = data.dailyCheck.items.find((x) => x.id === id);
  if (i) i.title = title.trim();
  save();
}

export function isChecked(itemId, key) {
  return Boolean(data.dailyCheck.done[key]?.[itemId]);
}

export function toggleCheck(itemId, key) {
  const day = data.dailyCheck.done[key] || (data.dailyCheck.done[key] = {});
  if (day[itemId]) delete day[itemId]; else day[itemId] = true;
  // Keep only the last 120 days of check history
  const cutoff = D.addDays(D.todayKey(), -120);
  for (const k of Object.keys(data.dailyCheck.done)) if (k < cutoff) delete data.dailyCheck.done[k];
  save();
}

export function reorderCheckItems(ids) {
  const map = new Map(data.dailyCheck.items.map((i) => [i.id, i]));
  data.dailyCheck.items = ids.map((id) => map.get(id)).filter(Boolean);
  save();
}

// ---------- Projects ----------
export function getProject(id) {
  return data.projects.find((p) => p.id === id) || null;
}

export function projectsIn(state) {
  return data.projects.filter((p) => p.state === state).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function addProject(fields) {
  const state = fields.state || 'active';
  const p = {
    id: uid(), title: '', notes: '', sectionId: data.sections[0]?.id || null,
    status: 'Not started', targetDate: null, state,
    order: projectsIn(state).length, miniGoals: [], lastWorkedAt: null, completedAt: null,
    createdAt: nowISO(), ...fields,
  };
  data.projects.push(p);
  save();
  return p;
}

export function updateProject(id, changes, { worked = false } = {}) {
  const p = getProject(id);
  if (!p) return;
  Object.assign(p, changes);
  if (worked) p.lastWorkedAt = nowISO();
  save();
}

function touchProject(id) {
  const p = id && getProject(id);
  if (p) {
    p.lastWorkedAt = nowISO();
    if (p.status === 'Not started' && projectTasks(id).some((t) => t.done)) p.status = 'In progress';
  }
}

export function deleteProject(id) {
  data.projects = data.projects.filter((p) => p.id !== id);
  data.tasks.forEach((t) => { if (t.projectId === id) t.projectId = null; });
  save();
}

export function reorderProjects(state, ids) {
  ids.forEach((id, i) => { const p = getProject(id); if (p) { p.order = i; p.state = state; } });
  save();
}

// Move a project between Active / Radar / Done. New arrivals go to the bottom
// (Radar → Active goes to the bottom of Active; you can drag it up).
export function moveProject(id, state) {
  const p = getProject(id);
  if (!p) return;
  p.state = state;
  p.order = projectsIn(state).filter((x) => x.id !== id).length;
  if (state === 'done') { p.status = 'Done'; p.completedAt = nowISO(); }
  else if (p.status === 'Done') { p.status = 'In progress'; p.completedAt = null; }
  save();
}

export function projectTasks(id) {
  return data.tasks.filter((t) => t.projectId === id)
    .sort((a, b) => {
      if (Boolean(a.repeat) !== Boolean(b.repeat)) return a.repeat ? 1 : -1;
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.date || '9999').localeCompare(b.date || '9999') || (a.createdAt || '').localeCompare(b.createdAt || '');
    });
}

export function projectProgress(id) {
  const tasks = projectTasks(id).filter((t) => !t.repeat);
  return { done: tasks.filter((t) => t.done).length, total: tasks.length };
}

// Dated project and goal mini goals on a given day, for the calendar.
export function milestonesOn(key) {
  const out = [];
  for (const p of data.projects) {
    if (p.state === 'done') continue;
    if (p.targetDate === key) out.push({ kind: 'project', id: p.id, title: `${p.title} target`, sectionId: p.sectionId, done: false });
    for (const m of p.miniGoals || []) {
      if (m.date === key) out.push({ kind: 'project', id: p.id, title: m.title, sectionId: p.sectionId, done: m.done });
    }
  }
  for (const g of GOALS_ON ? data.quarterlyGoals : []) {
    for (const m of g.miniGoals || []) {
      if (m.date === key) out.push({ kind: 'goal', id: g.id, title: m.title, sectionId: null, done: m.done });
    }
  }
  return out;
}

// Mini goals live on projects and quarterly goals.
export function addMiniGoal(owner, title, date) {
  owner.miniGoals = owner.miniGoals || [];
  owner.miniGoals.push({ id: uid(), title: title.trim(), date: date || null, done: false });
  save();
}

export function toggleMiniGoal(owner, mid) {
  const m = (owner.miniGoals || []).find((x) => x.id === mid);
  if (m) { m.done = !m.done; m.doneAt = m.done ? nowISO() : null; }
  save();
}

export function deleteMiniGoal(owner, mid) {
  owner.miniGoals = (owner.miniGoals || []).filter((x) => x.id !== mid);
  save();
}

// ---------- Goals ----------
export function getYearly(id) { return data.yearlyGoals.find((g) => g.id === id) || null; }
export function getQuarterly(id) { return data.quarterlyGoals.find((g) => g.id === id) || null; }

export function yearlyFor(year) {
  return data.yearlyGoals.filter((g) => g.year === year);
}

// Steps that count for a quarter: ones set to that quarter, plus unfinished
// steps with no specific quarter ("any time") from the same year.
export function stepsForQuarter(year, q, yearlyId) {
  return data.quarterlyGoals.filter((g) => g.year === year && (!yearlyId || g.yearlyId === yearlyId)
    && (g.q === q || (!g.q && !g.done))).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function hasQuarterPlan(year, q) {
  return stepsForQuarter(year, q).length > 0;
}

export function quarterlyFor(year, q, yearlyId) {
  return data.quarterlyGoals.filter((g) => g.year === year && g.q === q && (!yearlyId || g.yearlyId === yearlyId));
}

export function addYearly(fields) {
  const g = { id: uid(), year: new Date().getFullYear(), title: '', notes: '', createdAt: nowISO(), ...fields };
  data.yearlyGoals.push(g);
  save();
  return g;
}

export function updateYearly(id, changes) {
  const g = getYearly(id);
  if (g) Object.assign(g, changes);
  save();
}

export function deleteYearly(id) {
  const qIds = new Set(data.quarterlyGoals.filter((q) => q.yearlyId === id).map((q) => q.id));
  const targetIds = new Set(data.quarterlyGoals.filter((q) => qIds.has(q.id)).flatMap((q) => (q.targets || []).map((t) => t.id)));
  data.quarterlyGoals = data.quarterlyGoals.filter((q) => q.yearlyId !== id);
  data.yearlyGoals = data.yearlyGoals.filter((g) => g.id !== id);
  data.tasks.forEach((t) => {
    if (t.goalId === id || qIds.has(t.goalId) || targetIds.has(t.goalId)) t.goalId = null;
  });
  save();
}

export function addQuarterly(fields) {
  const g = { id: uid(), yearlyId: null, year: new Date().getFullYear(), q: null, title: '', notes: '',
    miniGoals: [], targets: [], done: false, createdAt: nowISO(), ...fields };
  if (g.order === undefined) g.order = data.quarterlyGoals.filter((x) => x.yearlyId === g.yearlyId).length;
  data.quarterlyGoals.push(g);
  save();
  return g;
}

export function updateQuarterly(id, changes) {
  const g = getQuarterly(id);
  if (g) Object.assign(g, changes);
  save();
}

export function deleteQuarterly(id) {
  const g = getQuarterly(id);
  const ids = new Set([id, ...((g?.targets) || []).map((t) => t.id)]);
  data.quarterlyGoals = data.quarterlyGoals.filter((x) => x.id !== id);
  data.tasks.forEach((t) => { if (ids.has(t.goalId)) t.goalId = null; });
  save();
}

export function addTarget(goal, label, perWeek) {
  goal.targets = goal.targets || [];
  goal.targets.push({ id: uid(), label: label.trim(), perWeek: Math.max(1, Number(perWeek) || 1), manual: {}, createdAt: nowISO() });
  save();
}

export function deleteTarget(goal, tid) {
  goal.targets = (goal.targets || []).filter((t) => t.id !== tid);
  data.tasks.forEach((t) => { if (t.goalId === tid) t.goalId = null; });
  save();
}

export function adjustTarget(goal, tid, weekStart, delta) {
  const t = (goal.targets || []).find((x) => x.id === tid);
  if (!t) return;
  t.manual = t.manual || {};
  t.manual[weekStart] = Math.max(0, (t.manual[weekStart] || 0) + delta);
  save();
}

// Find what a task's goalId points to: { yearly, quarterly, target }
export function resolveGoal(goalId) {
  if (!goalId) return null;
  const y = getYearly(goalId);
  if (y) return { yearly: y, quarterly: null, target: null };
  const q = getQuarterly(goalId);
  if (q) return { yearly: getYearly(q.yearlyId), quarterly: q, target: null };
  for (const g of data.quarterlyGoals) {
    const t = (g.targets || []).find((x) => x.id === goalId);
    if (t) return { yearly: getYearly(g.yearlyId), quarterly: g, target: t };
  }
  return null;
}

// Completed tasks linked to a goal (yearly includes its quarterly goals and targets).
export function goalCompletions(goalId) {
  const ids = new Set([goalId]);
  for (const g of data.quarterlyGoals) {
    if (g.id === goalId || g.yearlyId === goalId) {
      ids.add(g.id);
      (g.targets || []).forEach((t) => ids.add(t.id));
    }
  }
  return completions().filter((c) => ids.has(c.task.goalId)).sort((a, b) => b.date.localeCompare(a.date));
}

// How many times a weekly target was hit in a given week.
export function targetCount(target, weekStart) {
  const end = D.addDays(weekStart, 6);
  const auto = completions().filter((c) => c.task.goalId === target.id && c.date >= weekStart && c.date <= end).length;
  return auto + ((target.manual && target.manual[weekStart]) || 0);
}

// Weeks of a target, from the goal's quarter start to this week (or quarter end).
export function targetWeeks(goal, target, today = D.todayKey()) {
  // Start from the quarter's first week, or the week the target was added if later
  let qs = D.startOfWeek(goal.q ? D.quarterStart(goal.year, goal.q) : `${goal.year}-01-01`);
  const added = target.createdAt || goal.createdAt;
  if (added && D.startOfWeek(D.keyOfISO(added)) > qs) qs = D.startOfWeek(D.keyOfISO(added));
  const qe = goal.q ? D.quarterEnd(goal.year, goal.q) : `${goal.year}-12-31`;
  const lastWeek = D.startOfWeek(today < qe ? today : qe);
  const weeks = [];
  for (let w = qs; w <= lastWeek; w = D.addDays(w, 7)) {
    const count = targetCount(target, w);
    weeks.push({ weekStart: w, count, hit: count >= target.perWeek, current: w === D.startOfWeek(today) });
  }
  return weeks;
}

// Current streak of hit weeks. The current week counts only once it's hit.
export function targetStreak(weeks) {
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i];
    if (w.hit) streak++;
    else if (w.current) continue;
    else break;
  }
  return streak;
}

// Progress of a quarterly goal from 0 to 1 (or null if there is nothing to measure).
// It averages: mini goals done, and weekly target hit rate (finished weeks).
export function quarterlyProgress(g, today = D.todayKey()) {
  if (g.done) return 1;
  const parts = [];
  const tasks = stepTasks(g.id).filter((t) => !t.repeat);
  if (tasks.length) parts.push(tasks.filter((t) => t.done).length / tasks.length);
  const minis = g.miniGoals || [];
  if (minis.length) parts.push(minis.filter((m) => m.done).length / minis.length);
  for (const t of g.targets || []) {
    const weeks = targetWeeks(g, t, today).filter((w) => !w.current || w.hit);
    if (weeks.length) parts.push(weeks.filter((w) => w.hit).length / weeks.length);
  }
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

// ---------- Steps (sub goals, in order) ----------
export function stepsFor(yearlyId) {
  return data.quarterlyGoals.filter((g) => g.yearlyId === yearlyId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function currentStep(yearlyId) {
  return stepsFor(yearlyId).find((g) => !g.done) || null;
}

export function stepNumber(g) {
  return stepsFor(g.yearlyId).findIndex((x) => x.id === g.id) + 1;
}

export function reorderSteps(ids) {
  ids.forEach((id, i) => { const g = getQuarterly(id); if (g) g.order = i; });
  save();
}

export function setStepDone(id, done) {
  const g = getQuarterly(id);
  if (!g) return;
  g.done = done;
  g.doneAt = done ? nowISO() : null;
  save();
}

// Tasks linked to a step (or one of its weekly targets): open ones first.
export function stepTasks(id) {
  const g = getQuarterly(id);
  const ids = new Set([id, ...((g?.targets) || []).map((t) => t.id)]);
  return data.tasks.filter((t) => ids.has(t.goalId))
    .sort((a, b) => (a.done - b.done) || (a.date || '9999').localeCompare(b.date || '9999') || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export function yearlyProgress(y, today = D.todayKey()) {
  // Every step counts; a step with nothing measured yet counts as 0%.
  const vals = data.quarterlyGoals.filter((q) => q.yearlyId === y.id)
    .map((q) => quarterlyProgress(q, today) ?? 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Last date anything happened on a goal (linked task done, mini goal done, manual target tally).
export function lastGoalActivity(goalId) {
  let last = null;
  const bump = (k) => { if (k && (!last || k > last)) last = k; };
  const c = goalCompletions(goalId)[0];
  if (c) bump(c.date);
  for (const g of data.quarterlyGoals) {
    if (g.id !== goalId && g.yearlyId !== goalId) continue;
    (g.miniGoals || []).forEach((m) => { if (m.done && m.doneAt) bump(D.keyOfISO(m.doneAt)); });
    (g.targets || []).forEach((t) => Object.entries(t.manual || {}).forEach(([w, n]) => { if (n > 0) bump(w); }));
  }
  return last;
}

// ---------- End-of-day grades ----------
export const GRADE_LABELS = ['', 'Rough', 'Meh', 'Okay', 'Good', 'Great'];

// What you grade each day: your main goals for that year, plus the day overall.
export function gradeCategories(key = D.todayKey()) {
  const year = D.fromKey(key).getFullYear();
  const goals = (GOALS_ON ? yearlyFor(year) : []).map((g) => ({ id: g.id, label: g.title, goal: true }));
  const cats = goals.length ? goals : data.sections.map((s) => ({ id: s.id, label: s.name, color: s.color }));
  return [...cats, { id: 'overall', label: 'The day overall' }];
}

export function getGrade(key) {
  return data.grades[key] || { scores: {}, note: '' };
}

export function setGrade(key, catId, score) {
  const g = data.grades[key] || (data.grades[key] = { scores: {}, note: '' });
  if (g.scores[catId] === score) delete g.scores[catId]; else g.scores[catId] = score;
  save();
}

// Daily reflection answers, saved per day: { good, better, tasks, goals }
export function setReflection(key, field, value) {
  const g = data.grades[key] || (data.grades[key] = { scores: {}, note: '' });
  g.reflect = { ...(g.reflect || {}), [field]: value };
  saveQuietly();
}

export function setGradeNote(key, note) {
  const g = data.grades[key] || (data.grades[key] = { scores: {}, note: '' });
  g.note = note;
  saveQuietly();
}

// Average grade for a category over the last n days (null if none).
export function gradeAverage(catId, n = 7, today = D.todayKey()) {
  const vals = [];
  for (let i = 0; i < n; i++) {
    const v = data.grades[D.addDays(today, -i)]?.scores?.[catId];
    if (v) vals.push(v);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

// Completed tasks on a day that count toward a main goal (for the review card).
export function goalDoneOn(yearlyId, key) {
  return goalCompletions(yearlyId).filter((c) => c.date === key).length;
}

// ---------- Repeating tasks ----------
export function repeatingTasks() {
  return data.tasks.filter((t) => t.repeat && (!t.repeat.until || t.repeat.until >= D.todayKey()))
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.title.localeCompare(b.title));
}

export function toggleRepeatDay(id, day) {
  const t = getTask(id);
  if (!t || !t.repeat) return;
  const set = new Set(t.repeat.days);
  if (set.has(day)) { if (set.size > 1) set.delete(day); } else set.add(day);
  t.repeat.days = [...set].sort();
  save();
}

// ---------- Info ----------
export function addInfo(fields) {
  const i = { id: uid(), title: '', body: '', createdAt: nowISO(), ...fields };
  data.info.unshift(i);
  save();
  return i;
}
export function updateInfo(id, changes) {
  const i = data.info.find((x) => x.id === id);
  if (i) Object.assign(i, changes);
  save();
}
export function deleteInfo(id) {
  data.info = data.info.filter((x) => x.id !== id);
  save();
}

// ---------- Lists ----------
export function getList(id) { return data.lists.find((l) => l.id === id) || null; }

export function addList(name, checkable = false) {
  const l = { id: uid(), name: name.trim(), checkable, items: [], createdAt: nowISO() };
  data.lists.push(l);
  save();
  return l;
}
export function updateList(id, changes) {
  const l = getList(id);
  if (l) Object.assign(l, changes);
  save();
}
export function deleteList(id) {
  data.lists = data.lists.filter((l) => l.id !== id);
  save();
}
export function addListItem(listId, text, note = '') {
  const l = getList(listId);
  if (!l) return;
  l.items.push({ id: uid(), text: text.trim(), note: note.trim(), checked: false });
  save();
}
export function updateListItem(listId, itemId, changes) {
  const it = getList(listId)?.items.find((i) => i.id === itemId);
  if (it) Object.assign(it, changes);
  save();
}
export function deleteListItem(listId, itemId) {
  const l = getList(listId);
  if (l) l.items = l.items.filter((i) => i.id !== itemId);
  save();
}
export function reorderListItems(listId, ids) {
  const l = getList(listId);
  if (!l) return;
  const map = new Map(l.items.map((i) => [i.id, i]));
  l.items = ids.map((id) => map.get(id)).filter(Boolean);
  save();
}
export function reorderLists(ids) {
  const map = new Map(data.lists.map((l) => [l.id, l]));
  data.lists = ids.map((id) => map.get(id)).filter(Boolean);
  save();
}

// ---------- Pushed off ----------
// Tasks grouped by title, most pushed first.
export function mostPushed(limit = 10) {
  const groups = new Map();
  for (const t of data.tasks) {
    const n = (t.pushes || []).length;
    if (!n) continue;
    const key = t.seriesId || t.title.trim().toLowerCase();
    const g = groups.get(key) || { title: t.title, count: 0, sectionId: t.sectionId, last: null, ids: [] };
    g.count += n;
    g.ids.push(t.id);
    const lastPush = t.pushes[t.pushes.length - 1].at;
    if (!g.last || lastPush > g.last) g.last = lastPush;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || (b.last || '').localeCompare(a.last || '')).slice(0, limit);
}

// Not-done tasks that were pushed off in the 7 days before `today`.
export function pushedLastWeek(today = D.todayKey()) {
  const from = D.addDays(today, -7);
  return data.tasks.filter((t) => !t.done && !t.repeat && (t.pushes || []).some((p) => {
    const k = D.keyOfISO(p.at);
    return k >= from && k <= today;
  }));
}

// ---------- Export / Import ----------
export function exportJSON() {
  return JSON.stringify({ app: 'life-tracker', exportedAt: nowISO(), ...data }, null, 2);
}

// Make sure every step (sub goal) has an order number within its main goal.
function orderSteps() {
  const byGoal = new Map();
  for (const g of data.quarterlyGoals) {
    if (!byGoal.has(g.yearlyId)) byGoal.set(g.yearlyId, []);
    byGoal.get(g.yearlyId).push(g);
  }
  for (const list of byGoal.values()) {
    list.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (a.q || 9) - (b.q || 9) || (a.createdAt || '').localeCompare(b.createdAt || ''));
    list.forEach((g, i) => { g.order = i; });
  }
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.sections)) {
    throw new Error('This file does not look like a Life Tracker backup.');
  }
  delete parsed.app;
  delete parsed.exportedAt;
  data = migrate(parsed);
  orderSteps();
  save();
}

export function backupFileName() {
  return `life-tracker-backup-${D.todayKey()}.json`;
}
