// More tab: Sunday Planning, History, Most Pushed Off, Sections, Settings, Backup.

import * as D from './dates.js';
import * as S from './store.js';
import { ui, esc, icon, go, pct, progressBar, sectionColor, pageHeader, toast } from './ui.js';
import { openSectionSheet, openTaskSheet, openIdeaSheet } from './forms.js';
import { taskRow, forecastList } from './home.js';

// Shown at the bottom of More, so you can tell which version is loaded.
export const APP_VERSION = '1.27 (Nov 8)';

// ---------------------------------------------------------------- menu
export function renderMore() {
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

  const lb = data.settings.lastBackup;
  const lbDays = lb ? D.daysBetween(D.keyOfISO(lb), D.todayKey()) : null;
  const backupNote = lb ? `Last backup: ${lbDays === 0 ? 'today' : lbDays === 1 ? 'yesterday' : `${lbDays} days ago`}` : 'No backup yet';

  return `
    <header class="page-header"><h1>More</h1></header>
    <div class="view-body">
      <h3 class="group-label first">Backup</h3>
      <ul class="group">
        <li><button class="row" data-action="export">${icon('share')}<span class="row-label">Back up to Files</span>
          <span class="row-value ${lbDays === null || lbDays > 7 ? 'warn' : ''}">${backupNote}</span></button></li>
        <li><button class="row" data-action="import">${icon('download')}<span class="row-label">Import backup</span></button></li>
      </ul>
      <p class="hint">Saves a backup file. Choose <b>Save to Files</b> and pick iCloud Drive to keep it safe.
      Import replaces everything in the app with the backup you choose.</p>

      <h3 class="group-label">Plan &amp; review</h3>
      <ul class="group">
        <li><button class="row" data-action="open-planning">${icon('calendar')}<span class="row-label">Sunday Planning</span>${icon('chev-right')}</button></li>
        <li><button class="row" data-action="open-history">${icon('chart')}<span class="row-label">History</span>${icon('chev-right')}</button></li>
        <li><button class="row" data-action="open-repeating">${icon('repeat')}<span class="row-label">Repeating tasks</span>
          <span class="row-value">${S.repeatingTasks().length}</span>${icon('chev-right')}</button></li>
        <li><button class="row" data-action="open-ideas">${icon('sun')}<span class="row-label">Ideas</span>
          <span class="row-value">${data.ideas.length}</span>${icon('chev-right')}</button></li>
        <li><button class="row" data-action="open-info">${icon('info')}<span class="row-label">Info</span>
          <span class="row-value">${data.info.length}</span>${icon('chev-right')}</button></li>
        <li><button class="row" data-action="open-pushed">${icon('turtle')}<span class="row-label">Pushed off &amp; not completed</span>${icon('chev-right')}</button></li>
      </ul>

      <h3 class="group-label">Sections</h3>
      <ul class="group">${sections}
        <li><button class="row accent" data-action="add-section">${icon('plus')}<span class="row-label">Add section</span></button></li>
      </ul>

      <h3 class="group-label">Settings</h3>
      <div class="group pad">
        <div class="setting-label">Default view when the app opens</div>
        <div class="seg">${viewSeg}</div>
      </div>
      <ul class="group">
        <li><button class="row" data-action="edit-daily-check">${icon('check')}<span class="row-label">Recurring tasks</span>
          <span class="row-value">${data.dailyCheck.items.length}</span>${icon('chev-right')}</button></li>
      </ul>

      <p class="hint center">Life Tracker · version ${APP_VERSION}<br>${data.tasks.length} tasks · ${data.events.length} events · ${data.projects.length} projects</p>
    </div>`;
}

// ---------------------------------------------------------------- Sunday planning
export function renderPlanning() {
  const today = D.todayKey();
  const start = D.startOfWeek(today);
  const weeks = [0, 1, 2, 3].map((w) => D.addDays(start, w * 7));

  const grid = weeks.map((ws) => `
    <div class="plan-week">
      <div class="plan-wlabel">${D.formatMonthDay(ws)}</div>
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const k = D.addDays(ws, i);
        const tasks = S.tasksOn(k).filter((t) => !S.isDoneOn(t, k));
        const evs = S.eventsOn(k);
        const blocked = S.blockingEventsOn(k).length > 0;
        return `<button class="plan-day ${k === today ? 'today' : ''} ${k < today ? 'past' : ''} ${blocked ? 'blocked' : ''}" data-action="open-day" data-date="${k}">
          <span class="pd-num">${D.fromKey(k).getDate()}</span>
          ${evs.length ? `<span class="pd-ev" style="--c:${sectionColor(evs[0].sectionId)}">${esc(evs[0].title)}</span>` : ''}
          ${tasks.length ? `<span class="pd-count">${tasks.length}</span>` : ''}
        </button>`;
      }).join('')}
    </div>`).join('');

  const pushed = S.pushedLastWeek(today);
  const unscheduled = S.unscheduledTasks().filter((t) => !t.done);

  // Everything coming up in the next 4 weeks (ignores lead times)
  const end = D.addDays(today, 28);
  const upcoming = S.getData().events
    .filter((e) => S.eventLast(e) >= today && e.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ kind: 'event', id: e.id, title: e.title, date: e.date, endDate: e.endDate, time: e.time,
      sectionId: e.sectionId, when: e.date <= today ? 'Now' : D.countdown(today, e.date) }));
  const reminders = S.goalReminders(today);

  const cur = D.quarterOf(today);
  const qGoals = S.quarterlyFor(cur.year, cur.q);
  const thisWeek = D.startOfWeek(today);
  const goalRows = qGoals.map((g) => {
    const p = S.quarterlyProgress(g);
    const tgt = (g.targets || []).map((t) => {
      const n = S.targetCount(t, thisWeek);
      return `<span class="tchip ${n >= t.perWeek ? 'hit' : ''}">${esc(t.label)} ${n}/${t.perWeek}</span>`;
    }).join('');
    return `<li><button class="q-row" data-action="open-goal" data-id="${g.id}">
      <span class="q-row-top"><span class="proj-title">${esc(g.title)}</span><span class="pnum">${pct(p)}</span></span>
      ${p !== null ? progressBar(p) : ''}
      ${tgt ? `<span class="tchips">${tgt}</span>` : ''}
    </button></li>`;
  }).join('');

  const projects = S.projectsIn('active').slice(0, 3);

  return `
    ${pageHeader('Sunday Planning', { backLabel: 'More' })}
    <div class="view-body">
      <button class="btn wide primary" data-action="plan-next-week">${icon('calendar')} Plan next week day by day</button>
      <section class="card">
        <h2 class="card-title">Next 4 weeks</h2>
        <div class="plan-head">${D.WEEK_ORDER.map((w) => `<span>${D.DAY_NAMES[w][0]}</span>`).join('')}</div>
        <div class="plan-grid">${grid}</div>
        <p class="hint left">Numbers are open tasks. Tap a day to open it.</p>
      </section>

      <section class="card">
        <h2 class="card-title">Pushed off last week <span class="count">${pushed.length}</span></h2>
        ${pushed.length ? `<ul class="task-list">${pushed.map((t) => taskRow(t, t.date, { showDate: true })).join('')}</ul>`
          : '<p class="empty small">Nothing was pushed off. Nice.</p>'}
      </section>

      ${unscheduled.length ? `<section class="card">
        <h2 class="card-title">Unscheduled <span class="count">${unscheduled.length}</span></h2>
        <ul class="task-list">${unscheduled.map((t) => taskRow(t, null)).join('')}</ul>
        <p class="hint left">Tap one to give it a day.</p>
      </section>` : ''}

      <section class="card">
        <h2 class="card-title">Coming up</h2>
        ${upcoming.length || reminders.length ? forecastList([...reminders, ...upcoming]) : '<p class="empty small">No events in the next 4 weeks.</p>'}
      </section>

      ${S.GOALS_ON ? `<section class="card">
        <h2 class="card-title">${D.quarterLabel(cur.year, cur.q)} goals</h2>
        ${qGoals.length ? `<ul class="plain-list">${goalRows}</ul>` : `<p class="empty small">No goals set for this quarter.</p>
          <button class="btn wide" data-action="plan-quarter" data-year="${cur.year}" data-q="${cur.q}">Set Q${cur.q} goals</button>`}
      </section>` : ''}

      ${projects.length ? `<section class="card">
        <h2 class="card-title">Top projects</h2>
        <ul class="plain-list">${projects.map((p, i) => {
          const pr = S.projectProgress(p.id);
          const next = S.projectTasks(p.id).find((t) => !t.done);
          return `<li><button class="q-row" data-action="open-project" data-id="${p.id}">
            <span class="q-row-top"><span class="proj-title">#${i + 1} ${esc(p.title)}</span><span class="pnum">${pr.total ? `${pr.done}/${pr.total}` : ''}</span></span>
            <span class="task-meta">${esc(p.status)}${next ? ` · Next: ${esc(next.title)}${next.date ? '' : ' (no date)'}` : ''}</span>
          </button></li>`;
        }).join('')}</ul>
      </section>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- history
export function renderHistory() {
  const today = D.todayKey();
  const thisWeek = D.startOfWeek(today);
  const weeks = Array.from({ length: 8 }, (_, i) => D.addDays(thisWeek, (i - 7) * 7));
  const all = S.completions();
  const inWeek = (ws) => all.filter((c) => c.date >= ws && c.date <= D.addDays(ws, 6));
  const counts = weeks.map((ws) => inWeek(ws).length);
  const sel = ui.historyWeek && weeks.includes(ui.historyWeek) ? ui.historyWeek : thisWeek;
  const max = Math.max(1, ...counts);

  // Bar chart (one series: tasks completed per week)
  const W = 320, H = 150, padB = 22, padT = 18, gap = 10;
  const bw = (W - gap * (weeks.length - 1)) / weeks.length;
  const bars = weeks.map((ws, i) => {
    const h = Math.round(((H - padB - padT) * counts[i]) / max);
    const x = i * (bw + gap);
    const y = H - padB - h;
    const on = ws === sel;
    const r = Math.min(4, h / 2);
    const path = h > 0
      ? `M${x},${H - padB} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${H - padB} Z`
      : '';
    return `<g class="hbar ${on ? 'on' : ''}" data-action="history-week" data-week="${ws}" role="button" tabindex="0"
        aria-label="Week of ${D.formatMonthDay(ws)}: ${counts[i]} completed">
      <rect x="${x - gap / 2}" y="0" width="${bw + gap}" height="${H}" fill="transparent"/>
      ${path ? `<path d="${path}"/>` : `<rect x="${x}" y="${H - padB - 2}" width="${bw}" height="2" class="zero"/>`}
      ${counts[i] && (on || counts[i] === max) ? `<text x="${x + bw / 2}" y="${y - 5}" class="hval">${counts[i]}</text>` : ''}
      <text x="${x + bw / 2}" y="${H - 6}" class="hlab">${i === weeks.length - 1 ? 'Now' : D.formatMonthDay(ws).split(' ')[1]}</text>
    </g>`;
  }).join('');

  const by = ui.historyBy;
  const groups = new Map();
  for (const c of inWeek(sel)) {
    let key, label, color;
    if (by === 'section') {
      const s = S.getSection(c.task.sectionId);
      key = s?.id || 'none'; label = s?.name || 'No section'; color = s?.color || 'var(--muted)';
    } else if (by === 'project') {
      const p = c.task.projectId && S.getProject(c.task.projectId);
      key = p?.id || 'none'; label = p?.title || 'No project'; color = p ? sectionColor(p.sectionId) : 'var(--muted)';
    } else {
      const g = S.resolveGoal(c.task.goalId);
      const y = g?.yearly;
      key = y?.id || 'none'; label = y?.title || 'No goal'; color = y ? 'var(--accent)' : 'var(--muted)';
    }
    const cur = groups.get(key) || { label, color, n: 0, none: key === 'none' };
    cur.n++;
    groups.set(key, cur);
  }
  const rows = [...groups.values()].sort((a, b) => (a.none - b.none) || b.n - a.n);
  const rmax = Math.max(1, ...rows.map((r) => r.n));
  const bySeg = [['section', 'Section'], ['project', 'Project'], ...(S.GOALS_ON ? [['goal', 'Goal']] : [])].map(([id, l]) => `
    <button class="seg-btn ${by === id ? 'on' : ''}" data-action="history-by" data-by="${id}">${l}</button>`).join('');

  const total = counts.reduce((a, b) => a + b, 0);
  const avg = Math.round((total / weeks.length) * 10) / 10;

  return `
    ${pageHeader('History', { backLabel: 'More' })}
    <div class="view-body">
      <section class="card">
        <h2 class="card-title">Tasks completed per week</h2>
        <div class="stat-row">
          <div><b>${inWeek(thisWeek).length}</b><span>this week</span></div>
          <div><b>${avg}</b><span>weekly average</span></div>
          <div><b>${total}</b><span>last 8 weeks</span></div>
        </div>
        <svg class="hchart" viewBox="0 -4 ${W} ${H + 4}" role="img" aria-label="Bar chart of tasks completed in each of the last 8 weeks">${bars}</svg>
        <p class="hint left">Tap a bar to see that week.</p>
      </section>

      <section class="card">
        <h2 class="card-title">Week of ${D.formatMonthDay(sel)} · ${inWeek(sel).length} done</h2>
        <div class="seg small">${bySeg}</div>
        ${rows.length ? `<ul class="hbreak">${rows.map((r) => `
          <li><span class="hb-label"><i class="swatch" style="background:${r.color}"></i>${esc(r.label)}</span>
            <span class="hb-track"><i style="width:${Math.round((r.n / rmax) * 100)}%;background:${r.color}"></i></span>
            <b>${r.n}</b></li>`).join('')}</ul>` : '<p class="empty small">Nothing completed this week.</p>'}
      </section>

      ${gradeSummary()}

      <section class="card">
        <h2 class="card-title">Most pushed off</h2>
        ${pushedList(5)}
        <button class="add-inline" data-action="open-pushed">See all</button>
      </section>
    </div>`;
}

// Self-grades: last 7 days' average per category, with a 14-day strip.
function gradeSummary() {
  const today = D.todayKey();
  const cats = S.gradeCategories(today);
  const days = Array.from({ length: 14 }, (_, i) => D.addDays(today, i - 13));
  const any = days.some((k) => Object.keys(S.getGrade(k).scores).length);
  if (!any) return '';
  return `<section class="card">
    <h2 class="card-title">Self-grades · last 14 days</h2>
    <ul class="grade-sum">${cats.map((c) => {
      const avg = S.gradeAverage(c.id, 7);
      return `<li><span class="gs-name">${esc(c.label)}</span>
        <span class="gs-dots">${days.map((k) => { const v = S.getGrade(k).scores[c.id] || 0;
          return `<i class="g${v}" title="${D.formatShort(k)}: ${v ? S.GRADE_LABELS[v] : 'not graded'}"></i>`; }).join('')}</span>
        <b>${avg ? avg.toFixed(1) : '–'}</b></li>`;
    }).join('')}</ul>
    <p class="hint left">Darker = higher grade. Number = this week's average (out of 5).</p>
  </section>`;
}

function pushedList(limit) {
  const list = S.mostPushed(limit);
  if (!list.length) return '<p class="empty small">Nothing pushed off yet. When you move a task to a later day, it shows up here.</p>';
  return `<ul class="pushed-list">${list.map((g, i) => `
    <li><span class="rank">${i + 1}</span>
      <i class="swatch" style="background:${sectionColor(g.sectionId)}"></i>
      <button class="row-btn" data-action="edit" data-id="${g.ids[g.ids.length - 1]}"><span class="row-label">${esc(g.title)}</span></button>
      <b class="pushed">${g.count}×</b></li>`).join('')}</ul>`;
}

// Every repeating task in one place, with one-tap day changes.
export function renderRepeating() {
  const list = S.repeatingTasks();
  return `
    ${pageHeader('Repeating tasks', { backLabel: 'More' })}
    <div class="view-body">
      <p class="hint">Everything that repeats, like "Film weekly video" every Tuesday. Tap a day to turn it on or off. Tap the name to change the time or anything else.</p>
      ${list.length ? list.map((t) => {
        const p = t.projectId && S.getProject(t.projectId);
        const g = S.GOALS_ON ? S.resolveGoal(t.goalId) : null;
        const where = [p ? `${icon('folder')} ${esc(p.title)}` : '', g ? `${icon('target')} ${esc(g.target ? g.target.label : (g.quarterly || g.yearly)?.title)}` : ''].filter(Boolean).join(' · ');
        return `<section class="card rep-card" style="--c:${sectionColor(t.sectionId)}">
          <button class="rep-head" data-action="edit" data-id="${t.id}">
            <span class="swatch" style="background:var(--c)"></span>
            <span class="task-main-inner"><span class="task-title">${esc(t.title)}</span>
              <span class="task-meta">${t.time ? D.formatTime(t.time) : 'Any time'}${where ? ' · ' + where : ''}</span></span>
            ${icon('chev-right')}
          </button>
          <div class="sched-days">${D.WEEK_ORDER.map((d) => `<button class="chip ${t.repeat.days.includes(d) ? 'on' : ''}" data-action="repeat-day" data-id="${t.id}" data-day="${d}" aria-pressed="${t.repeat.days.includes(d)}">${D.DAY_NAMES[d].slice(0, 2)}</button>`).join('')}</div>
        </section>`;
      }).join('') : '<p class="empty">No repeating tasks yet. When you add a task, pick days under "Repeat on".</p>'}
      <button class="btn wide" data-action="new-repeating">${icon('plus')} New repeating task</button>
    </div>`;
}

export function renderPushed() {
  const missed = S.missedTasks(30);
  return `
    ${pageHeader('Pushed off & not completed', { backLabel: 'More' })}
    <div class="view-body">
      <section class="card">
        <h2 class="card-title">Not completed · last 30 days <span class="count">${missed.length}</span></h2>
        ${missed.length ? `<ul class="task-list">${missed.map((t) => `
          <li class="task" style="--c:${sectionColor(t.sectionId)}">
            <span class="swatch" style="background:var(--c)"></span>
            <span class="task-main static"><span class="task-title">${esc(t.title)}</span>
              <span class="task-meta">Planned ${esc(D.formatShort(t.date))}${S.getSection(t.sectionId) ? ' · ' + esc(S.getSection(t.sectionId).name) : ''}</span></span>
            <button class="link small" data-action="missed-undo" data-id="${t.id}">Put back</button>
          </li>`).join('')}</ul>`
        : '<p class="empty small">Nothing marked not completed.</p>'}
        <p class="hint left">"Put back" moves it to today.</p>
      </section>
      <h3 class="group-label">Most pushed off</h3>
      <p class="hint">What you move to a later day most often. These might need a better time, a smaller first step, or to be dropped.</p>
      <section class="card">${pushedList(30)}</section>
    </div>`;
}

export function renderIdeas() {
  const ideas = S.getData().ideas;
  return `
    ${pageHeader('Ideas', { backLabel: 'More' })}
    <div class="view-body">
      <button class="btn wide primary" data-action="new-idea">${icon('plus')} New idea</button>
      ${ideas.length ? `<ul class="info-list">${ideas.map((i) => `
        <li><button class="info-card" data-action="edit-idea" data-id="${i.id}">
          <span class="info-body">${esc(i.text)}</span>
          <span class="task-meta">${esc(D.formatShort(D.keyOfISO(i.createdAt)))}</span>
        </button></li>`).join('')}</ul>`
      : '<p class="empty">Ideas that pop into your head. Add one here, or with <b>+ → Idea</b>.</p>'}
    </div>`;
}

// ---------------------------------------------------------------- backup
export async function doExport() {
  const json = S.exportJSON();
  const name = S.backupFileName();
  const file = new File([json], name, { type: 'application/json' });
  const done = () => { S.setSetting('lastBackup', new Date().toISOString()); toast('Backup saved'); };
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Life Tracker backup' });
      done();
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
  done();
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

export const moreActions = {
  'open-planning': () => { ui.tab = 'more'; go({ type: 'planning' }); return false; },
  'open-ideas': () => { ui.tab = 'more'; go({ type: 'ideas' }); return false; },
  'new-idea': () => { openIdeaSheet(); return false; },
  'edit-idea': (el) => { openIdeaSheet({ id: el.dataset.id }); return false; },
  'missed-undo': (el) => { S.unmarkMissed(el.dataset.id); toast('Moved to today'); return false; },
  'open-info': () => { ui.tab = 'more'; go({ type: 'info' }); return false; },
  'open-history': () => { ui.tab = 'more'; go({ type: 'history' }); return false; },
  'open-repeating': () => { ui.tab = 'more'; go({ type: 'repeating' }); return false; },
  'repeat-day': (el) => { S.toggleRepeatDay(el.dataset.id, Number(el.dataset.day)); return false; },
  'new-repeating': () => { openTaskSheet({ date: D.todayKey(), defaults: { repeat: { days: [D.weekday(D.todayKey())], until: null, doneDates: {}, skips: [] } } }); return false; },
  'open-pushed': () => { ui.tab = 'more'; go({ type: 'pushed', parent: ui.page }); return false; },
  'history-week': (el) => { ui.historyWeek = el.dataset.week; },
  'history-by': (el) => { ui.historyBy = el.dataset.by; },
  'edit-section': (el) => { openSectionSheet(el.dataset.id); return false; },
  'add-section': () => { openSectionSheet(null); return false; },
  'set-default-view': (el) => { S.setSetting('defaultView', el.dataset.view); return false; },
  'edit-daily-check': () => { ui.tab = 'home'; ui.page = null; ui.view = 'day'; ui.date = D.todayKey(); ui.checkEdit = true; },
  export: () => { doExport(); return false; },
  import: () => { doImport(); return false; },
};
