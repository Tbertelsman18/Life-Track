// Projects tab: Active (priority order), Radar (queue), Done, and each project's page.

import * as D from './dates.js';
import * as S from './store.js';
import { ui, esc, icon, go, back, progressBar, sectionColor, sectionOptions, wireSectionSelect,
  pageHeader, makeSortable, toast } from './ui.js';
import { openFieldsSheet, openTaskSheet } from './forms.js';
import { taskRow } from './home.js';
import { renderIdeas } from './more.js';

function ago(iso) {
  if (!iso) return 'never';
  const n = D.daysBetween(D.keyOfISO(iso), D.todayKey());
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return `${n} days ago`;
  if (n < 14) return '1 week ago';
  return `${Math.floor(n / 7)} weeks ago`;
}

// "Started today", "1 day", "12 days"
function daysLabel(n) {
  if (n === null) return '';
  return n === 0 ? 'Started today' : n === 1 ? '1 day' : `${n} days`;
}

const statusClass = (s) => ({ 'Not started': 'st-new', 'In progress': 'st-prog', Stuck: 'st-stuck', Done: 'st-done' }[s] || '');

// ---------------------------------------------------------------- list
export function renderProjects() {
  const count = (id) => (id === 'ideas' ? S.getData().ideas.length : S.projectsIn(id).length);
  const tabs = [['active', 'Active'], ['radar', 'Radar'], ['ideas', 'Ideas'], ['done', 'Done']].map(([id, label]) => `
    <button class="seg-btn ${ui.projectsTab === id ? 'on' : ''}" data-action="projects-tab" data-tab-id="${id}">
      ${label} <span class="seg-count">${count(id) || ''}</span></button>`).join('');

  if (ui.projectsTab === 'ideas') {
    return `
    <header class="page-header"><h1>Projects</h1></header>
    <div class="view-body">
      <div class="seg proj-seg">${tabs}</div>
      ${renderIdeas()}
    </div>`;
  }

  const list = S.projectsIn(ui.projectsTab);
  let body;
  if (!list.length) {
    body = {
      active: `<p class="empty big">No active projects yet.<br>Add one, then press and hold ≡ to drag it into priority order (#1 at the top).</p>`,
      radar: `<p class="empty big">Projects you want to get done at some point, just not on your top list right now.<br>Each one works like an active project: add milestones and tasks whenever you're ready.</p>`,
      done: `<p class="empty big">Finished projects show up here.</p>`,
    }[ui.projectsTab];
  } else {
    body = `<ul class="proj-list" id="proj-sort">${list.map((p, i) => projectCard(p, i)).join('')}</ul>`;
  }

  return `
    <header class="page-header"><h1>Projects</h1></header>
    <div class="view-body">
      <div class="seg proj-seg">${tabs}</div>
      ${ui.projectsTab !== 'done' ? `<p class="hint">${ui.projectsTab === 'active'
        ? 'Press and hold ☰, then drag to change priority. #1 is your top project.'
        : 'Projects for later. Start adding milestones and tasks anytime. Drag ☰ to reorder; the top one is next in line.'}</p>` : ''}
      ${body}
      ${ui.projectsTab !== 'done' ? `<button class="btn wide" data-action="new-project">${icon('plus')} New project</button>` : ''}
    </div>`;
}

function projectCard(p, i) {
  const prog = S.projectProgress(p.id);
  const sortable = p.state !== 'done';
  const days = S.daysInProgress(p);
  const nextTask = p.state === 'active' ? S.projectTasks(p.id).find((t) => !t.repeat && !t.done) : null;
  const nextMini = (p.miniGoals || []).filter((m) => !m.done && m.date).sort((a, b) => a.date.localeCompare(b.date))[0];
  return `
    <li class="proj-card" data-id="${p.id}" style="--c:${sectionColor(p.sectionId)}">
      ${sortable ? `<span class="drag" aria-label="Drag to reorder">${icon('drag')}</span>` : ''}
      <button class="proj-main" data-action="open-project" data-id="${p.id}">
        <span class="proj-top">
          ${sortable ? `<span class="rank">#${i + 1}</span>` : ''}
          <span class="proj-title">${esc(p.title)}</span>
          ${p.state === 'active' ? `<span class="status ${statusClass(p.status)}">${esc(p.status)}</span>` : ''}
        </span>
        ${prog.total ? `<span class="proj-prog">${progressBar(prog.done / prog.total, sectionColor(p.sectionId))}<span class="pnum">${prog.done}/${prog.total}</span>${days !== null ? `<span class="pdays">${daysLabel(days)}</span>` : ''}</span>`
          : days !== null ? `<span class="proj-prog"><span class="pdays solo">${daysLabel(days)}</span></span>` : ''}
        <span class="task-meta">
          ${p.state === 'done' ? `Finished ${p.completedAt ? D.formatShort(D.keyOfISO(p.completedAt)) : ''}` : `Worked on ${ago(p.lastWorkedAt)}`}
          ${p.targetDate && p.state !== 'done' ? ` · Target ${D.formatMonthDay(p.targetDate)}` : ''}
          ${nextMini ? ` · Next: ${esc(nextMini.title)} ${D.formatMonthDay(nextMini.date)}` : nextTask ? ` · Next up: ${esc(nextTask.title)}` : ''}
        </span>
      </button>
    </li>`;
}

export function afterProjects() {
  makeSortable(document.getElementById('proj-sort'), (ids) => S.reorderProjects(ui.projectsTab, ids));
}

// ---------------------------------------------------------------- project page
export function renderProjectPage(id) {
  const p = S.getProject(id);
  if (!p) return pageHeader('Project not found', { backLabel: 'Projects' });
  const prog = S.projectProgress(p.id);
  const minis = [...(p.miniGoals || [])].sort((a, b) => (a.done - b.done) || (a.date || '9999').localeCompare(b.date || '9999'));
  const known = new Set(minis.map((m) => m.id));
  // Tasks not under any milestone (one-time and repeating together)
  const otherTasks = S.projectTasks(p.id).filter((t) => !t.milestoneId || !known.has(t.milestoneId));
  const statuses = S.PROJECT_STATUSES.map((s) => `
    <button class="chip ${p.status === s ? 'on' : ''} ${statusClass(s)}" data-action="project-status" data-id="${p.id}" data-status="${s}">${s}</button>`).join('');

  // Order: the goal (title) → add a milestone → each milestone with its tasks → other tasks → notes → details.
  return `
    ${pageHeader(p.title, { backLabel: 'Projects', right: `<button class="link" data-action="edit-project" data-id="${p.id}">Edit</button>` })}
    <div class="view-body">
      <section class="card">
        <form class="inline-add top-line" data-form="project-mini" data-id="${p.id}">
          <span class="ms-plus">${icon('flag')}</span>
          <input name="title" placeholder="Milestone" autocomplete="off">
          <input name="date" type="date" aria-label="Date (optional)" class="date-mini">
          <button class="link strong" type="submit">Add</button>
        </form>
        ${minis.length ? '' : `<p class="hint left">Start with the milestones: the big things you need to reach this goal.
          Then add the tasks for each one right inside it.</p>`}
      </section>

      ${minis.map((m) => milestoneBlock(p, m)).join('')}

      ${otherTasks.length || !minis.length ? `<section class="card ms-card">
        <h2 class="card-title">${minis.length ? 'Other tasks' : 'Tasks'} ${countOf(otherTasks)}</h2>
        ${taskListOf(otherTasks)}
        ${addTaskForm(p, null)}
      </section>` : ''}

      <section class="card">
        <h2 class="card-title">Notes</h2>
        <textarea class="notes-area" data-notes="project" data-id="${p.id}" rows="4" placeholder="Ideas, links, anything…">${esc(p.notes)}</textarea>
      </section>

      <section class="card">
        <h2 class="card-title">Details</h2>
        <div class="status-chips">${statuses}</div>
        <div class="kv"><span>Section</span><b><i class="swatch" style="background:${sectionColor(p.sectionId)}"></i> ${esc(S.getSection(p.sectionId)?.name || 'None')}</b></div>
        ${prog.total ? `<div class="kv"><span>Progress</span><b>${prog.done}/${prog.total} tasks</b></div>` : ''}
        ${p.targetDate ? `<div class="kv"><span>Target date</span><b>${D.formatShort(p.targetDate)} <small>(${D.countdown(D.todayKey(), p.targetDate)})</small></b></div>` : ''}
        ${S.daysInProgress(p) !== null ? `<div class="kv"><span>In progress</span><b>${daysLabel(S.daysInProgress(p))}</b></div>` : ''}
        <div class="kv"><span>Last worked on</span><b>${ago(p.lastWorkedAt)}</b></div>
      </section>

      <div class="btn-col">
        ${p.state === 'active' ? `<button class="btn wide" data-action="project-done" data-id="${p.id}">${icon('check')} Mark project done</button>
          <button class="btn wide" data-action="project-move" data-id="${p.id}" data-to="radar">Move to Radar</button>` : ''}
        ${p.state === 'radar' ? `<button class="btn wide" data-action="project-move" data-id="${p.id}" data-to="active">Make active</button>` : ''}
        ${p.state === 'done' ? `<button class="btn wide" data-action="project-move" data-id="${p.id}" data-to="active">Reopen project</button>` : ''}
        <button class="btn danger wide" data-action="delete-project" data-id="${p.id}">Delete project</button>
      </div>
    </div>`;
}

// Which tasks show their steps. Until you open or close one yourself, the
// first unfinished task with steps is open (your "next up").
function isOpen(t, list) {
  ui.openSteps = ui.openSteps || {};
  if (t.id in ui.openSteps) return ui.openSteps[t.id];
  const next = list.find((x) => !x.done && x.steps && x.steps.length);
  return Boolean(next && next.id === t.id);
}

// One milestone: its checkbox, date and progress, then its tasks underneath.
function milestoneBlock(p, m) {
  const all = S.milestoneTasks(p.id, m.id);
  const list = all.filter((t) => !t.repeat); // one-time tasks count toward progress
  const done = list.filter((t) => t.done).length;
  return `<section class="card ms-card ${m.done ? 'ms-done' : ''}">
    <div class="ms-head">
      <button class="check square" style="--c:var(--accent)" data-action="mini-toggle" data-kind="project" data-owner="${p.id}" data-mid="${m.id}"
        aria-label="${m.done ? 'Mark not done' : 'Mark done'}">${m.done ? icon('check') : ''}</button>
      <div class="ms-title">
        <span class="ms-name">${icon('flag')} ${esc(m.title)}</span>
        <span class="task-meta">${m.date ? `${D.formatShort(m.date)}${!m.done ? ` · ${D.countdown(D.todayKey(), m.date)}` : ''}` : 'No date'}${list.length ? ` · ${done}/${list.length} tasks` : ''}</span>
      </div>
      <button class="icon-btn sm muted" data-action="mini-delete" data-kind="project" data-owner="${p.id}" data-mid="${m.id}" aria-label="Delete milestone">${icon('x')}</button>
    </div>
    ${list.length ? progressBar(done / list.length, sectionColor(p.sectionId)) : ''}
    ${taskListOf(all)}
    ${addTaskForm(p, m.id)}
  </section>`;
}

// One-time tasks first, then repeating ones, all in the same list.
const taskListOf = (tasks) => (tasks.length
  ? `<ul class="task-list">${tasks.map((t) => (t.repeat ? repeatRow(t) : projectTaskRow(t))).join('')}</ul>` : '');

const countOf = (tasks) => {
  const one = tasks.filter((t) => !t.repeat);
  return one.length ? `<span class="count">${one.filter((t) => t.done).length}/${one.length}</span>` : '';
};

function addTaskForm(p, milestoneId) {
  return `<form class="inline-add" data-form="project-task" data-id="${p.id}" data-milestone="${milestoneId || ''}">
    <input name="title" placeholder="${milestoneId ? 'Add a task to this milestone' : 'Add a task'}" autocomplete="off">
    <button class="link strong" type="submit">Add</button>
  </form>
  <button class="add-inline" data-action="project-task-full" data-id="${p.id}" data-milestone="${milestoneId || ''}">${icon('repeat')} Add a repeating task</button>`;
}

// A project task: just the task (tap it to edit, or to add it to your schedule).
const projectTaskRow = (t) => taskRow(t, t.date, { showDate: true, inProject: true });

// (Older: a project task with a fold-out checklist of steps. Not used for now.)
function taskWithSteps(t, open) {
  const sp = S.stepProgress(t);
  const color = sectionColor(t.sectionId);
  const toggle = sp.total
    ? `<button class="steps-toggle" data-action="steps-open" data-id="${t.id}" aria-expanded="${open}">
        <span class="chev-toggle ${open ? 'open' : ''}">${icon('chev-right')}</span>
        <span class="steps-bar">${progressBar(sp.done / sp.total, color)}</span>
        <span class="steps-count">${sp.done}/${sp.total} steps</span></button>`
    : (open ? '' : `<button class="steps-toggle add" data-action="steps-open" data-id="${t.id}">${icon('plus')} Add steps</button>`);
  const steps = open ? `
      <ul class="tsteps">
        ${(t.steps || []).map((s) => `
        <li class="tstep ${s.done ? 'done' : ''}">
          <button class="check square sm" data-action="step-toggle" data-id="${t.id}" data-step="${s.id}"
            aria-label="${s.done ? 'Mark not done' : 'Mark done'}">${s.done ? icon('check') : ''}</button>
          <span class="tstep-title">${esc(s.title)}</span>
          <button class="icon-btn sm muted" data-action="step-delete" data-id="${t.id}" data-step="${s.id}" aria-label="Delete step">${icon('x')}</button>
        </li>`).join('')}
      </ul>
      <form class="inline-add step-add" data-form="step-add" data-id="${t.id}">
        <input name="title" placeholder="Add a step" autocomplete="off">
        <button class="link strong" type="submit">Add</button>
      </form>` : '';
  return `${taskRow(t, t.date, { showDate: true, inProject: true })}
    <li class="steps-wrap" style="--c:${color}">${toggle}${steps}</li>`;
}

// A repeating task: shows its days; tap to change them.
export function repeatRow(t) {
  const days = D.WEEK_ORDER.filter((d) => t.repeat.days.includes(d)).map((d) => D.DAY_NAMES[d]).join(', ');
  return `
    <li class="task repeat-row" style="--c:${sectionColor(t.sectionId)}">
      <span class="rep-ic">${icon('repeat')}</span>
      <button class="task-main" data-action="edit" data-id="${t.id}">
        <span class="task-title">${esc(t.title)}</span>
        <span class="task-meta">Every ${days}${t.time ? ' · ' + D.formatTime(t.time) : ''}</span>
      </button>
    </li>`;
}

export function miniRow(m, ownerKind, ownerId) {
  return `
    <li class="task ${m.done ? 'done' : ''}" style="--c:var(--accent)">
      <button class="check square" data-action="mini-toggle" data-kind="${ownerKind}" data-owner="${ownerId}" data-mid="${m.id}"
        aria-label="${m.done ? 'Mark not done' : 'Mark done'}">${m.done ? icon('check') : ''}</button>
      <span class="task-main static">
        <span class="task-title">${esc(m.title)}</span>
        ${m.date ? `<span class="task-meta">${icon('flag')} ${D.formatShort(m.date)}${!m.done ? ` · ${D.countdown(D.todayKey(), m.date)}` : ''}</span>` : ''}
      </span>
      <button class="icon-btn sm muted" data-action="mini-delete" data-kind="${ownerKind}" data-owner="${ownerId}" data-mid="${m.id}" aria-label="Delete">${icon('x')}</button>
    </li>`;
}

function openProjectForm(p, state = 'active') {
  openFieldsSheet({
    title: p ? 'Edit Project' : 'New Project',
    fields: [
      { name: 'title', label: 'Project name', big: true, required: true, value: p?.title },
      { name: 'sectionId', label: 'Section', type: 'select', options: sectionOptions(p ? p.sectionId : S.getData().sections[0]?.id) },
      { name: 'targetDate', label: 'Target date', type: 'date', value: p?.targetDate || '' },
    ],
    onSave: (v) => {
      const fields = { title: v.title, sectionId: v.sectionId || null, targetDate: v.targetDate || null };
      if (p) S.updateProject(p.id, fields);
      else {
        const np = S.addProject({ ...fields, state });
        go({ type: 'project', id: np.id });
      }
    },
  });
}

// Finishing a project: offer to bring up the next one from Radar.
function finishProject(p) {
  S.moveProject(p.id, 'done');
  toast(`"${p.title}" is done!`);
  const next = S.projectsIn('radar')[0];
  if (next && confirm(`Nice work! Move "${next.title}" from Radar into your Active projects?`)) {
    S.moveProject(next.id, 'active');
    toast(`"${next.title}" is now active`);
  }
}

const ownerOf = (el) => (el.dataset.kind === 'project' ? S.getProject(el.dataset.owner) : S.getQuarterly(el.dataset.owner));

export const projectActions = {
  'projects-tab': (el) => { ui.projectsTab = el.dataset.tabId; },
  'new-project': () => { openProjectForm(null, ui.projectsTab === 'radar' ? 'radar' : 'active'); return false; },
  'open-project': (el) => { ui.tab = 'projects'; go({ type: 'project', id: el.dataset.id }); return false; },
  'edit-project': (el) => { openProjectForm(S.getProject(el.dataset.id)); return false; },
  'project-status': (el) => {
    const p = S.getProject(el.dataset.id);
    if (el.dataset.status === 'Done') { if (p.state !== 'done') finishProject(p); }
    else {
      if (p.state === 'done') S.moveProject(p.id, 'active');
      S.updateProject(p.id, { status: el.dataset.status }, { worked: true });
    }
    return false;
  },
  'project-task-full': (el) => {
    const p = S.getProject(el.dataset.id);
    // Opens with "Repeat on" showing; the task stays under the milestone it was added from.
    openTaskSheet({ date: null, defaults: { projectId: p.id, sectionId: p.sectionId, milestoneId: el.dataset.milestone || null }, showMore: true });
    return false;
  },
  'steps-open': (el) => {
    const t = S.getTask(el.dataset.id);
    const list = S.projectTasks(t.projectId).filter((x) => !x.repeat);
    ui.openSteps = ui.openSteps || {};
    const opening = !isOpen(t, list);
    ui.openSteps[t.id] = opening;
    if (opening && !(t.steps || []).length) setTimeout(() => document.querySelector(`[data-form="step-add"][data-id="${t.id}"] input`)?.focus(), 0);
  },
  'step-toggle': (el) => { S.toggleStep(el.dataset.id, el.dataset.step); return false; },
  'step-delete': (el) => { S.deleteStep(el.dataset.id, el.dataset.step); return false; },
  'project-done': (el) => { finishProject(S.getProject(el.dataset.id)); return false; },
  'project-move': (el) => {
    S.moveProject(el.dataset.id, el.dataset.to);
    ui.projectsTab = el.dataset.to;
    toast(el.dataset.to === 'radar' ? 'Moved to Radar' : 'Now active (bottom of the list)');
    return false;
  },
  'delete-project': (el) => {
    const p = S.getProject(el.dataset.id);
    if (confirm(`Delete "${p.title}"? Its tasks will stay on your calendar but won't belong to a project.`)) {
      S.deleteProject(p.id);
      back();
    }
    return false;
  },
  'mini-toggle': (el) => {
    const o = ownerOf(el);
    if (o) {
      S.toggleMiniGoal(o, el.dataset.mid);
      if (el.dataset.kind === 'project') S.updateProject(o.id, {}, { worked: true });
    }
    return false;
  },
  'mini-delete': (el) => {
    const o = ownerOf(el);
    const m = o?.miniGoals.find((x) => x.id === el.dataset.mid);
    if (m && confirm(`Delete milestone "${m.title}"? Its tasks stay in the project under "Other tasks".`)) S.deleteMiniGoal(o, m.id);
    return false;
  },
};

export const projectForms = {
  'step-add': (form) => {
    const id = form.dataset.id;
    const title = form.title.value.trim();
    if (!title) return;
    ui.openSteps = ui.openSteps || {};
    ui.openSteps[id] = true;
    S.addStep(id, title);
    setTimeout(() => document.querySelector(`[data-form="step-add"][data-id="${id}"] input`)?.focus(), 0);
  },
  'project-task': (form) => {
    const p = S.getProject(form.dataset.id);
    const title = form.title.value.trim();
    if (!p || !title) return;
    const milestoneId = form.dataset.milestone || null;
    S.addTask({ title, date: null, projectId: p.id, sectionId: p.sectionId, milestoneId }); // undated: tap the task to give it a day
    setTimeout(() => document.querySelector(`[data-form="project-task"][data-milestone="${milestoneId || ''}"] input[name=title]`)?.focus(), 0);
  },
  'project-mini': (form) => {
    const p = S.getProject(form.dataset.id);
    const title = form.title.value.trim();
    if (!p || !title) return;
    S.addMiniGoal(p, title, form.date.value);
    refocus('project-mini');
  },
};

function refocus(name) {
  setTimeout(() => document.querySelector(`[data-form="${name}"] input[name=title]`)?.focus(), 0);
}

export { openTaskSheet };
