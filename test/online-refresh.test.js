const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

// Run the real click wiring without starting Electron or contacting either provider.
const renderer = readFileSync(join(__dirname, '../src/renderer.js'), 'utf8')
  .replace(/\ninit\(\);\s*$/, '\n');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const elements = new Map();
  const requests = [];
  const saves = [];
  const messages = [];
  const confirmation = deferred();
  const A = { id: 'A', notemsKey: 'alpha', body: 'local A' };
  const B = { id: 'B', getnoteKey: 'beta', body: 'local B' };
  const store = { notes: [A, B], reminders: [], selectedId: A.id };
  let displayed = A.body;
  let nextRequest;
  function getElementById(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        addEventListener(type, fn) { this[type] = fn; },
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {} },
      });
    }
    return elements.get(id);
  }
  const request = service => key => {
    const pending = deferred();
    requests.push({ service, key, ...pending });
    nextRequest?.(pending);
    nextRequest = null;
    return pending.promise;
  };
  const context = vm.createContext({
    document: { getElementById, addEventListener() {} },
    window: {
      addEventListener() {},
      electronAPI: {
        getNotemsContent: request('notems'),
        getGetnoteContent: request('getnote'),
        saveData: async data => { saves.push(structuredClone(data)); },
      },
    },
    MarkdownEditor: { setContent(_, body) { displayed = body; } },
    store,
    confirm: () => confirmation.promise,
    notify: text => messages.push(text),
  });
  vm.runInContext(renderer + `
    state = store;
    showConfirm = confirm;
    showToast = showToastMessage = notify;
    scheduleSave = () => window.electronAPI.saveData({ notes: state.notes });
    updateCharCount = () => {};
    setupEditor();
  `, context);
  const button = getElementById('btn-refresh-notems');
  function select(note) {
    store.selectedId = note.id;
    displayed = note.body;
    // Older renderer versions used data attributes from the shared button.
    button.dataset.key = note.notemsKey || note.getnoteKey;
    button.dataset.service = note.notemsKey ? 'notems' : 'getnote';
    vm.runInContext('if (typeof updateOnlineRefreshButton === "function") updateOnlineRefreshButton(state.notes.find(n => n.id === state.selectedId))', context);
  }
  select(A);
  return {
    A, B, store, button, select, requests, saves, messages, confirmation,
    get displayed() { return displayed; },
    waitForRequest: () => new Promise(resolve => { nextRequest = resolve; }),
  };
}

test('delayed response updates the original note, not the newly selected one', async () => {
  const h = setup();
  const done = h.button.click();
  const requested = h.waitForRequest();
  h.confirmation.resolve(true);
  const request = await requested;
  h.select(h.B);
  request.resolve('remote A');
  await done;

  assert.equal(h.B.body, 'local B');
  assert.equal(h.displayed, 'local B');
  assert.equal(h.A.body, 'remote A');
  assert.deepEqual(h.saves[0].notes.map(n => n.body), ['remote A', 'local B']);
});

test('changing selection while confirming does not change the provider or key', async () => {
  const h = setup();
  const done = h.button.click();
  h.select(h.B);
  const requested = h.waitForRequest();
  h.confirmation.resolve(true);
  const request = await requested;
  assert.equal(h.requests[0].service, 'notems');
  assert.equal(h.requests[0].key, 'alpha');
  request.resolve('remote A');
  await done;
  assert.equal(h.displayed, 'local B');
});

test('editing, deleting or relinking the target during refresh discards the reply', async t => {
  for (const [name, change] of [
    ['edit', h => { h.A.body = 'new draft'; }],
    ['delete', h => { h.store.notes = [h.B]; }],
    ['relink', h => { h.A.notemsKey = 'other'; }],
  ]) {
    await t.test(name, async () => {
      const h = setup();
      const done = h.button.click();
      const requested = h.waitForRequest();
      h.confirmation.resolve(true);
      const request = await requested;
      change(h);
      request.resolve('stale remote A');
      await done;

      assert.equal(h.A.body, name === 'edit' ? 'new draft' : 'local A');
      assert.equal(h.B.body, 'local B');
      assert.equal(h.saves.length, 0);
      assert.equal(h.messages.length, 1);
    });
  }
});

test('getnote refreshes the visible editor and coalesces duplicate clicks', async () => {
  const h = setup();
  h.select(h.B);
  const done = h.button.click();
  assert.equal(h.button.disabled, true);
  await h.button.click();
  const requested = h.waitForRequest();
  h.confirmation.resolve(true);
  const request = await requested;
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].service, 'getnote');
  assert.equal(h.requests[0].key, 'beta');
  request.resolve('remote B');
  await done;

  assert.equal(h.button.disabled, false);
  assert.equal(h.displayed, 'remote B');
  assert.equal(h.saves[0].notes[1].body, 'remote B');
});

test('a rejected fetch leaves the draft untouched and releases the button', async () => {
  const h = setup();
  const done = h.button.click();
  const requested = h.waitForRequest();
  h.confirmation.resolve(true);
  const request = await requested;
  request.reject(new Error('offline'));
  await done;

  assert.equal(h.A.body, 'local A');
  assert.equal(h.saves.length, 0);
  assert.equal(h.button.disabled, false);
  assert.match(h.messages[0], /offline/);
});

test('cancel does not fetch or save', async () => {
  const h = setup();
  const done = h.button.click();
  h.confirmation.resolve(false);
  await done;
  assert.equal(h.requests.length, 0);
  assert.equal(h.saves.length, 0);
  assert.equal(h.button.disabled, false);
});
