// Lists tab: Info (things to remember) and custom Lists.

import * as S from './store.js';
import { ui, esc, icon, go, back, richText, pageHeader, makeSortable } from './ui.js';
import { openFieldsSheet } from './forms.js';

export function renderLists() {
  const tabs = [['lists', 'Lists'], ['info', 'Info']].map(([id, label]) => `
    <button class="seg-btn ${ui.listsTab === id ? 'on' : ''}" data-action="lists-tab" data-tab-id="${id}">${label}</button>`).join('');
  return `
    <header class="page-header"><h1>${ui.listsTab === 'info' ? 'Info' : 'Lists'}</h1></header>
    <div class="view-body">
      <div class="seg">${tabs}</div>
      ${ui.listsTab === 'info' ? renderInfo() : renderListIndex()}
    </div>`;
}

function renderListIndex() {
  const lists = S.getData().lists;
  return `
    ${lists.length ? `<ul class="group" id="lists-sort">${lists.map((l) => {
      const checked = l.items.filter((i) => i.checked).length;
      return `<li data-id="${l.id}"><div class="row">
        <span class="drag" aria-label="Drag to reorder">${icon('drag')}</span>
        <button class="row-btn" data-action="open-list" data-id="${l.id}">
          <span class="row-label">${esc(l.name)}</span>
          <span class="row-value">${l.checkable ? `${checked}/${l.items.length}` : l.items.length}</span>
          ${icon('chev-right')}
        </button></div></li>`;
    }).join('')}</ul>` : `<p class="empty">Make lists for anything: Restaurants, Movies, Old Addresses…</p>`}
    <button class="btn wide" data-action="new-list">${icon('plus')} New list</button>`;
}

// Info as its own page, opened from More.
export function renderInfoPage() {
  return `${pageHeader('Info', { backLabel: 'Settings' })}
    <div class="view-body">
      <p class="hint">Things you want to keep handy, like a code, a phone number or a name.</p>
      ${renderInfo()}
    </div>`;
}

function renderInfo() {
  const info = S.getData().info;
  return `
    ${info.length ? `<ul class="info-list">${info.map((i) => `
      <li><button class="info-card" data-action="edit-info" data-id="${i.id}">
        <span class="proj-title">${esc(i.title)}</span>
        ${i.body ? `<span class="info-body">${richText(i.body)}</span>` : ''}
      </button></li>`).join('')}</ul>`
      : `<p class="empty">Things to remember, like "Haircut: Stephanie, assistant manager".</p>`}
    <button class="btn wide" data-action="new-info">${icon('plus')} New info</button>`;
}

export function renderListPage(id) {
  const l = S.getList(id);
  if (!l) return pageHeader('List not found', { backLabel: 'Lists' });
  return `
    ${pageHeader(l.name, { backLabel: 'Lists', right: `<button class="link" data-action="edit-list" data-id="${l.id}">Edit</button>` })}
    <div class="view-body">
      <section class="card">
        <form class="inline-add top" data-form="list-item" data-id="${l.id}">
          <input name="text" placeholder="Add to ${esc(l.name)}" autocomplete="off">
          <button class="link strong" type="submit">Add</button>
        </form>
        ${l.items.length ? `<ul class="task-list" id="items-sort">${l.items.map((it) => `
          <li class="task ${l.checkable && it.checked ? 'done' : ''}" data-id="${it.id}" style="--c:var(--accent)">
            ${l.checkable ? `<button class="check square" data-action="item-toggle" data-list="${l.id}" data-id="${it.id}" aria-label="${it.checked ? 'Uncheck' : 'Check'}">${it.checked ? icon('check') : ''}</button>` : ''}
            <button class="task-main" data-action="edit-item" data-list="${l.id}" data-id="${it.id}">
              <span class="task-title">${esc(it.text)}</span>
              ${it.note ? `<span class="task-meta">${esc(it.note)}</span>` : ''}
            </button>
            <span class="drag" aria-label="Drag to reorder">${icon('drag')}</span>
          </li>`).join('')}</ul>` : '<p class="empty small">Nothing here yet.</p>'}
      </section>
      ${l.checkable && l.items.some((i) => i.checked) ? `<button class="btn wide" data-action="clear-checked" data-id="${l.id}">Uncheck all</button>` : ''}
    </div>`;
}

export function afterLists() {
  makeSortable(document.getElementById('lists-sort'), (ids) => S.reorderLists(ids));
  const items = document.getElementById('items-sort');
  if (items && ui.page?.type === 'list') makeSortable(items, (ids) => S.reorderListItems(ui.page.id, ids));
}

function openListForm(l) {
  openFieldsSheet({
    title: l ? 'Edit List' : 'New List',
    fields: [
      { name: 'name', label: 'List name', big: true, required: true, value: l?.name, placeholder: 'e.g. Restaurants' },
      { name: 'checkable', label: 'Show checkmarks', type: 'checkbox', value: l ? l.checkable : false },
    ],
    onSave: (v) => {
      if (l) S.updateList(l.id, { name: v.name, checkable: v.checkable });
      else { const nl = S.addList(v.name, v.checkable); go({ type: 'list', id: nl.id }); }
    },
    onDelete: l ? () => {
      if (!confirm(`Delete the list "${l.name}" and everything in it?`)) return false;
      S.deleteList(l.id);
      back();
    } : null,
    deleteLabel: 'Delete list',
  });
}

function openInfoForm(i) {
  openFieldsSheet({
    title: i ? 'Edit Info' : 'New Info',
    fields: [
      { name: 'title', label: 'Title', big: true, required: true, value: i?.title, placeholder: 'e.g. Haircut' },
      { name: 'body', label: 'Details', multiline: true, rows: 6, value: i?.body, placeholder: 'e.g. Stephanie, assistant manager' },
    ],
    onSave: (v) => { if (i) S.updateInfo(i.id, v); else S.addInfo(v); },
    onDelete: i ? () => { if (!confirm(`Delete "${i.title}"?`)) return false; S.deleteInfo(i.id); } : null,
  });
}

export const listActions = {
  'lists-tab': (el) => { ui.listsTab = el.dataset.tabId; },
  'new-list': () => { openListForm(null); return false; },
  'open-list': (el) => { ui.tab = 'lists'; go({ type: 'list', id: el.dataset.id }); return false; },
  'edit-list': (el) => { openListForm(S.getList(el.dataset.id)); return false; },
  'new-info': () => { openInfoForm(null); return false; },
  'edit-info': (el) => { openInfoForm(S.getData().info.find((x) => x.id === el.dataset.id)); return false; },
  'item-toggle': (el) => {
    const it = S.getList(el.dataset.list)?.items.find((x) => x.id === el.dataset.id);
    if (it) S.updateListItem(el.dataset.list, it.id, { checked: !it.checked });
    return false;
  },
  'edit-item': (el) => {
    const listId = el.dataset.list;
    const it = S.getList(listId)?.items.find((x) => x.id === el.dataset.id);
    if (!it) return false;
    openFieldsSheet({
      title: 'Edit Item',
      fields: [
        { name: 'text', label: 'Item', big: true, required: true, value: it.text },
        { name: 'note', label: 'Short note', multiline: true, rows: 3, value: it.note },
      ],
      onSave: (v) => S.updateListItem(listId, it.id, v),
      onDelete: () => { if (!confirm(`Delete "${it.text}"?`)) return false; S.deleteListItem(listId, it.id); },
    });
    return false;
  },
  'clear-checked': (el) => {
    const l = S.getList(el.dataset.id);
    l.items.forEach((i) => { i.checked = false; });
    S.save();
    return false;
  },
};

export const listForms = {
  'list-item': (form) => {
    const text = form.text.value.trim();
    if (text) S.addListItem(form.dataset.id, text);
    setTimeout(() => document.querySelector('[data-form="list-item"] input')?.focus(), 0);
  },
};
