// Goals tab: yearly goals, quarterly goals, weekly targets, progress,
// reminders and quarterly reviews.

import * as D from './dates.js';
import * as S from './store.js';
import { ui, esc, icon, go, back, progressBar, pct, pageHeader, toast } from './ui.js';
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
  const showQ = year === cur.year ? cur.q : year > cur.year ? 1 : 4;
  const yearly = S.yearlyFor(year);
  const reminders = S.goalReminders(today);

  const cards = yearly.map((y) => {
    const prog = S.yearlyProgress(y);
    const qs = S.quarterlyFor(year, showQ, y.id);
    const slipping = year === cur.year && isSlipping(y.id, y.createdAt);
    return `
      <li class="goal-card">
        <button class="goal-main" data-action="open-yearly" data-id="${y.id}">
          <span class="proj-top">
            <span class="proj-title">${esc(y.title)}</span>
            ${slipping ? `<span class="status st-stuck">Slipping</span>` : ''}
            <span class="pnum">${pct(prog)}</span>
          </span>
          ${prog !== null ? progressBar(prog) : ''}
          ${qs.length ? `<span class="q-list">${qs.map((q) => {
            const qp = S.quarterlyProgress(q);
            return `<span class="q-line"><span>Q${q.q}: ${esc(q.title)}</span><b>${qp === null ? '' : pct(qp)}</b></span>`;
          }).join('')}</span>` : `<span class="task-meta">No Q${showQ} goals yet</span>`}
        </button>
      </li>`;
  }).join('');

  const slipping = year === cur.year ? S.quarterlyFor(cur.year, cur.q).filter((q) => isSlipping(q.id, q.createdAt)) : [];

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

      <h3 class="group-label">Yearly goals${yearly.length ? ` · showing Q${showQ}` : ''}</h3>
      ${yearly.length ? `<ul class="goal-list">${cards}</ul>`
        : `<p class="empty">No goals for ${year} yet. Start with the big things you want this year (e.g. Pass Boards, Grow the Clinic).</p>`}
      <button class="btn wide" data-action="new-yearly" data-year="${year}">${icon('plus')} Add a ${year} goal</button>

      ${yearly.length ? `<button class="btn wide" data-action="plan-quarter" data-year="${year}" data-q="${showQ}">
        ${icon('target')} ${year === cur.year ? `Q${cur.q} goals &amp; last quarter's review` : `Plan Q${showQ} ${year}`}</button>` : ''}

      ${slipping.length ? `
        <h3 class="group-label">Slipping · no activity in ${SLIPPING_DAYS}+ days</h3>
        <ul class="group">${slipping.map((q) => `
          <li><button class="row" data-action="open-goal" data-id="${q.id}">
            ${icon('turtle')}<span class="row-label">${esc(q.title)}</span><span class="row-value">${esc(lastActivityText(q.id))}</span>
          </button></li>`).join('')}</ul>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- yearly page
export function renderYearlyPage(id) {
  const y = S.getYearly(id);
  if (!y) return pageHeader('Goal not found', { backLabel: 'Goals' });
  const prog = S.yearlyProgress(y);
  const contributions = S.goalCompletions(y.id);
  const cur = D.quarterOf(D.todayKey());

  const quarters = [1, 2, 3, 4].map((q) => {
    const qs = S.quarterlyFor(y.year, q, y.id);
    const isCur = y.year === cur.year && q === cur.q;
    return `
      <section class="card ${isCur ? 'current-q' : ''}">
        <div class="card-head">
          <h2 class="card-title">Q${q} · ${['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'][q - 1]}${isCur ? ' <span class="count">Now</span>' : ''}</h2>
          <button class="link small" data-action="new-quarterly" data-yearly="${y.id}" data-q="${q}">+ Add</button>
        </div>
        ${qs.length ? `<ul class="plain-list">${qs.map((g) => quarterlyRow(g)).join('')}</ul>` : '<p class="empty small">No goals this quarter.</p>'}
      </section>`;
  }).join('');

  return `
    ${pageHeader(y.title, { backLabel: 'Goals', right: `<button class="link" data-action="edit-yearly" data-id="${y.id}">Edit</button>` })}
    <div class="view-body">
      <section class="card">
        <div class="proj-top"><span class="task-meta">${y.year} · ${esc(lastActivityText(y.id))}</span><span class="pnum">${pct(prog)}</span></div>
        ${progressBar(prog)}
        ${y.notes ? `<p class="notes-text">${esc(y.notes)}</p>` : ''}
      </section>
      ${quarters}
      <section class="card">
        <h2 class="card-title">Completed tasks that count <span class="count">${contributions.length}</span></h2>
        ${contributionList(contributions)}
      </section>
      <button class="btn wide" data-action="goal-add-task" data-goal="${y.id}">${icon('plus')} Add a task for this goal</button>
      <button class="btn danger wide" data-action="delete-yearly" data-id="${y.id}">Delete goal</button>
    </div>`;
}

function quarterlyRow(g) {
  const p = S.quarterlyProgress(g);
  return `<li><button class="q-row" data-action="open-goal" data-id="${g.id}">
    <span class="q-row-top"><span class="proj-title">${esc(g.title)}</span><span class="pnum">${p === null ? '' : pct(p)}</span>${icon('chev-right')}</span>
    ${p !== null ? progressBar(p) : ''}
    <span class="task-meta">${goalSummary(g)}</span>
  </button></li>`;
}

function goalSummary(g) {
  const bits = [];
  const minis = g.miniGoals || [];
  if (minis.length) bits.push(`${minis.filter((m) => m.done).length}/${minis.length} mini goals`);
  for (const t of g.targets || []) {
    const weeks = S.targetWeeks(g, t);
    const streak = S.targetStreak(weeks);
    bits.push(`${esc(t.label)}: ${streak} wk streak`);
  }
  const n = S.goalCompletions(g.id).length;
  if (n) bits.push(`${n} task${n > 1 ? 's' : ''} done`);
  return bits.join(' · ') || 'Add mini goals or a weekly target to track progress';
}

function contributionList(list, limit = 15) {
  if (!list.length) return `<p class="empty small">When you finish a task linked to this goal, it shows up here.</p>`;
  return `<ul class="contrib">${list.slice(0, limit).map((c) => `
    <li>${icon('check')}<span>${esc(c.task.title)}</span><time>${D.formatMonthDay(c.date)}</time></li>`).join('')}
    ${list.length > limit ? `<li class="more">+ ${list.length - limit} more</li>` : ''}</ul>`;
}

// ---------------------------------------------------------------- quarterly page
export function renderQuarterlyPage(id) {
  const g = S.getQuarterly(id);
  if (!g) return pageHeader('Goal not found', { backLabel: 'Goals' });
  const y = S.getYearly(g.yearlyId);
  const p = S.quarterlyProgress(g);
  const today = D.todayKey();
  const thisWeek = D.startOfWeek(today);
  const minis = [...(g.miniGoals || [])].sort((a, b) => (a.done - b.done) || (a.date || '9999').localeCompare(b.date || '9999'));

  const targets = (g.targets || []).map((t) => {
    const weeks = S.targetWeeks(g, t);
    const streak = S.targetStreak(weeks);
    const finished = weeks.filter((w) => !w.current);
    const hits = finished.filter((w) => w.hit).length;
    const inQuarter = today >= D.quarterStart(g.year, g.q) && today <= D.quarterEnd(g.year, g.q);
    const nowCount = inQuarter ? S.targetCount(t, thisWeek) : null;
    return `
      <li class="target">
        <div class="target-top">
          <span class="proj-title">${esc(t.label)}</span>
          <span class="task-meta">${t.perWeek}× per week</span>
          <button class="icon-btn sm muted" data-action="target-delete" data-goal="${g.id}" data-tid="${t.id}" aria-label="Delete target">${icon('x')}</button>
        </div>
        ${inQuarter ? `
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

  return `
    ${pageHeader(g.title, { backLabel: y ? y.title : 'Goals', right: `<button class="link" data-action="edit-quarterly" data-id="${g.id}">Edit</button>` })}
    <div class="view-body">
      <section class="card">
        <div class="proj-top"><span class="task-meta">${D.quarterLabel(g.year, g.q)}${y ? ` · toward <b>${esc(y.title)}</b>` : ''}</span><span class="pnum">${pct(p)}</span></div>
        ${p !== null ? progressBar(p) : '<p class="hint left">Add mini goals or a weekly target below to measure progress.</p>'}
        <div class="task-meta">${esc(lastActivityText(g.id))}</div>
        ${g.notes ? `<p class="notes-text">${esc(g.notes)}</p>` : ''}
      </section>

      <section class="card">
        <h2 class="card-title">Weekly targets</h2>
        ${targets ? `<ul class="plain-list">${targets}</ul>` : '<p class="empty small">e.g. "Posts" 2× per week. Tap + each time, or link tasks to the target and it counts them.</p>'}
        <form class="inline-add" data-form="target-add" data-id="${g.id}">
          <input name="label" placeholder="New target (e.g. Videos)" autocomplete="off">
          <input name="perWeek" type="number" min="1" value="1" class="num-mini" aria-label="Times per week">
          <span class="task-meta">/wk</span>
          <button class="link strong" type="submit">Add</button>
        </form>
      </section>

      <section class="card">
        <h2 class="card-title">Mini goals</h2>
        ${minis.length ? `<ul class="task-list">${minis.map((m) => miniRow(m, 'goal', g.id)).join('')}</ul>` : ''}
        <form class="inline-add" data-form="goal-mini" data-id="${g.id}">
          <input name="title" placeholder="Add a mini goal" autocomplete="off">
          <input name="date" type="date" class="date-mini" aria-label="Date (optional)">
          <button class="link strong" type="submit">Add</button>
        </form>
      </section>

      <section class="card">
        <h2 class="card-title">Completed tasks that count <span class="count">${contributions.length}</span></h2>
        ${contributionList(contributions)}
      </section>

      <button class="btn wide" data-action="goal-add-task" data-goal="${g.id}">${icon('plus')} Add a task for this goal</button>
      <button class="btn danger wide" data-action="delete-quarterly" data-id="${g.id}">Delete quarterly goal</button>
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
    const qs = S.quarterlyFor(year, q, y.id);
    return `
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">${esc(y.title)}</h2>
          <button class="link small" data-action="new-quarterly" data-yearly="${y.id}" data-q="${q}" data-year="${year}">+ Add</button>
        </div>
        ${qs.length ? `<ul class="plain-list">${qs.map((g) => quarterlyRow(g)).join('')}</ul>`
          : `<p class="empty small">What will you do in Q${q} to move this forward?</p>`}
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
    title: y ? 'Edit Yearly Goal' : `New ${year} Goal`,
    fields: [
      { name: 'title', label: 'Goal', big: true, required: true, value: y?.title, placeholder: 'e.g. Pass Boards' },
      { name: 'year', label: 'Year', type: 'number', value: String(y?.year || year) },
      { name: 'notes', label: 'Why it matters / notes', multiline: true, value: y?.notes },
    ],
    onSave: (v) => {
      const fields = { title: v.title, year: Number(v.year) || year, notes: v.notes };
      if (y) S.updateYearly(y.id, fields);
      else { S.addYearly(fields); ui.goalYear = fields.year; }
    },
  });
}

function openQuarterlyForm(g, { yearlyId, year, q } = {}) {
  const y = S.getYearly(g ? g.yearlyId : yearlyId);
  const yr = g ? g.year : (year || y?.year || new Date().getFullYear());
  const yearlyOpts = S.getData().yearlyGoals.filter((x) => x.year === yr)
    .map((x) => `<option value="${x.id}" ${x.id === (g ? g.yearlyId : yearlyId) ? 'selected' : ''}>${esc(x.title)}</option>`).join('');
  const qOpts = [1, 2, 3, 4].map((n) => `<option value="${n}" ${n === (g ? g.q : q) ? 'selected' : ''}>Q${n} ${yr}</option>`).join('');
  openFieldsSheet({
    title: g ? 'Edit Quarterly Goal' : 'New Quarterly Goal',
    fields: [
      { name: 'title', label: 'Quarterly goal', big: true, required: true, value: g?.title, placeholder: 'e.g. Post consistently on Instagram' },
      { name: 'yearlyId', label: 'Yearly goal', type: 'select', options: yearlyOpts },
      { name: 'q', label: 'Quarter', type: 'select', options: qOpts },
      { name: 'notes', label: 'Notes', multiline: true, value: g?.notes, rows: 3 },
    ],
    onSave: (v) => {
      const fields = { title: v.title, yearlyId: v.yearlyId, q: Number(v.q), year: yr, notes: v.notes };
      if (g) S.updateQuarterly(g.id, fields);
      else {
        const ng = S.addQuarterly(fields);
        toast('Added. Tap it to add mini goals or weekly targets.');
        return ng && undefined;
      }
    },
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
    if (confirm(`Delete "${y.title}" and its quarterly goals? Linked tasks stay but lose the goal link.`)) { S.deleteYearly(y.id); back(); }
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
};

export const goalForms = {
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
