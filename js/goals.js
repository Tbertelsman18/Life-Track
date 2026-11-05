// Goals tab: main goals broken into ordered steps (sub goals), each with
// tasks, optional weekly targets and milestones; reminders and reviews.

import * as D from './dates.js';
import * as S from './store.js';
import { ui, esc, icon, go, back, progressBar, pct, pageHeader, toast, makeSortable } from './ui.js';
import { taskRow } from './home.js';
import { openFieldsSheet, openTaskSheet } from './forms.js';
import { miniRow } from './projects.js';

const SLIPPING_DAYS = 14;

function isSlipping(goalId, createdAt) {
  const today = D.todayKey();
  if (createdAt && D.daysBetween(D.keyOfISO(createdAt), today) < SLIPPING_DAYS) return false;
  const last = S.lastGoalActivity(goalId);
  return !last || D.daysBetween(last, today) >= SLIPPING_DAYS;
}

function lastActivityText(goalId) {
  const last = S.lastGoalActivity(goalId);
  if (!last) return 'No activity yet';
  const n = D.daysBetween(last, D.todayKey());
  return n <= 0 ? 'Active today' : n === 1 ? 'Active yesterday' : `Last activity ${n} days ago`;
}

// ---------------------------------------------------------------- main tab
export function renderGoals() {
  const year = ui.goalYear;
  const today = D.todayKey();
  const cur = D.quarterOf(today);
  const yearly = S.yearlyFor(year);
  const reminders = S.goalReminders(today);

  const cards = yearly.map((y) => {
    const prog = S.yearlyProgress(y);
    const steps = S.stepsFor(y.id);
    const step = S.currentStep(y.id);
    const slipping = year === cur.year && isSlipping(y.id, y.createdAt);
    const avg = S.gradeAverage(y.id, 7);
    return `
      <li class="goal-card">
        <button class="goal-main" data-action="open-yearly" data-id="${y.id}">
          <span class="proj-top">
            <span class="proj-title">${esc(y.title)}</span>
            ${slipping ? `<span class="status st-stuck">Slipping</span>` : ''}
            <span class="pnum">${pct(prog)}</span>
          </span>
          ${prog !== null ? progressBar(prog) : ''}
          ${steps.length ? `
            <span class="step-dots">${steps.map((g) => `<i class="${g.done ? 'done' : g === step ? 'cur' : ''}"></i>`).join('')}</span>
            <span class="q-line"><span>${step ? `Step ${S.stepNumber(step)} of ${steps.length}: <b>${esc(step.title)}</b>` : `All ${steps.length} steps done`}</span></span>`
          : `<span class="task-meta">Add steps to break this goal down</span>`}
          ${avg ? `<span class="task-meta">${icon('star')} Self-grade ${avg.toFixed(1)}/5 this week</span>` : ''}
        </button>
      </li>`;
  }).join('');

  const slipping = year === cur.year ? yearly.map((y) => S.currentStep(y.id)).filter((g) => g && isSlipping(g.id, g.createdAt)) : [];

  return `
    <header class="page-header"><h1>Goals</h1></header>
    <div class="view-body">
      <div class="nav-row tight">
        <button class="icon-btn" data-action="goal-year" data-delta="-1" aria-label="Previous year">${icon('chev-left')}</button>
        <span class="nav-title static">${year}</span>
        <button class="icon-btn" data-action="goal-year" data-delta="1" aria-label="Next year">${icon('chev-right')}</button>
      </div>

      ${reminders.length ? `<div class="banners">${reminders.map((r) => `
        <div class="banner-row">
          <button class="banner" data-action="${r.action}" data-year="${r.year}" data-q="${r.q || ''}">
            ${icon('bell')}<span>${esc(r.title)}</span>${icon('chev-right')}</button>
          <button class="fc-dismiss" data-action="dismiss" data-key="${r.key}" aria-label="Not now">${icon('x')}</button>
        </div>`).join('')}</div>` : ''}

      <h3 class="group-label">Main goals</h3>
      ${yearly.length ? `<ul class="goal-list">${cards}</ul>`
        : `<p class="empty">No goals for ${year} yet. Start with the big things you want this year (e.g. Pass Boards, Grow the Clinic). Then break each one into steps.</p>`}
      <button class="btn wide" data-action="new-yearly" data-year="${year}">${icon('plus')} Add a main goal</button>

      ${yearly.length ? `<button class="btn wide" data-action="plan-quarter" data-year="${year}" data-q="${year === cur.year ? cur.q : 1}">
        ${icon('target')} Quarter plan &amp; review</button>` : ''}

      ${slipping.length ? `
        <h3 class="group-label">Slipping · no activity in ${SLIPPING_DAYS}+ days</h3>
        <ul class="group">${slipping.map((q) => `
          <li><button class="row" data-action="open-goal" data-id="${q.id}">
            ${icon('turtle')}<span class="row-label">${esc(q.title)}</span><span class="row-value">${esc(lastActivityText(q.id))}</span>
          </button></li>`).join('')}</ul>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- main goal page
export function renderYearlyPage(id) {
  const y = S.getYearly(id);
  if (!y) return pageHeader('Goal not found', { backLabel: 'Goals' });
  const prog = S.yearlyProgress(y);
  const contributions = S.goalCompletions(y.id);
  const steps = S.stepsFor(y.id);
  const step = S.currentStep(y.id);
  const direct = S.getData().tasks.filter((t) => t.goalId === y.id && !t.done && !t.repeat);

  return `
    ${pageHeader(y.title, { backLabel: 'Goals', right: `<button class="link" data-action="edit-yearly" data-id="${y.id}">Edit</button>` })}
    <div class="view-body">
      <section class="card">
        <div class="proj-top"><span class="task-meta">${y.year} · ${esc(lastActivityText(y.id))}</span><span class="pnum">${pct(prog)}</span></div>
        ${prog !== null ? progressBar(prog) : ''}
        ${y.notes ? `<p class="notes-text">${esc(y.notes)}</p>` : ''}
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Steps to get there ${steps.length ? `<span class="count">${steps.filter((g) => g.done).length}/${steps.length}</span>` : ''}</h2>
          <button class="link small" data-action="new-quarterly" data-yearly="${y.id}">+ Add step</button>
        </div>
        ${steps.length ? `<ol class="steps" id="steps-sort">${steps.map((g) => stepRow(g, g === step)).join('')}</ol>
          <p class="hint left">Drag ☰ to put steps in the order they need to happen. The first unfinished step is your current focus.</p>`
          : `<p class="empty small">Break this goal into steps, in the order they need to happen. e.g. 1. Buy study guide → 2. Finish practice tests → 3. Take the exam.</p>`}
      </section>

      ${step ? `
      <section class="card focus-card">
        <h2 class="card-title">${icon('target')} Now: Step ${S.stepNumber(step)} · ${esc(step.title)}</h2>
        ${taskBreakdown(step.id)}
      </section>` : ''}

      ${direct.length ? `<section class="card">
        <h2 class="card-title">Tasks for the whole goal</h2>
        <ul class="task-list">${direct.map((t) => taskRow(t, t.date, { showDate: true })).join('')}</ul>
      </section>` : ''}

      ${gradeStrip(y.id)}

      <section class="card">
        <h2 class="card-title">Completed tasks that count <span class="count">${contributions.length}</span></h2>
        ${contributionList(contributions)}
      </section>
      <button class="btn danger wide" data-action="delete-yearly" data-id="${y.id}">Delete goal</button>
    </div>`;
}

function stepRow(g, isCurrent) {
  const p = S.quarterlyProgress(g);
  const tasks = S.stepTasks(g.id).filter((t) => !t.repeat);
  const open = tasks.filter((t) => !t.done).length;
  return `<li class="step ${g.done ? 'done' : ''} ${isCurrent ? 'current' : ''}" data-id="${g.id}">
    <span class="drag" aria-label="Drag to reorder">${icon('drag')}</span>
    <button class="step-num" data-action="step-done" data-id="${g.id}" aria-label="${g.done ? 'Mark step not done' : 'Mark step done'}">
      ${g.done ? icon('check') : S.stepNumber(g)}</button>
    <button class="step-main" data-action="open-goal" data-id="${g.id}">
      <span class="q-row-top"><span class="proj-title">${esc(g.title)}</span>
        ${isCurrent ? '<span class="status st-prog">Current</span>' : ''}
        ${g.q ? `<span class="status">Q${g.q}</span>` : ''}</span>
      ${p !== null && !g.done ? progressBar(p) : ''}
      <span class="task-meta">${g.done ? `Done${g.doneAt ? ' ' + D.formatMonthDay(D.keyOfISO(g.doneAt)) : ''}` : tasks.length ? `${open} open · ${tasks.length - open} done` : 'No tasks yet'}</span>
    </button>
  </li>`;
}

// Open tasks for a step, with a quick way to add more.
function taskBreakdown(stepId) {
  const tasks = S.stepTasks(stepId);
  const open = tasks.filter((t) => !t.done || t.repeat);
  const doneCount = tasks.filter((t) => t.done && !t.repeat).length;
  return `
    ${open.length ? `<ul class="task-list">${open.map((t) => taskRow(t, t.repeat ? D.todayKey() : t.date, { showDate: true })).join('')}</ul>`
      : '<p class="empty small">No open tasks for this step.</p>'}
    ${doneCount ? `<p class="hint left">${icon('check')} ${doneCount} finished</p>` : ''}
    <form class="inline-add" data-form="step-task" data-id="${stepId}">
      <input name="title" placeholder="Add a task to this step" autocomplete="off">
      <input name="date" type="date" class="date-mini" aria-label="Date (optional)">
      <button class="link strong" type="submit">Add</button>
    </form>`;
}

// Last 14 days of self-grades for a goal.
function gradeStrip(goalId) {
  const today = D.todayKey();
  const days = Array.from({ length: 14 }, (_, i) => D.addDays(today, i - 13));
  const vals = days.map((k) => S.getGrade(k).scores[goalId] || 0);
  if (!vals.some(Boolean)) return '';
  const avg = S.gradeAverage(goalId, 7);
  return `<section class="card">
    <h2 class="card-title">Your self-grades ${avg ? `<span class="count">${avg.toFixed(1)} avg this week</span>` : ''}</h2>
    <div class="grade-strip">${days.map((k, i) => `<span class="gs-col" title="${D.formatShort(k)}: ${vals[i] ? S.GRADE_LABELS[vals[i]] : 'not graded'}">
      <i style="height:${vals[i] * 20}%" class="${vals[i] ? '' : 'none'}"></i><small>${D.fromKey(k).getDate()}</small></span>`).join('')}</div>
  </section>`;
}

function quarterlyRow(g) {
  const p = S.quarterlyProgress(g);
  return `<li><button class="q-row" data-action="open-goal" data-id="${g.id}">
    <span class="q-row-top"><span class="proj-title">${esc(g.title)}</span>${!g.q ? '<span class="status">any time</span>' : ''}<span class="pnum">${p === null ? '' : pct(p)}</span>${icon('chev-right')}</span>
    ${p !== null ? progressBar(p) : ''}
    <span class="task-meta">${goalSummary(g)}</span>
  </button></li>`;
}

function goalSummary(g) {
  const bits = [];
  if (g.done) bits.push('Step done');
  const tasks = S.stepTasks(g.id).filter((t) => !t.repeat);
  if (tasks.length) bits.push(`${tasks.filter((t) => t.done).length}/${tasks.length} tasks`);
  const minis = g.miniGoals || [];
  if (minis.length) bits.push(`${minis.filter((m) => m.done).length}/${minis.length} mini goals`);
  for (const t of g.targets || []) {
    const weeks = S.targetWeeks(g, t);
    const streak = S.targetStreak(weeks);
    bits.push(`${esc(t.label)}: ${streak} wk streak`);
  }
  return bits.join(' · ') || 'Add tasks or a weekly target to track progress';
}

function contributionList(list, limit = 15) {
  if (!list.length) return `<p class="empty small">When you finish a task linked to this goal, it shows up here.</p>`;
  return `<ul class="contrib">${list.slice(0, limit).map((c) => `
    <li>${icon('check')}<span>${esc(c.task.title)}</span><time>${D.formatMonthDay(c.date)}</time></li>`).join('')}
    ${list.length > limit ? `<li class="more">+ ${list.length - limit} more</li>` : ''}</ul>`;
}

// ---------------------------------------------------------------- step page
export function renderQuarterlyPage(id) {
  const g = S.getQuarterly(id);
  if (!g) return pageHeader('Step not found', { backLabel: 'Goals' });
  const y = S.getYearly(g.yearlyId);
  const p = S.quarterlyProgress(g);
  const today = D.todayKey();
  const thisWeek = D.startOfWeek(today);
  const steps = S.stepsFor(g.yearlyId);
  const n = S.stepNumber(g);
  const minis = [...(g.miniGoals || [])].sort((a, b) => (a.done - b.done) || (a.date || '9999').localeCompare(b.date || '9999'));
  const active = g.q
    ? today >= D.quarterStart(g.year, g.q) && today <= D.quarterEnd(g.year, g.q)
    : D.fromKey(today).getFullYear() === g.year;

  const targets = (g.targets || []).map((t) => {
    const weeks = S.targetWeeks(g, t);
    const streak = S.targetStreak(weeks);
    const finished = weeks.filter((w) => !w.current);
    const hits = finished.filter((w) => w.hit).length;
    const nowCount = active ? S.targetCount(t, thisWeek) : null;
    return `
      <li class="target">
        <div class="target-top">
          <span class="proj-title">${esc(t.label)}</span>
          <span class="task-meta">${t.perWeek}× per week</span>
          <button class="icon-btn sm muted" data-action="target-delete" data-goal="${g.id}" data-tid="${t.id}" aria-label="Delete target">${icon('x')}</button>
        </div>
        ${active ? `
        <div class="target-now">
          <span>This week</span>
          <button class="round-btn" data-action="target-adj" data-goal="${g.id}" data-tid="${t.id}" data-delta="-1" aria-label="Minus one">−</button>
          <b class="${nowCount >= t.perWeek ? 'hit' : ''}">${nowCount}/${t.perWeek}</b>
          <button class="round-btn" data-action="target-adj" data-goal="${g.id}" data-tid="${t.id}" data-delta="1" aria-label="Plus one">+</button>
        </div>` : ''}
        <div class="weeks" aria-label="Weekly hits">
          ${weeks.map((w) => `<i class="wk ${w.hit ? 'hit' : w.current ? 'cur' : 'miss'}" title="Week of ${D.formatMonthDay(w.weekStart)}: ${w.count}/${t.perWeek}"></i>`).join('')}
        </div>
        <div class="task-meta">${icon('star')} ${streak}-week streak · hit ${hits} of ${finished.length} finished weeks</div>
      </li>`;
  }).join('');

  const contributions = S.goalCompletions(g.id);
  const prevStep = steps[n - 2];
  const nextStep = steps[n];

  return `
    ${pageHeader(g.title, { backLabel: y ? y.title : 'Goals', right: `<button class="link" data-action="edit-quarterly" data-id="${g.id}">Edit</button>` })}
    <div class="view-body">
      <section class="card">
        <div class="proj-top"><span class="task-meta">Step ${n} of ${steps.length}${y ? ` · toward <b>${esc(y.title)}</b>` : ''}${g.q ? ` · ${D.quarterLabel(g.year, g.q)}` : ''}</span><span class="pnum">${pct(p)}</span></div>
        ${p !== null ? progressBar(p) : ''}
        <div class="task-meta">${esc(lastActivityText(g.id))}</div>
        ${g.notes ? `<p class="notes-text">${esc(g.notes)}</p>` : ''}
        ${prevStep && !prevStep.done && !g.done ? `<p class="block-warn inline">Step ${n - 1} (${esc(prevStep.title)}) isn't finished yet.</p>` : ''}
        <button class="btn wide ${g.done ? '' : 'primary'}" data-action="step-done" data-id="${g.id}">
          ${g.done ? 'Mark step not done' : `${icon('check')} Mark step ${n} done`}</button>
        ${nextStep ? `<p class="hint left">Next: Step ${n + 1} · ${esc(nextStep.title)}</p>` : ''}
      </section>

      <section class="card">
        <h2 class="card-title">Tasks for this step</h2>
        ${taskBreakdown(g.id)}
      </section>

      <section class="card">
        <h2 class="card-title">Weekly targets</h2>
        ${targets ? `<ul class="plain-list">${targets}</ul>` : '<p class="empty small">Optional. e.g. "Posts" 2× per week. Tap + each time, or link tasks to the target and it counts them.</p>'}
        <form class="inline-add" data-form="target-add" data-id="${g.id}">
          <input name="label" placeholder="New target (e.g. Videos)" autocomplete="off">
          <input name="perWeek" type="number" min="1" value="1" class="num-mini" aria-label="Times per week">
          <span class="task-meta">/wk</span>
          <button class="link strong" type="submit">Add</button>
        </form>
      </section>

      <section class="card">
        <h2 class="card-title">Milestones</h2>
        ${minis.length ? `<ul class="task-list">${minis.map((m) => miniRow(m, 'goal', g.id)).join('')}</ul>` : ''}
        <form class="inline-add" data-form="goal-mini" data-id="${g.id}">
          <input name="title" placeholder="Add a dated milestone" autocomplete="off">
          <input name="date" type="date" class="date-mini" aria-label="Date (optional)">
          <button class="link strong" type="submit">Add</button>
        </form>
      </section>

      <section class="card">
        <h2 class="card-title">Completed tasks <span class="count">${contributions.length}</span></h2>
        ${contributionList(contributions)}
      </section>

      <button class="btn danger wide" data-action="delete-quarterly" data-id="${g.id}">Delete step</button>
    </div>`;
}

// ---------------------------------------------------------------- quarter planning + review
export function renderQuarterPlan(year, q) {
  const prev = D.prevQuarter(year, q);
  const prevGoals = S.quarterlyFor(prev.year, prev.q);
  const yearly = S.yearlyFor(year);
  const today = D.todayKey();
  const reviewEnd = D.quarterEnd(prev.year, prev.q);

  const review = prevGoals.length ? `
    <section class="card">
      <h2 class="card-title">How ${D.quarterLabel(prev.year, prev.q)} went</h2>
      <ul class="plain-list">${prevGoals.map((g) => {
        const p = S.quarterlyProgress(g, reviewEnd < today ? reviewEnd : today);
        const y = S.getYearly(g.yearlyId);
        return `<li><button class="q-row" data-action="open-goal" data-id="${g.id}">
          <span class="q-row-top"><span class="proj-title">${esc(g.title)}</span><span class="pnum">${p === null ? '—' : pct(p)}</span></span>
          ${p !== null ? progressBar(p) : ''}
          <span class="task-meta">${y ? esc(y.title) + ' · ' : ''}${goalSummary(g)}</span>
        </button></li>`;
      }).join('')}</ul>
    </section>` : '';

  const setters = yearly.length ? yearly.map((y) => {
    const qs = S.stepsForQuarter(year, q, y.id);
    return `
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">${esc(y.title)}</h2>
          <button class="link small" data-action="new-quarterly" data-yearly="${y.id}" data-q="${q}" data-year="${year}">+ Add</button>
        </div>
        ${qs.length ? `<ul class="plain-list">${qs.map((g) => quarterlyRow(g)).join('')}</ul>`
          : `<p class="empty small">What will you do in Q${q} to move this forward?</p>`}
        ${qs.some((g) => !g.q) ? `<p class="hint left">Steps marked "any time" count toward every quarter until they're done.</p>` : ''}
      </section>`;
  }).join('') : `<p class="empty">First add your yearly goals for ${year}.</p>
    <button class="btn wide" data-action="new-yearly" data-year="${year}">${icon('plus')} Add a ${year} goal</button>`;

  return `
    ${pageHeader(`${D.quarterLabel(year, q)} goals`, { backLabel: 'Goals' })}
    <div class="view-body">
      <div class="nav-row tight">
        <button class="icon-btn" data-action="plan-quarter" data-year="${prev.year}" data-q="${prev.q}" aria-label="Previous quarter">${icon('chev-left')}</button>
        <span class="nav-title static">${D.quarterLabel(year, q)}</span>
        <button class="icon-btn" data-action="plan-quarter" data-year="${D.nextQuarter(year, q).year}" data-q="${D.nextQuarter(year, q).q}" aria-label="Next quarter">${icon('chev-right')}</button>
      </div>
      ${review}
      <h3 class="group-label">Set goals for ${D.quarterLabel(year, q)}</h3>
      ${setters}
    </div>`;
}

// ---------------------------------------------------------------- forms
function openYearlyForm(y, year) {
  openFieldsSheet({
    title: y ? 'Edit Main Goal' : `New ${year} Goal`,
    fields: [
      { name: 'title', label: 'Goal', big: true, required: true, value: y?.title, placeholder: 'e.g. Pass Boards' },
      { name: 'year', label: 'Year', type: 'number', value: String(y?.year || year) },
      { name: 'notes', label: 'Why it matters / notes', multiline: true, value: y?.notes },
    ],
    onSave: (v) => {
      const fields = { title: v.title, year: Number(v.year) || year, notes: v.notes };
      if (y) S.updateYearly(y.id, fields);
      else { const ny = S.addYearly(fields); ui.goalYear = fields.year; go({ type: 'yearly', id: ny.id }); toast('Now add the steps to get there'); }
    },
  });
}

function openQuarterlyForm(g, { yearlyId, year, q } = {}) {
  const y = S.getYearly(g ? g.yearlyId : yearlyId);
  const yr = g ? g.year : (year || y?.year || new Date().getFullYear());
  const yearlyOpts = S.getData().yearlyGoals.filter((x) => x.year === yr)
    .map((x) => `<option value="${x.id}" ${x.id === (g ? g.yearlyId : yearlyId) ? 'selected' : ''}>${esc(x.title)}</option>`).join('');
  const curQ = g ? g.q : q;
  const qOpts = `<option value="" ${!curQ ? 'selected' : ''}>Any time</option>`
    + [1, 2, 3, 4].map((n) => `<option value="${n}" ${n === curQ ? 'selected' : ''}>Q${n} ${yr}</option>`).join('');
  openFieldsSheet({
    title: g ? 'Edit Step' : 'New Step',
    fields: [
      { name: 'title', label: 'Step', big: true, required: true, value: g?.title, placeholder: 'e.g. Finish practice tests' },
      { name: 'yearlyId', label: 'Main goal', type: 'select', options: yearlyOpts },
      { name: 'q', label: 'Quarter', type: 'select', options: qOpts },
      { name: 'notes', label: 'Notes', multiline: true, value: g?.notes, rows: 3 },
    ],
    onSave: (v) => {
      const fields = { title: v.title, yearlyId: v.yearlyId, q: v.q ? Number(v.q) : null, year: yr, notes: v.notes };
      if (g) {
        if (g.yearlyId !== fields.yearlyId) fields.order = S.stepsFor(fields.yearlyId).length;
        S.updateQuarterly(g.id, fields);
      } else {
        S.addQuarterly(fields);
        toast('Step added. Drag to reorder, tap to add tasks.');
      }
    },
    onDelete: g ? () => {
      if (!confirm(`Delete the step "${g.title}"? Its tasks stay on your calendar but won't be linked to it.`)) return false;
      S.deleteQuarterly(g.id);
      if (ui.page?.type === 'quarterly' && ui.page.id === g.id) back();
    } : null,
    deleteLabel: 'Delete step',
  });
}

// ---------------------------------------------------------------- taps
export const goalActions = {
  'goal-year': (el) => { ui.goalYear += Number(el.dataset.delta); },
  'new-yearly': (el) => { openYearlyForm(null, Number(el.dataset.year) || ui.goalYear); return false; },
  'edit-yearly': (el) => { openYearlyForm(S.getYearly(el.dataset.id)); return false; },
  'open-yearly': (el) => { ui.tab = 'goals'; go({ type: 'yearly', id: el.dataset.id }); return false; },
  'open-goal': (el) => {
    const id = el.dataset.id;
    ui.tab = 'goals';
    go(S.getYearly(id) ? { type: 'yearly', id } : { type: 'quarterly', id, parent: ui.page && ui.page.type !== 'quarterly' ? ui.page : null });
    return false;
  },
  'delete-yearly': (el) => {
    const y = S.getYearly(el.dataset.id);
    if (confirm(`Delete "${y.title}" and all its steps? Linked tasks stay but lose the goal link.`)) { S.deleteYearly(y.id); back(); }
    return false;
  },
  'new-quarterly': (el) => {
    openQuarterlyForm(null, { yearlyId: el.dataset.yearly, q: Number(el.dataset.q), year: Number(el.dataset.year) || undefined });
    return false;
  },
  'edit-quarterly': (el) => { openQuarterlyForm(S.getQuarterly(el.dataset.id)); return false; },
  'delete-quarterly': (el) => {
    const g = S.getQuarterly(el.dataset.id);
    if (confirm(`Delete "${g.title}"?`)) { S.deleteQuarterly(g.id); back(); }
    return false;
  },
  'plan-quarter': (el) => {
    ui.tab = 'goals';
    go({ type: 'quarter-plan', year: Number(el.dataset.year), q: Number(el.dataset.q) });
    return false;
  },
  'plan-year': (el) => {
    const year = Number(el.dataset.year);
    ui.tab = 'goals'; ui.page = null; ui.goalYear = year;
    openYearlyForm(null, year);
  },
  'target-adj': (el) => {
    const g = S.getQuarterly(el.dataset.goal);
    if (g) S.adjustTarget(g, el.dataset.tid, D.startOfWeek(D.todayKey()), Number(el.dataset.delta));
    return false;
  },
  'target-delete': (el) => {
    const g = S.getQuarterly(el.dataset.goal);
    const t = g?.targets.find((x) => x.id === el.dataset.tid);
    if (t && confirm(`Delete target "${t.label}"?`)) S.deleteTarget(g, t.id);
    return false;
  },
  'goal-add-task': (el) => { openTaskSheet({ date: D.todayKey(), defaults: { goalId: el.dataset.goal } }); return false; },
  'step-done': (el) => {
    const g = S.getQuarterly(el.dataset.id);
    if (!g) return false;
    S.setStepDone(g.id, !g.done);
    if (!g.done) return false;
    const next = S.currentStep(g.yearlyId);
    toast(next ? `Nice! Up next: Step ${S.stepNumber(next)} · ${next.title}` : 'Every step done. Goal complete!');
    return false;
  },
};

export function afterGoals() {
  makeSortable(document.getElementById('steps-sort'), (ids) => S.reorderSteps(ids));
}

export const goalForms = {
  'step-task': (form) => {
    const g = S.getQuarterly(form.dataset.id);
    const title = form.title.value.trim();
    if (!g || !title) return;
    S.addTask({ title, date: form.date.value || null, goalId: g.id });
    setTimeout(() => document.querySelector(`[data-form="step-task"][data-id="${g.id}"] input[name=title]`)?.focus(), 0);
  },
  'target-add': (form) => {
    const g = S.getQuarterly(form.dataset.id);
    const label = form.label.value.trim();
    if (g && label) S.addTarget(g, label, form.perWeek.value);
  },
  'goal-mini': (form) => {
    const g = S.getQuarterly(form.dataset.id);
    const title = form.title.value.trim();
    if (g && title) S.addMiniGoal(g, title, form.date.value);
    setTimeout(() => document.querySelector('[data-form="goal-mini"] input[name=title]')?.focus(), 0);
  },
};
