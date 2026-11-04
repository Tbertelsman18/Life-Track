// The app's "switchboard": decides which screen to draw and passes each
// tap to the right screen's code.

import * as D from './dates.js';
import * as S from './store.js';
import { ui, hooks, $, back, closeSheet } from './ui.js';
import { openAddSheet } from './forms.js';
import { renderHome, afterHome, homeActions, homeForms } from './home.js';
import { renderProjects, renderProjectPage, afterProjects, projectActions, projectForms } from './projects.js';
import { renderGoals, renderYearlyPage, renderQuarterlyPage, renderQuarterPlan, goalActions, goalForms, afterGoals } from './goals.js';
import { renderLists, renderListPage, afterLists, listActions, listForms } from './lists.js';
import { renderMore, renderPlanning, renderHistory, renderPushed, moreActions } from './more.js';

const actions = {
  ...homeActions, ...projectActions, ...goalActions, ...listActions, ...moreActions,
  back: () => { back(); return false; },
  'close-sheet': () => { closeSheet(); return false; },
  add: () => {
    const p = ui.page;
    const defaults = {};
    if (p?.type === 'project') defaults.projectId = p.id;
    if (p?.type === 'quarterly' || p?.type === 'yearly') defaults.goalId = p.id;
    const date = ui.tab === 'home' && !p ? ui.date : (p?.type === 'project' ? null : D.todayKey());
    openAddSheet({ date, defaults });
    return false;
  },
};
const forms = { ...homeForms, ...projectForms, ...goalForms, ...listForms };

// ---------------------------------------------------------------- drawing
function renderPage(p) {
  switch (p.type) {
    case 'project': return renderProjectPage(p.id);
    case 'yearly': return renderYearlyPage(p.id);
    case 'quarterly': return renderQuarterlyPage(p.id);
    case 'quarter-plan': return renderQuarterPlan(p.year, p.q);
    case 'list': return renderListPage(p.id);
    case 'planning': return renderPlanning();
    case 'history': return renderHistory();
    case 'pushed': return renderPushed();
    default: return '';
  }
}

function render() {
  const main = $('#main');
  const y = window.scrollY;
  if (ui.page) main.innerHTML = renderPage(ui.page);
  else if (ui.tab === 'home') main.innerHTML = renderHome();
  else if (ui.tab === 'projects') main.innerHTML = renderProjects();
  else if (ui.tab === 'goals') main.innerHTML = renderGoals();
  else if (ui.tab === 'lists') main.innerHTML = renderLists();
  else main.innerHTML = renderMore();
  window.scrollTo(0, y);

  if (!ui.page && ui.tab === 'home') afterHome();
  if (!ui.page && ui.tab === 'projects') afterProjects();
  if (ui.tab === 'lists') afterLists();
  if (ui.page?.type === 'yearly') afterGoals();

  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === ui.tab);
    b.setAttribute('aria-current', b.dataset.tab === ui.tab ? 'page' : 'false');
  });
}

hooks.render = render;
S.subscribe(render);

// ---------------------------------------------------------------- taps
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-tab]');
  if (!el) return;

  if (el.dataset.tab) {
    // Tapping the tab you're already on goes back to its main screen
    ui.tab = el.dataset.tab;
    ui.page = null;
    if (ui.tab === 'home' && ui.view === 'day' && !el.classList.contains('active')) ui.checkEdit = false;
    render();
    window.scrollTo(0, 0);
    return;
  }

  const fn = actions[el.dataset.action];
  if (!fn) return;
  e.preventDefault();
  if (fn(el, e) !== false) render();
});

// Inline "add" forms (e.g. add a list item)
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form]?.(form);
});

// Notes boxes save as you type
let notesTimer;
document.addEventListener('input', (e) => {
  const ta = e.target.closest('[data-notes]');
  if (!ta) return;
  const p = S.getProject(ta.dataset.id);
  if (!p) return;
  p.notes = ta.value;
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => S.saveQuietly(), 400);
});
// End-of-day review note saves as you type
document.addEventListener('input', (e) => {
  const ta = e.target.closest('[data-gnote]');
  if (ta) S.setGradeNote(ta.dataset.gnote, ta.value);
});

document.addEventListener('change', (e) => {
  const ta = e.target.closest('[data-notes]');
  if (ta) S.updateProject(ta.dataset.id, { notes: ta.value }, { worked: true });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
});

// If the app stays open past midnight, keep "today" correct.
let lastToday = D.todayKey();
function checkNewDay() {
  const t = D.todayKey();
  if (t !== lastToday) {
    if (ui.date === lastToday) ui.date = t;
    lastToday = t;
    render();
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
setInterval(checkNewDay, 60 * 1000);

// ---------------------------------------------------------------- start
render();

// Ask the device to keep our data (not clear it when storage runs low).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// Offline support
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
