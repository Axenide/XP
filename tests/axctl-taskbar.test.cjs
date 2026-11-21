const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function setup({ host = true, authority = true, windowMode = false, call } = {}) {
  const listeners = new Map();
  const updates = [];
  const calls = [];
  const applicationUpdates = [];
  const unavailableCatalogs = [];
  const window = {
    axtml: host
      ? {
          call(...args) {
            calls.push(args);
            return call ? call(...args) : Promise.resolve({});
          },
        }
      : undefined,
    __axtmlWindowMode: windowMode,
    XPShellSync: {
      isAuthority: authority,
      setExternalWindows(windows) { updates.push(windows); },
    },
    XPStartMenuApps: {
      init() {},
      setApplications(applications) { applicationUpdates.push(applications); },
      setUnavailable() { unavailableCatalogs.push(true); },
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  const document = { body: { dataset: { axWindowClass: 'axtml-nostyle' } } };
  const context = vm.createContext({
    document,
    window,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(readFileSync(require.resolve('../js/axctl-taskbar.js'), 'utf8'), context);
  return {
    adapter: window.XPAxctlTaskbar,
    applicationUpdates,
    calls,
    listeners,
    unavailableCatalogs,
    updates,
    window,
  };
}

test('web-only and non-authority views do not initialize axctl', () => {
  const web = setup({ host: false });
  web.adapter.init();
  assert.equal(web.adapter.active, false);
  assert.equal(web.calls.length, 0);

  const nonAuthority = setup({ authority: false });
  nonAuthority.adapter.init();
  assert.equal(nonAuthority.adapter.active, false);
  assert.equal(nonAuthority.calls.length, 0);

  const nativeWindow = setup({ windowMode: true });
  nativeWindow.adapter.init();
  assert.equal(nativeWindow.adapter.active, false);
  assert.equal(nativeWindow.calls.length, 0);
});

test('reuses an existing daemon and subscribes to its state stream', async () => {
  const adapterState = setup({
    call(method, ...args) {
      if (method === 'execRun') {
        return Promise.resolve({ code: 0, stdout: '/run/user/1000/axctl.sock' });
      }
      if (method === 'socketConnect') return Promise.resolve({ id: 12 });
      return Promise.resolve();
    },
  });
  adapterState.adapter.active = true;
  let trayRefreshes = 0;
  adapterState.adapter.refreshTrayItems = () => { trayRefreshes += 1; };
  adapterState.adapter.refreshApplications = () => {};

  await adapterState.adapter.connect();

  assert.equal(adapterState.adapter.subscriptionSocketId, 12);
  assert.equal(trayRefreshes, 1);
  assert.equal(adapterState.calls.some(([method]) => method === 'execSpawn'), false);
  const subscribe = adapterState.calls.find(([method]) => method === 'socketSend');
  assert.equal(subscribe[1], 12);
  assert.match(subscribe[2], /System\.Subscribe/);
});

test('starts axctl when its socket is absent and waits for readiness', async () => {
  let connectCount = 0;
  const adapterState = setup({
    call(method, ...args) {
      if (method === 'execRun') {
        return Promise.resolve({ code: 0, stdout: '/run/user/1000/axctl.sock' });
      }
      if (method === 'socketConnect') {
        connectCount += 1;
        return connectCount === 1
          ? Promise.reject(new Error('missing socket'))
          : Promise.resolve({ id: 22 });
      }
      if (method === 'execSpawn') return Promise.resolve({ id: 7 });
      return Promise.resolve();
    },
  });
  adapterState.adapter.active = true;
  adapterState.adapter.refreshTrayItems = () => {};
  adapterState.adapter.refreshApplications = () => {};

  await adapterState.adapter.connect();

  const spawn = adapterState.calls.find(([method]) => method === 'execSpawn');
  assert.deepEqual(JSON.parse(JSON.stringify(spawn[1].cmd)), ['axctl', 'daemon']);
  assert.equal(adapterState.adapter.daemonProcessId, '7');
  assert.equal(adapterState.adapter.subscriptionSocketId, 22);
});

test('external compositor windows are filtered and grouped by resolved app', async () => {
  const adapterState = setup();
  adapterState.adapter.resolveApplication = async identity => ({
    id: identity.includes('browser') ? 'org.example.browser.desktop' : 'other.desktop',
    name: identity.includes('browser') ? 'Browser' : 'Other',
    icon: 'browser-icon',
  });

  await adapterState.adapter.updateWindows([
    { id: '1', app_id: 'org.example.browser', title: 'One', is_focused: true },
    { id: '2', app_id: 'org.example.browser', title: 'Two', is_focused: false },
    { id: '3', app_id: 'axtml-nostyle', title: 'XP app', is_focused: false },
    { id: '4', app_id: 'dev.axtml.popup', title: 'Popup', is_focused: false },
  ]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(adapterState.updates[0].map(windowData => [
      windowData.id,
      windowData.groupId,
      windowData.appName,
    ]))),
    [
      ['1', 'org.example.browser', 'Browser'],
      ['2', 'org.example.browser', 'Browser'],
    ],
  );
});

test('a group click focuses the first window or cycles without minimizing', async () => {
  const adapterState = setup({ host: false });
  const focused = [];
  adapterState.adapter.request = async (method, params) => focused.push([method, params.id]);
  adapterState.adapter.windows = [
    { id: '1', groupId: 'browser', focused: true },
    { id: '2', groupId: 'browser', focused: false },
    { id: '3', groupId: 'single', focused: true },
  ];

  await adapterState.adapter.activateGroup('browser');
  adapterState.adapter.windows[0].focused = false;
  adapterState.adapter.windows[1].focused = true;
  await adapterState.adapter.activateGroup('browser');
  await adapterState.adapter.activateGroup('single');

  assert.deepEqual(focused, [
    ['Window.Focus', '2'],
    ['Window.Focus', '1'],
  ]);
});

test('tray events update the real tray and supersede an older list snapshot', async () => {
  const adapterState = setup();
  const trayUpdates = [];
  const removedItems = [];
  let resolveSnapshot;
  adapterState.window.XPAxctlTray = {
    setItems(items) { trayUpdates.push(items); },
    removeItem(id) { removedItems.push(id); },
  };
  adapterState.adapter.subscriptionSocketId = 44;
  adapterState.adapter.request = () =>
    new Promise(resolve => {
      resolveSnapshot = resolve;
    });

  const refresh = adapterState.adapter.refreshTrayItems();
  adapterState.adapter.handleSocketData({
    id: 44,
    data: JSON.stringify({
      method: 'Event.TrayChanged',
      params: { type: 'changed', items: [{ id: 'new-item' }] },
    }),
  });
  adapterState.adapter.handleSocketData({
    id: 44,
    data: JSON.stringify({
      method: 'Event.TrayItemRemoved',
      params: { type: 'removed', id: 'old-item' },
    }),
  });
  resolveSnapshot([{ id: 'stale-item' }]);
  await refresh;

  assert.deepEqual(
    JSON.parse(JSON.stringify(trayUpdates)),
    [[{ id: 'new-item' }]],
  );
  assert.deepEqual(removedItems, ['old-item']);
});

test('the application catalog refresh requests Application.List', async () => {
  const adapterState = setup();
  const applications = [{ id: 'browser.desktop', name: 'Browser' }];
  const methods = [];
  adapterState.adapter.request = async method => {
    methods.push(method);
    return applications;
  };

  await adapterState.adapter.refreshApplications();

  assert.deepEqual(methods, ['Application.List']);
  assert.deepEqual(adapterState.applicationUpdates, [applications]);
});

test('application catalog events trigger a fresh list request', () => {
  const adapterState = setup();
  const refreshes = [];
  adapterState.adapter.subscriptionSocketId = 44;
  adapterState.adapter.refreshApplications = () => refreshes.push(true);

  adapterState.adapter.handleSocketData({
    id: 44,
    data: JSON.stringify({
      method: 'Event.ApplicationsChanged',
      params: { revision: 2 },
    }),
  });

  assert.deepEqual(refreshes, [true]);
});

test('a newer application catalog snapshot supersedes an older request', async () => {
  const adapterState = setup();
  const responses = [];
  adapterState.adapter.request = () =>
    new Promise(resolve => responses.push(resolve));

  const olderRefresh = adapterState.adapter.refreshApplications();
  const newerRefresh = adapterState.adapter.refreshApplications();
  responses[1]([{ id: 'new.desktop', name: 'New' }]);
  await newerRefresh;
  responses[0]([{ id: 'old.desktop', name: 'Old' }]);
  await olderRefresh;

  assert.deepEqual(
    adapterState.applicationUpdates.map(applications => applications[0].id),
    ['new.desktop'],
  );
});
