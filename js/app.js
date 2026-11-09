// The app's "switchboard": decides which screen to draw and passes each
// tap to the right screen's code.

import * as D from './dates.js';
import * as S from './store.js';
import { ui, hooks, $, back, closeSheet } from './ui.js';
import { openAddSheet } from './forms.js';
import { renderHome, afterHome, homeActions, homeForms } from './home.js';
import { renderProjects, renderProjectPage, afterProjects, afterProjectPage, projectActions, projectForms } from './projects.js';
import { renderGoals, renderYearlyPage, renderQuarterlyPage, renderQuarterPlan, goalActions, goalForms, afterGoals } from './goals.js';
import { renderLists, renderListPage, renderInfoPage, afterLists, listActions, listForms } from './lists.js';
import { startScene, paintScene } from './scene.js';
import { startKU } from './ku.js';
import { renderMore, renderPlanning, renderHistory, renderPushed, renderRepeating, moreActions, moreForms } from './more.js';

const actions = {
  ...homeActions, ...projectActions, ...goalActions, ...listActions, ...moreActions,
  back: () => { back(); return false; },
  'reorder-toggle': () => { ui.reorder = !ui.reorder; },
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
const forms = { ...homeForms, ...projectForms, ...goalForms, ...listForms, ...moreForms };

// ---------------------------------------------------------------- drawing
function renderPage(p) {
  switch (p.type) {
    case 'project': return renderProjectPage(p.id);
    case 'yearly': return renderYearlyPage(p.id);
    case 'quarterly': return renderQuarterlyPage(p.id);
    case 'quarter-plan': return renderQuarterPlan(p.year, p.q);
    case 'list': return renderListPage(p.id);
    case 'info': return renderInfoPage();
    case 'planning': return renderPlanning();
    case 'history': return renderHistory();
    case 'pushed': return renderPushed();
    case 'repeating': return renderRepeating();
    default: return '';
  }
}

function render() {
  const main = $('#main');
  document.body.classList.toggle('reordering', Boolean(ui.reorder));
  const y = window.scrollY;
  if (ui.page) main.innerHTML = renderPage(ui.page);
  else if (ui.tab === 'home') main.innerHTML = renderHome();
  else if (ui.tab === 'projects') main.innerHTML = renderProjects();
  else if (ui.tab === 'goals') main.innerHTML = renderGoals();
  else if (ui.tab === 'lists') main.innerHTML = renderLists();
  else main.innerHTML = renderMore();
  window.scrollTo(0, y);
  // The + button (Task / Event / Recurring) is only for the Planner tab.
  document.body.classList.toggle('no-fab', ui.tab !== 'home');

  if (!ui.page && ui.tab === 'home') afterHome();
  if (!ui.page && ui.tab === 'projects') afterProjects();
  if (ui.page?.type === 'project') afterProjectPage();
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
  // Tapping anywhere on an add bar starts typing in it
  const bar = e.target.closest('.add-bar');
  if (bar && !e.target.closest('button, input')) { bar.querySelector('input')?.focus(); return; }
  const el = e.target.closest('[data-action], [data-tab]');
  if (!el) return;

  if (el.dataset.tab) {
    // Tapping the tab you're already on goes back to its main screen
    ui.tab = el.dataset.tab;
    ui.page = null;
    ui.reorder = false;
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
// Daily reflection answers save as you type, and the boxes grow to fit
document.addEventListener('input', (e) => {
  const ta = e.target.closest('[data-reflect]');
  if (!ta) return;
  S.setReflection(ta.dataset.reflect, ta.dataset.field, ta.value);
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 2 + 'px';
});

document.addEventListener('change', (e) => {
  const ta = e.target.closest('[data-notes]');
  if (ta) S.updateProject(ta.dataset.id, { notes: ta.value }, { worked: true });
});

// Ideas bar: Return saves (Shift+Return for a new line), and the box grows to fit
document.addEventListener('keydown', (e) => {
  const ta = e.target.closest('[data-form="idea-add"] textarea');
  if (ta && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.form.requestSubmit(); }
});
document.addEventListener('input', (e) => {
  const ta = e.target.closest('[data-form="idea-add"] textarea');
  if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
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
startScene();
startKU();

// Ask the device to keep our data (not clear it when storage runs low).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// Offline support, plus updates: every time the app comes back on screen it
// checks for a newer version, and if there is one it reloads to show it.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    })
    .catch(() => {}));
  const hadVersion = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadVersion || reloading) return;
    reloading = true;
    location.reload();
  });
}
