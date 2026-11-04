// The data store. All of your data lives in one object that is saved to
// this phone's storage (localStorage) every time something changes.
// Nothing is ever sent anywhere.

import { todayKey, weekday } from './dates.js';

const STORAGE_KEY = 'lifeTracker.data';
export const DATA_VERSION = 1;

export const SECTION_COLORS = [
  '#3b82f6', // blue
  '#22a06b', // green
  '#e5484d', // red
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#64748b', // slate
  '#a16207', // brown
];

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultData() {
  return {
    version: DATA_VERSION,
    settings: { defaultView: 'day' },
    sections: [
      { id: 'work', name: 'Work', color: '#3b82f6' },
      { id: 'personal', name: 'Personal', color: '#22a06b' },
    ],
    tasks: [],
  };
}

/*
  A task looks like this:
  {
    id, title, notes,
    date: "2026-11-04" or null (null = Unscheduled),
    time: "09:30" or null,
    sectionId, projectId (later), goalId (later),
    done: true/false, doneAt,            // one-time tasks
    repeat: null or {                    // recurring tasks
      days: [1, 2],                      // 0 = Sun ... 6 = Sat
      until: "2027-01-01" or null,
      doneDates: { "2026-11-04": "<when it was checked>" },
      skips: ["2026-11-05"],             // days removed from the series
    },
    pushes: [{ from, to, at }],          // each time it was pushed off
    createdAt,
  }
*/

let data = load();

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
  return {
    ...base,
    ...d,
    version: DATA_VERSION,
    settings: { ...base.settings, ...(d.settings || {}) },
    sections: Array.isArray(d.sections) ? d.sections : base.sections,
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
  };
}

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); }

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    alert('Could not save. Your phone storage may be full.');
  }
  listeners.forEach((fn) => fn());
}

export function getData() { return data; }

// ---------- Settings ----------
export function setSetting(key, value) {
  data.settings[key] = value;
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

// Tasks in a deleted section move to the given section (or none).
export function deleteSection(id, moveToId) {
  data.sections = data.sections.filter((s) => s.id !== id);
  data.tasks.forEach((t) => { if (t.sectionId === id) t.sectionId = moveToId || null; });
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
    done: false,
    doneAt: null,
    repeat: null,
    pushes: [],
    createdAt: new Date().toISOString(),
    ...fields,
  };
  data.tasks.push(task);
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
      t.pushes.push({ from: t.date, to: changes.date || null, at: new Date().toISOString() });
    }
  }
  Object.assign(t, changes);
  save();
}

export function deleteTask(id) {
  data.tasks = data.tasks.filter((t) => t.id !== id);
  save();
}

// Does a recurring task happen on this date?
export function occursOn(task, key) {
  if (!task.repeat) return task.date === key;
  const r = task.repeat;
  if (task.date && key < task.date) return false;
  if (r.until && key > r.until) return false;
  if ((r.skips || []).includes(key)) return false;
  return r.days.includes(weekday(key));
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
    else t.repeat.doneDates[key] = new Date().toISOString();
  } else {
    t.done = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
  }
  save();
}

// Remove one day from a recurring series.
export function skipOccurrence(id, key) {
  const t = getTask(id);
  if (!t || !t.repeat) return;
  t.repeat.skips = [...new Set([...(t.repeat.skips || []), key])];
  save();
}

// Move one day of a recurring series to another day. This creates a
// one-time copy on the new day and records it as pushed off.
export function moveOccurrence(id, fromKey, toKey) {
  const t = getTask(id);
  if (!t || !t.repeat) return;
  t.repeat.skips = [...new Set([...(t.repeat.skips || []), fromKey])];
  const copy = {
    id: uid(),
    title: t.title,
    notes: t.notes,
    date: toKey || null,
    time: t.time,
    sectionId: t.sectionId,
    projectId: t.projectId,
    goalId: t.goalId,
    done: false,
    doneAt: null,
    repeat: null,
    seriesId: t.id,
    pushes: (!toKey || toKey > fromKey)
      ? [{ from: fromKey, to: toKey || null, at: new Date().toISOString() }]
      : [],
    createdAt: new Date().toISOString(),
  };
  data.tasks.push(copy);
  save();
  return copy;
}

// Tasks on a given day: not done first (timed tasks in time order, then
// untimed), then finished tasks at the bottom.
export function tasksOn(key) {
  const list = data.tasks.filter((t) => occursOn(t, key));
  return list.sort((a, b) => {
    const da = isDoneOn(a, key), db = isDoneOn(b, key);
    if (da !== db) return da ? 1 : -1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

export function unscheduledTasks() {
  return data.tasks
    .filter((t) => !t.date && !t.repeat)
    .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
}

// ---------- Export / Import ----------
export function exportJSON() {
  return JSON.stringify({ app: 'life-tracker', exportedAt: new Date().toISOString(), ...data }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.sections)) {
    throw new Error('This file does not look like a Life Tracker backup.');
  }
  delete parsed.app;
  delete parsed.exportedAt;
  data = migrate(parsed);
  save();
}

export function backupFileName() {
  return `life-tracker-backup-${todayKey()}.json`;
}
