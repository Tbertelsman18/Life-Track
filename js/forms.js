// The pop-up forms for adding and editing tasks, events and sections.

import * as D from './dates.js';
import * as S from './store.js';
import { $, esc, icon, openSheet, closeSheet, sheetTop, sectionOptions, wireSectionSelect, toast } from './ui.js';

// ---------------------------------------------------------------- dropdown options
function projectOptions(selected) {
  const active = S.projectsIn('active');
  const radar = S.projectsIn('radar');
  const opt = (p) => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.title)}</option>`;
  let html = `<option value="">None</option>`;
  if (active.length) html += `<optgroup label="Active">${active.map(opt).join('')}</optgroup>`;
  if (radar.length) html += `<optgroup label="Radar">${radar.map(opt).join('')}</optgroup>`;
  // keep a finished project selectable if the task already uses it
  const cur = selected && S.getProject(selected);
  if (cur && cur.state === 'done') html += `<optgroup label="Done">${opt(cur)}</optgroup>`;
  return html;
}

function goalOptions(selected) {
  const data = S.getData();
  const year = new Date().getFullYear();
  const years = new Set([year, year + 1]);
  const sel = S.resolveGoal(selected);
  if (sel?.yearly) years.add(sel.yearly.year);
  let html = `<option value="">None</option>`;
  for (const y of data.yearlyGoals.filter((g) => years.has(g.year)).sort((a, b) => a.year - b.year)) {
    const o = (id, label) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${label}</option>`;
    const cur = S.currentStep(y.id);
    let group = o(y.id, `${esc(y.title)} (whole goal)`);
    S.stepsFor(y.id).forEach((q, i) => {
      if (q.done && q.id !== selected) return; // finished steps are hidden
      group += o(q.id, `Step ${i + 1}: ${esc(q.title)}${q === cur ? ' ← now' : ''}`);
      for (const t of q.targets || []) group += o(t.id, `&nbsp;&nbsp;&nbsp;↳ ${esc(t.label)} (${t.perWeek}/wk)`);
    });
    html += `<optgroup label="${esc(y.title)}${y.year !== year ? ` · ${y.year}` : ''}">${group}</optgroup>`;
  }
  return html;
}

// ---------------------------------------------------------------- task / event sheet
// kind: 'task' | 'event'. `fixed` hides the Task/Event switch (when editing).
export function openAddSheet({ date = D.todayKey(), defaults = {}, kind = 'task' } = {}) {
  if (kind === 'event') openEventSheet({ date, defaults, allowSwitch: true });
  else openTaskSheet({ date, defaults, allowSwitch: true });
}

function kindSwitch(kind) {
  return `<div class="seg kind-seg">
    <button type="button" class="seg-btn ${kind === 'task' ? 'on' : ''}" data-kind="task">Task</button>
    <button type="button" class="seg-btn ${kind === 'event' ? 'on' : ''}" data-kind="event">Event</button>
    <button type="button" class="seg-btn ${kind === 'daily' ? 'on' : ''}" data-kind="daily">Recurring</button>
    <button type="button" class="seg-btn ${kind === 'idea' ? 'on' : ''}" data-kind="idea">Idea</button>
  </div>`;
}

function wireKindSwitch(form, current, ctx) {
  form.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.kind === current) return;
    const title = form.title.value;
    const date = (form.date && form.date.value) || ctx.date;
    const defaults = { ...ctx.defaults, title };
    if (b.dataset.kind === 'event') openEventSheet({ date, defaults, allowSwitch: true });
    else if (b.dataset.kind === 'daily') openDailySheet({ date, defaults });
    else if (b.dataset.kind === 'idea') openIdeaSheet({ defaults });
    else openTaskSheet({ date, defaults, allowSwitch: true });
  }));
}

// Section chips (Personal, Work, ...) with a "+ New section" chip. Calls
// onPick(id) when one is tapped; '' means no section.
function wireSectionChips(box, selected, onPick) {
  let current = selected || '';
  const paint = () => {
    box.innerHTML = [...S.getData().sections.map((s) => [s.id, s.name, s.color]), ['', 'None', null]].map(([v, label, color]) => `
      <button type="button" class="chip ${current === v ? 'on' : ''}" data-sec="${esc(v)}" aria-pressed="${current === v}">
        ${color ? `<i class="swatch" style="background:${color}"></i>` : ''}${esc(label)}</button>`).join('')
      + '<button type="button" class="chip add" data-sec-new>+ New section</button>';
    box.querySelectorAll('[data-sec]').forEach((b) => b.addEventListener('click', () => { current = b.dataset.sec; onPick(current); paint(); }));
    box.querySelector('[data-sec-new]').addEventListener('click', () => {
      const name = prompt('Name for the new section:');
      if (name && name.trim()) { current = S.addSection(name).id; onPick(current); paint(); }
    });
  };
  paint();
}

export function openTaskSheet({ id = null, date = null, defaults = {}, allowSwitch = false } = {}) {
  const t = id ? S.getTask(id) : null;
  const data = S.getData();
  const v = t ? { ...t } : {
    title: '', notes: '', date, time: null, projectId: null, goalId: null, atWork: false,
    sectionId: data.sections[0]?.id || null, repeat: null, ...defaults,
  };
  if (!t && v.projectId && !defaults.sectionId) v.sectionId = S.getProject(v.projectId)?.sectionId ?? v.sectionId;
  const repeatDays = new Set(v.repeat ? v.repeat.days : []);
  const occurrence = t && t.repeat && date ? date : null;

  const dayChips = D.WEEK_ORDER.map((d) => `
    <button type="button" class="chip ${repeatDays.has(d) ? 'on' : ''}" data-day="${d}" aria-pressed="${repeatDays.has(d)}">
      ${D.DAY_NAMES[d].slice(0, 2)}</button>`).join('');

  // Notes sit right under the task name when you open a task (or when it has
  // notes). For a brand-new task they wait under "More options".
  const notesUp = Boolean(t || v.notes);
  const notesBox = `<label class="field-group notes-box">
        <textarea name="notes" class="grow" rows="${notesUp ? 4 : 3}" placeholder="Notes">${esc(v.notes)}</textarea>
      </label>`;

  const pushInfo = t && t.pushes && t.pushes.length
    ? `<p class="hint">Pushed off ${t.pushes.length} time${t.pushes.length > 1 ? 's' : ''}.</p>` : '';

  openSheet(`
    <form class="sheet-form" id="task-form" autocomplete="off">
      ${sheetTop(t ? 'Edit Task' : 'New')}
      ${allowSwitch && !t ? kindSwitch('task') : ''}

      <textarea class="title-input grow" name="title" rows="1" enterkeyhint="done" placeholder="What do you need to do?" required>${esc(v.title)}</textarea>
      ${notesUp ? notesBox : ''}
      ${importantToggle(v.important)}

      <div class="field-group">
        <label class="field">
          <span class="date-label">${repeatDays.size ? 'Starts' : 'Date'}</span>
          <input type="date" name="date" value="${v.date || ''}">
        </label>
        <div class="block-warn" hidden></div>
        <label class="field">
          <span>Time <small class="opt">optional</small></span>
          <input type="time" name="time" value="${v.time || ''}">
        </label>
      </div>

      <div class="field-group">
        <div class="field col">
          <span>Section</span>
          <div class="cat-chips task-secs"></div>
          <input type="hidden" name="sectionId" value="${esc(v.sectionId || '')}">
        </div>
      </div>

      <button type="button" class="more-toggle" data-act="more" aria-expanded="false">
        More options <small>tell me ahead, repeat, project${notesUp ? '' : ', notes'}</small> ${icon('chev-down')}
      </button>

      <div class="more-opts" hidden>

      <div class="field-group">
        <label class="field">
          <span>Project</span>
          <select name="projectId">${projectOptions(v.projectId)}</select>
        </label>
        ${S.GOALS_ON ? `<label class="field">
          <span>Goal / step</span>
          <select name="goalId">${goalOptions(v.goalId)}</select>
        </label>` : ''}
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

      <div class="field-group">
        <div class="field col">
          <span>Tell me ahead <small class="opt">shows in "Coming up"</small></span>
          <div class="lead-chips task-lead">
            <button type="button" class="chip ${!v.lead ? 'on' : ''}" data-tlead="">Off</button>
            ${S.LEAD_TIMES.map((l) => `<button type="button" class="chip ${v.lead === l.id ? 'on' : ''}" data-tlead="${l.id}">${l.label}</button>`).join('')}
          </div>
          <span class="hint left tlead-hint"></span>
        </div>
      </div>

      ${notesUp ? '' : notesBox}
      </div>

      ${occurrence ? `
        <div class="field-group pad">
          <p class="hint left">This task repeats. Changes above apply to every day.
            For just <b>${esc(D.formatShort(occurrence))}</b>:</p>
          <div class="btn-row">
            <button type="button" class="btn" data-act="skip-occ">Skip this day</button>
            <label class="btn file-like">Move to… <input type="date" data-act="move-occ"></label>
          </div>
        </div>` : ''}

      ${t && !t.repeat && t.date && !t.done ? `
        <button type="button" class="btn wide" data-act="push-tomorrow">Push to tomorrow</button>
        <button type="button" class="btn wide" data-act="missed">Mark as not completed</button>` : ''}
      ${pushInfo}

      ${t ? `<button type="button" class="btn danger wide" data-act="delete">Delete task</button>` : ''}
    </form>`);

  const form = $('#task-form');
  if (!t) setTimeout(() => form.title.focus(), 50);
  if (allowSwitch && !t) wireKindSwitch(form, 'task', { date, defaults });
  wireSectionChips(form.querySelector('.task-secs'), v.sectionId, (id) => { form.sectionId.value = id; });

  // Long names and notes grow to fit instead of scrolling inside a tiny box.
  const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
  form.querySelectorAll('textarea.grow').forEach((ta) => {
    ta.addEventListener('input', () => fit(ta));
    requestAnimationFrame(() => fit(ta));
  });
  // Return in the task name saves, like before (no line breaks in names).
  form.title.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
  });

  // "Tell me ahead" for one-time tasks with a date
  let tlead = v.lead || null;
  const tleadHint = () => {
    const box = form.querySelector('.tlead-hint');
    const d = form.date.value;
    if (!tlead) { box.textContent = ''; return; }
    if (repeatDays.size) { box.textContent = 'Only for one-time tasks (not repeating ones).'; return; }
    if (!d) { box.textContent = 'Give the task a date first.'; return; }
    const from = D.addDays(d, -S.leadDays(tlead));
    box.textContent = `Shows in "Coming up" on your Day page from ${D.formatShort(from)}.`;
  };
  form.querySelectorAll('[data-tlead]').forEach((b) => b.addEventListener('click', () => {
    tlead = b.dataset.tlead || null;
    form.querySelectorAll('[data-tlead]').forEach((x) => x.classList.toggle('on', x === b));
    tleadHint();
  }));
  form.date.addEventListener('change', tleadHint);
  tleadHint();

  const more = form.querySelector('[data-act="more"]');
  more.addEventListener('click', () => {
    const box = form.querySelector('.more-opts');
    box.hidden = !box.hidden;
    box.querySelectorAll('textarea.grow').forEach(fit);
    more.setAttribute('aria-expanded', String(!box.hidden));
    more.classList.toggle('open', !box.hidden);
  });

  const warn = form.querySelector('.block-warn');
  const updateWarn = () => {
    const evs = form.date.value ? S.blockingEventsOn(form.date.value) : [];
    warn.hidden = !evs.length;
    warn.textContent = evs.length ? `Heads up: this day is during ${evs.map((e) => e.title).join(', ')}.` : '';
  };
  form.date.addEventListener('change', updateWarn);
  updateWarn();


  form.querySelectorAll('.day-chips .chip').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.day);
    if (repeatDays.has(d)) repeatDays.delete(d); else repeatDays.add(d);
    b.classList.toggle('on', repeatDays.has(d));
    b.setAttribute('aria-pressed', repeatDays.has(d));
    form.querySelector('.repeat-only').hidden = repeatDays.size === 0;
    form.querySelector('.date-label').textContent = repeatDays.size ? 'Starts' : 'Date';
  }));

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
    // Warn when scheduling a one-time task during a multi-day event
    if (!repeat && dateVal && dateVal !== t?.date) {
      const evs = S.blockingEventsOn(dateVal);
      if (evs.length && !confirm(`${D.formatShort(dateVal)} is during ${evs.map((x) => x.title).join(', ')}. Schedule it anyway?`)) return;
    }
    const fields = {
      title,
      notes: form.notes.value.trim(),
      date: dateVal,
      time: form.time.value || null,
      sectionId: form.sectionId.value || null,
      projectId: form.projectId.value || null,
      goalId: form.goalId ? (form.goalId.value || null) : (v.goalId || null),
      atWork: Boolean(v.atWork),
      important: form.important.checked,
      lead: repeatDays.size ? null : tlead,
      repeat,
    };
    if (t) S.updateTask(t.id, fields);
    else S.addTask(fields);
    closeSheet();
  });

  const on = (act, fn, ev = 'click') => form.querySelector(`[data-act="${act}"]`)?.addEventListener(ev, fn);
  on('delete', () => {
    if (confirm(`Delete "${t.title}"${t.repeat ? ' and all its repeats' : ''}?`)) {
      S.deleteTask(t.id);
      closeSheet();
    }
  });
  on('missed', () => {
    S.markMissed(t.id);
    closeSheet();
    toast('Marked not completed');
  });
  on('push-tomorrow', () => {
    S.updateTask(t.id, { date: D.addDays(t.date, 1) });
    closeSheet();
    toast('Pushed to tomorrow');
  });
  on('skip-occ', () => {
    S.skipOccurrence(t.id, occurrence);
    closeSheet();
  });
  on('move-occ', (e) => {
    if (!e.target.value) return;
    S.moveOccurrence(t.id, occurrence, e.target.value);
    closeSheet();
    toast(`Moved to ${D.formatShort(e.target.value)}`);
  }, 'change');
}

export function openEventSheet({ id = null, date = D.todayKey(), defaults = {}, allowSwitch = false } = {}) {
  const ev = id ? S.getEvent(id) : null;
  const data = S.getData();
  const v = ev ? { ...ev } : {
    title: '', date: date || D.todayKey(), endDate: null, time: null, lead: '1w', notes: '',
    sectionId: data.sections[0]?.id || null, ...defaults,
  };
  const multi = Boolean(v.endDate && v.endDate > v.date);
  const leads = S.LEAD_TIMES.map((l) => `
    <button type="button" class="chip ${v.lead === l.id ? 'on' : ''}" data-lead="${l.id}">${l.label}</button>`).join('');

  openSheet(`
    <form class="sheet-form" id="event-form" autocomplete="off">
      ${sheetTop(ev ? 'Edit Event' : 'New')}
      ${allowSwitch && !ev ? kindSwitch('event') : ''}

      <input class="title-input" name="title" placeholder="Event name (e.g. Boards III)" value="${esc(v.title)}" required>

      <div class="field-group">
        <label class="field toggle-field">
          <span>Multi-day</span>
          <input type="checkbox" name="multi" class="switch" ${multi ? 'checked' : ''}>
        </label>
        <label class="field">
          <span class="start-label">${multi ? 'Starts' : 'Date'}</span>
          <input type="date" name="date" value="${v.date}" required>
        </label>
        <label class="field multi-only" ${multi ? '' : 'hidden'}>
          <span>Ends</span>
          <input type="date" name="endDate" value="${v.endDate || ''}">
        </label>
        <label class="field">
          <span>Time</span>
          <input type="time" name="time" value="${v.time || ''}">
        </label>
        <label class="field">
          <span>Section</span>
          <select name="sectionId">${sectionOptions(v.sectionId)}</select>
        </label>
      </div>

      <div class="field-group">
        <div class="field col">
          <span>Tell me ahead</span>
          <div class="lead-chips">${leads}</div>
          <span class="hint left lead-hint"></span>
        </div>
      </div>

      ${importantToggle(v.important)}

      <label class="field-group">
        <textarea name="notes" rows="3" placeholder="Notes">${esc(v.notes)}</textarea>
      </label>

      ${ev ? `<button type="button" class="btn danger wide" data-act="delete">Delete event</button>` : ''}
    </form>`);

  const form = $('#event-form');
  if (!ev) setTimeout(() => form.title.focus(), 50);
  if (allowSwitch && !ev) wireKindSwitch(form, 'event', { date, defaults });
  wireSectionSelect(form.sectionId, v.sectionId);

  let lead = v.lead;
  const leadHint = () => {
    const days = S.leadDays(lead);
    const from = form.date.value ? D.addDays(form.date.value, -days) : null;
    form.querySelector('.lead-hint').textContent = from ? `Shows in "Coming up" on your Day page from ${D.formatShort(from)}.` : '';
  };
  form.querySelectorAll('[data-lead]').forEach((b) => b.addEventListener('click', () => {
    lead = b.dataset.lead;
    form.querySelectorAll('[data-lead]').forEach((x) => x.classList.toggle('on', x === b));
    leadHint();
  }));
  form.date.addEventListener('change', leadHint);
  leadHint();

  form.multi.addEventListener('change', () => {
    form.querySelector('.multi-only').hidden = !form.multi.checked;
    form.querySelector('.start-label').textContent = form.multi.checked ? 'Starts' : 'Date';
    if (form.multi.checked && !form.endDate.value && form.date.value) form.endDate.value = D.addDays(form.date.value, 2);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title || !form.date.value) return;
    let endDate = form.multi.checked ? (form.endDate.value || null) : null;
    if (endDate && endDate < form.date.value) { alert('The end date is before the start date.'); return; }
    if (endDate === form.date.value) endDate = null;
    const fields = {
      title, date: form.date.value, endDate, time: form.time.value || null,
      sectionId: form.sectionId.value || null, lead, notes: form.notes.value.trim(), important: form.important.checked,
    };
    if (ev) S.updateEvent(ev.id, fields);
    else S.addEvent(fields);
    closeSheet();
  });

  form.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
    if (confirm(`Delete "${ev.title}"?`)) { S.deleteEvent(ev.id); closeSheet(); }
  });
}

function importantToggle(on) {
  return `<div class="field-group">
    <label class="field toggle-field">
      <span class="imp-label">${icon('star')} Important<small>Shows in Month view</small></span>
      <input type="checkbox" name="important" class="switch" ${on ? 'checked' : ''}>
    </label>
  </div>`;
}

// Add or edit a Routine item: something simple you repeat on certain days
// each week (e.g. "Check Ava results" on weekdays, "Water change" on Saturday).
export function openDailySheet({ id = null, date = D.todayKey(), defaults = {} } = {}) {
  const item = id ? S.getData().dailyCheck.items.find((i) => i.id === id) : null;
  // A new routine starts with no days picked: tap the days it should show on.
  const days = new Set(item ? S.routineDays(item) : []);
  let sectionId = item ? (item.sectionId || '') : (defaults.sectionId || '');
  const presets = [['Every day', S.ALL_DAYS], ['Weekdays', [1, 2, 3, 4, 5]], ['Weekends', [0, 6]]];
  // Every week, or every other week starting this week or next week
  const thisMon = D.startOfWeek(D.todayKey());
  const nextMon = D.addDays(thisMon, 7);
  let every = item && S.isEveryOtherWeek(item) ? 2 : 1;
  let startWeek = 'this';
  if (every === 2) {
    const weeks = Math.round(D.daysBetween(item.start, thisMon) / 7);
    startWeek = ((weeks % 2) + 2) % 2 === 0 ? 'this' : 'next';
  }
  openSheet(`
    <form class="sheet-form" id="daily-form" autocomplete="off">
      ${sheetTop(item ? 'Edit Recurring Task' : 'New', { saveLabel: item ? 'Save' : 'Add' })}
      ${item ? '' : kindSwitch('daily')}
      <input class="title-input" name="title" placeholder="e.g. Check Ava results, Water change" value="${esc(item ? item.title : defaults.title || '')}" required>
      <div class="field-group">
        <div class="field col">
          <span>Shows on <b class="days-now"></b></span>
          <div class="day-chips">${D.WEEK_ORDER.map((d) => `
            <button type="button" class="chip" data-day="${d}">${D.DAY_NAMES[d].slice(0, 2)}</button>`).join('')}</div>
          <div class="field-actions inset">${presets.map(([label], i) => `
            <button type="button" class="chip" data-preset="${i}">${label}</button>`).join('')}</div>
        </div>
      </div>
      <div class="field-group">
        <div class="field col">
          <span>Repeats</span>
          <div class="seg small rep-seg">
            <button type="button" class="seg-btn" data-every="1">Every week</button>
            <button type="button" class="seg-btn" data-every="2">Every other week</button>
          </div>
          <div class="seg small start-seg">
            <button type="button" class="seg-btn" data-start="this">Starting this week</button>
            <button type="button" class="seg-btn" data-start="next">Starting next week</button>
          </div>
        </div>
      </div>
      <div class="field-group">
        <div class="field col">
          <span>Section <small class="opt">same list as your tasks</small></span>
          <div class="cat-chips"></div>
        </div>
      </div>
      <p class="hint days-hint"></p>
      ${item ? `<button type="button" class="btn danger wide" data-act="delete">Delete recurring task</button>` : ''}
    </form>`);
  const form = $('#daily-form');
  if (!item) setTimeout(() => form.title.focus(), 50);
  if (!item) wireKindSwitch(form, 'daily', { date, defaults });

  const paint = () => {
    form.querySelectorAll('[data-day]').forEach((b) => {
      const on = days.has(Number(b.dataset.day));
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    form.querySelector('.days-now').textContent = days.size ? S.everyLabel([...days], every) : '(tap the days)';
    form.querySelectorAll('[data-every]').forEach((b) => b.classList.toggle('on', Number(b.dataset.every) === every));
    form.querySelectorAll('[data-start]').forEach((b) => b.classList.toggle('on', b.dataset.start === startWeek));
    form.querySelector('.start-seg').hidden = every !== 2;
    const often = every === 2 ? 'every other week' : 'every week';
    let hint = days.size === 1
      ? `Shows up ${often} on that day and <b>stays on your list until you check it off</b>.`
      : days.size ? `Shows up on these days ${often}, all year. Check it off each time.`
      : `Tap the days it should show up on. It repeats ${often}, all year.`;
    if (days.size) {
      const next = S.routineNext({ days: [...days], every, start: startWeek === 'next' ? nextMon : thisMon });
      if (next) hint += ` Next: <b>${esc(next === D.todayKey() ? 'today' : D.formatShort(next))}</b>.`;
    }
    form.querySelector('.days-hint').innerHTML = hint;
  };
  form.querySelectorAll('[data-every]').forEach((b) => b.addEventListener('click', () => { every = Number(b.dataset.every); paint(); }));
  form.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => { startWeek = b.dataset.start; paint(); }));
  // Section chips: the same Sections your tasks use (Personal, Work, ...)
  wireSectionChips(form.querySelector('.cat-chips'), sectionId, (id) => { sectionId = id; });
  form.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    const d = Number(b.dataset.day);
    if (days.has(d)) days.delete(d); else days.add(d);
    paint();
  }));
  form.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    days.clear();
    presets[Number(b.dataset.preset)][1].forEach((d) => days.add(d));
    paint();
  }));
  paint();

  form.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
    if (confirm(`Delete "${item.title}" from your recurring tasks?`)) { S.removeCheckItem(item.id); closeSheet(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return;
    if (!days.size) { toast('Pick at least one day'); return; }
    const start = every === 2 ? (startWeek === 'next' ? nextMon : thisMon) : null;
    if (item) S.updateCheckItem(item.id, { title, days: [...days], sectionId, every, start });
    else { S.addCheckItem(title, [...days], sectionId, every, start); toast('Added to Recurring tasks'); }
    closeSheet();
  });
}

// ---------------------------------------------------------------- ideas
// Jot down an idea (kept separate from tasks). Open with an id to edit it.
export function openIdeaSheet({ id = null, defaults = {} } = {}) {
  const idea = id ? S.getData().ideas.find((i) => i.id === id) : null;
  openSheet(`
    <form class="sheet-form" id="idea-form" autocomplete="off">
      ${sheetTop(idea ? 'Edit Idea' : 'New', { saveLabel: 'Save' })}
      ${idea ? '' : kindSwitch('idea')}
      <textarea class="title-input grow idea-input" name="title" rows="3" placeholder="What's the idea?" required>${esc(idea ? idea.text : defaults.title || '')}</textarea>
      <p class="hint">Ideas are kept in <b>More → Ideas</b>, separate from your tasks.</p>
      ${idea ? `<button type="button" class="btn danger wide" data-act="delete">Delete idea</button>` : ''}
    </form>`);
  const form = $('#idea-form');
  const fit = () => { form.title.style.height = 'auto'; form.title.style.height = form.title.scrollHeight + 2 + 'px'; };
  form.title.addEventListener('input', fit);
  requestAnimationFrame(fit);
  if (!idea) { setTimeout(() => form.title.focus(), 50); wireKindSwitch(form, 'idea', { date: D.todayKey(), defaults }); }
  form.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
    if (confirm('Delete this idea?')) { S.deleteIdea(idea.id); closeSheet(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = form.title.value.trim();
    if (!text) return;
    if (idea) S.updateIdea(idea.id, text);
    else { S.addIdea(text); toast('Idea saved'); }
    closeSheet();
  });
}

// ---------------------------------------------------------------- section sheet
export function openSectionSheet(id) {
  const s = id ? S.getSection(id) : null;
  let color = s ? s.color : S.SECTION_COLORS.find((c) => !S.getData().sections.some((x) => x.color === c)) || S.SECTION_COLORS[0];
  const swatches = () => S.SECTION_COLORS.map((c) => `
    <button type="button" class="swatch-btn ${c === color ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('');

  openSheet(`
    <form class="sheet-form" id="section-form">
      ${sheetTop(s ? 'Edit Section' : 'New Section')}
      <input class="title-input" name="name" placeholder="Section name" value="${esc(s?.name || '')}" required>
      <div class="field-group pad">
        <div class="setting-label">Color</div>
        <div class="swatches">${swatches()}</div>
      </div>
      ${s ? `<button type="button" class="btn danger wide" data-act="delete">Delete section</button>` : ''}
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
  form.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
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

// ---------------------------------------------------------------- simple text sheet
// A reusable sheet with a few text fields. fields: [{name,label,value,type,placeholder,multiline}]
export function openFieldsSheet({ title, fields, onSave, onDelete, deleteLabel = 'Delete', extra = '' }) {
  const html = fields.map((f) => {
    if (f.multiline) {
      return `<label class="field-group"><textarea name="${f.name}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || f.label)}">${esc(f.value || '')}</textarea></label>`;
    }
    if (f.big) {
      return `<input class="title-input" name="${f.name}" placeholder="${esc(f.placeholder || f.label)}" value="${esc(f.value || '')}" ${f.required ? 'required' : ''}>`;
    }
    if (f.type === 'checkbox') {
      return `<div class="field-group"><label class="field toggle-field"><span>${esc(f.label)}</span>
        <input type="checkbox" class="switch" name="${f.name}" ${f.value ? 'checked' : ''}></label></div>`;
    }
    if (f.type === 'select') {
      return `<div class="field-group"><label class="field"><span>${esc(f.label)}</span>
        <select name="${f.name}">${f.options}</select></label></div>`;
    }
    return `<div class="field-group"><label class="field"><span>${esc(f.label)}</span>
      <input type="${f.type || 'text'}" name="${f.name}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" ${f.min ? `min="${f.min}"` : ''}></label></div>`;
  }).join('');

  openSheet(`
    <form class="sheet-form" id="fields-form" autocomplete="off">
      ${sheetTop(title)}
      ${html}
      ${extra}
      ${onDelete ? `<button type="button" class="btn danger wide" data-act="delete">${esc(deleteLabel)}</button>` : ''}
    </form>`);
  const form = $('#fields-form');
  const first = form.querySelector('input:not([type=checkbox]), textarea');
  if (first && !fields[0].value) setTimeout(() => first.focus(), 50);
  form.querySelectorAll('select[name="sectionId"]').forEach((sel) => wireSectionSelect(sel, sel.value));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const vals = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      vals[f.name] = f.type === 'checkbox' ? el.checked : el.value.trim();
    }
    if (fields.some((f) => f.required && !vals[f.name])) return;
    if (onSave(vals) !== false) closeSheet();
  });
  form.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
    if (onDelete() !== false) closeSheet();
  });
  return form;
}
