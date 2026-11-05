// Projects tab: Active (priority order), Radar (queue), Done, and each project's page.

import * as D from './dates.js';
import * as S from './store.js';
import { ui, esc, icon, go, back, progressBar, sectionColor, sectionOptions, wireSectionSelect,
  pageHeader, makeSortable, toast } from './ui.js';
import { openFieldsSheet, openTaskSheet } from './forms.js';
import { taskRow } from './home.js';

function ago(iso) {
  if (!iso) return 'never';
  const n = D.daysBetween(D.keyOfISO(iso), D.todayKey());
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return `${n} days ago`;
  if (n < 14) return '1 week ago';
  return `${Math.floor(n / 7)} weeks ago`;
}

const statusClass = (s) => ({ 'Not started': 'st-new', 'In progress': 'st-prog', Stuck: 'st-stuck', Done: 'st-done' }[s] || '');

// ---------------------------------------------------------------- list
export function renderProjects() {
  const tabs = [['active', 'Active'], ['radar', 'Radar'], ['done', 'Done']].map(([id, label]) => `
    <button class="seg-btn ${ui.projectsTab === id ? 'on' : ''}" data-action="projects-tab" data-tab-id="${id}">
      ${label} <span class="seg-count">${S.projectsIn(id).length || ''}</span></button>`).join('');

  const list = S.projectsIn(ui.projectsTab);
  let body;
  if (!list.length) {
    body = {
      active: `<p class="empty big">No active projects yet.<br>Add one and drag to set priority (#1 at the top).</p>`,
      radar: `<p class="empty big">Radar holds projects that have come up but aren't active yet.</p>`,
      done: `<p class="empty big">Finished projects show up here.</p>`,
    }[ui.projectsTab];
  } else {
    body = `<ul class="proj-list" id="proj-sort">${list.map((p, i) => projectCard(p, i)).join('')}</ul>`;
  }

  return `
    <header class="page-header"><h1>Projects</h1></header>
    <div class="view-body">
      <div class="seg">${tabs}</div>
      ${ui.projectsTab !== 'done' ? `<p class="hint">${ui.projectsTab === 'active'
        ? 'Drag ☰ to change priority. #1 is your top project.'
        : 'Next in line is at the top. Drag ☰ to reorder.'}</p>` : ''}
      ${body}
      ${ui.projectsTab !== 'done' ? `<button class="btn wide" data-action="new-project">${icon('plus')} New ${ui.projectsTab === 'radar' ? 'Radar' : ''} project</button>` : ''}
    </div>`;
}

function projectCard(p, i) {
  const prog = S.projectProgress(p.id);
  const sortable = p.state !== 'done';
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
        ${prog.total ? `<span class="proj-prog">${progressBar(prog.done / prog.total, sectionColor(p.sectionId))}<span class="pnum">${prog.done}/${prog.total}</span></span>` : ''}
        <span class="task-meta">
          ${p.state === 'done' ? `Finished ${p.completedAt ? D.formatShort(D.keyOfISO(p.completedAt)) : ''}` : `Worked on ${ago(p.lastWorkedAt)}`}
          ${p.targetDate && p.state !== 'done' ? ` · Target ${D.formatMonthDay(p.targetDate)}` : ''}
          ${nextMini ? ` · Next: ${esc(nextMini.title)} ${D.formatMonthDay(nextMini.date)}` : ''}
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
  const tasks = S.projectTasks(p.id);
  const oneOff = tasks.filter((t) => !t.repeat);
  const repeating = tasks.filter((t) => t.repeat);
  const minis = [...(p.miniGoals || [])].sort((a, b) => (a.done - b.done) || (a.date || '9999').localeCompare(b.date || '9999'));
  const statuses = S.PROJECT_STATUSES.map((s) => `
    <button class="chip ${p.status === s ? 'on' : ''} ${statusClass(s)}" data-action="project-status" data-id="${p.id}" data-status="${s}">${s}</button>`).join('');

  return `
    ${pageHeader(p.title, { backLabel: 'Projects', right: `<button class="link" data-action="edit-project" data-id="${p.id}">Edit</button>` })}
    <div class="view-body">
      <section class="card">
        <div class="kv"><span>Section</span><b><i class="swatch" style="background:${sectionColor(p.sectionId)}"></i> ${esc(S.getSection(p.sectionId)?.name || 'None')}</b></div>
        <div class="kv"><span>Target date</span><b>${p.targetDate ? `${D.formatShort(p.targetDate)} <small>(${D.countdown(D.todayKey(), p.targetDate)})</small>` : '—'}</b></div>
        <div class="kv"><span>Last worked on</span><b>${ago(p.lastWorkedAt)}</b></div>
        <div class="kv"><span>List</span><b>${{ active: 'Active', radar: 'Radar', done: 'Done' }[p.state]}</b></div>
        <div class="status-chips">${statuses}</div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Tasks ${prog.total ? `<span class="count">${prog.done}/${prog.total}</span>` : ''}</h2>
        </div>
        ${prog.total ? progressBar(prog.done / prog.total, sectionColor(p.sectionId)) : ''}
        ${oneOff.length ? `<ul class="task-list">${oneOff.map((t) => taskRow(t, t.date, { showDate: true })).join('')}</ul>` : ''}
        ${repeating.length ? `<h3 class="sub-label">${icon('repeat')} Repeating</h3>
          <ul class="task-list">${repeating.map(repeatRow).join('')}</ul>` : ''}
        <form class="inline-add" data-form="project-task" data-id="${p.id}">
          <input name="title" placeholder="Add a task" autocomplete="off">
          <input name="date" type="date" aria-label="Date (optional)" class="date-mini">
          <button class="link strong" type="submit">Add</button>
        </form>
        <button class="add-inline" data-action="project-task-full" data-id="${p.id}">${icon('repeat')} Add a repeating task or set a time…</button>
        <p class="hint left">Tap any task to change its day, time or repeat days. Dated tasks also show on your calendar.</p>
      </section>

      <section class="card">
        <h2 class="card-title">Mini goals</h2>
        ${minis.length ? `<ul class="task-list">${minis.map((m) => miniRow(m, 'project', p.id)).join('')}</ul>` : ''}
        <form class="inline-add" data-form="project-mini" data-id="${p.id}">
          <input name="title" placeholder="Add a mini goal" autocomplete="off">
          <input name="date" type="date" aria-label="Date (optional)" class="date-mini">
          <button class="link strong" type="submit">Add</button>
        </form>
      </section>

      <section class="card">
        <h2 class="card-title">Notes</h2>
        <textarea class="notes-area" data-notes="project" data-id="${p.id}" rows="6" placeholder="Ideas, links, anything…">${esc(p.notes)}</textarea>
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
    openTaskSheet({ date: D.todayKey(), defaults: { projectId: p.id, sectionId: p.sectionId } });
    return false;
  },
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
    if (m && confirm(`Delete mini goal "${m.title}"?`)) S.deleteMiniGoal(o, m.id);
    return false;
  },
};

export const projectForms = {
  'project-task': (form) => {
    const p = S.getProject(form.dataset.id);
    const title = form.title.value.trim();
    if (!p || !title) return;
    S.addTask({ title, date: form.date.value || null, projectId: p.id, sectionId: p.sectionId });
    refocus('project-task');
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
