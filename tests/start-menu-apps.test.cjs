const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this.textContent = '';
    this.isConnected = true;
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = element => {
      for (const child of element.children) {
        if (
          selector === 'img[data-application-icon]' &&
          child.tagName === 'img' &&
          child.dataset.applicationIcon
        ) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

function loadModule({ host = false, authority = false, menu, startMenu } = {}) {
  const bridgeCalls = [];
  const window = {
    axtml: host
      ? {
          call(method) {
            bridgeCalls.push(method);
            return Promise.resolve();
          },
        }
      : undefined,
    XPShellSync: { isAuthority: authority },
  };
  const document = {
    getElementById(id) {
      if (id === 'all-programs-menu') return menu || null;
      if (id === 'start-menu') return startMenu || null;
      return null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createTextNode(text) {
      return { textContent: String(text), nodeType: 3 };
    },
  };
  const context = vm.createContext({ document, window });
  vm.runInContext(
    readFileSync(require.resolve('../js/start-menu-apps.js'), 'utf8'),
    context,
  );
  return { apps: window.XPStartMenuApps, bridgeCalls };
}

function names(groups) {
  return JSON.parse(JSON.stringify(groups.map(group => group.name)));
}

test('desktop categories are mapped into readable menu groups', () => {
  const { apps } = loadModule();
  const groups = apps.groupApplications([
    { id: 'calculator.desktop', name: 'Calculator', categories: ['Utility'] },
    { id: 'browser.desktop', name: 'Browser', categories: ['Network', 'WebBrowser'] },
    { id: 'game.desktop', name: 'Game', categories: ['Game'] },
    { id: 'writer.desktop', name: 'Writer', categories: ['Office', 'WordProcessor'] },
  ]);

  assert.deepEqual(names(groups), ['Accessories', 'Games', 'Internet', 'Office']);
  assert.deepEqual(
    JSON.parse(JSON.stringify(groups.find(group => group.name === 'Internet').applications.map(app => app.id))),
    ['browser.desktop'],
  );
});

test('category queries take priority and do not underline application names', () => {
  const { apps } = loadModule();
  const catalog = [
    { id: 'browser.desktop', name: 'Internet Browser', categories: ['WebBrowser'] },
    { id: 'mail.desktop', name: 'Mail', categories: ['Email'] },
  ];
  const view = apps.buildView(catalog, 'Internet');

  assert.equal(view.mode, 'category');
  assert.deepEqual(names(view.groups), ['Internet']);
  assert.equal(view.autoOpenKey, 'Internet');
  const item = apps.createApplicationItem(view.groups[0].applications[0], view);
  assert.equal(item.children[1].children.some(child => child.tagName === 'u'), false);
});

test('application matches underline the matching name and focus one matching category', () => {
  const menu = new FakeElement();
  const startMenu = new FakeElement();
  const { apps } = loadModule({ host: true, authority: true, menu, startMenu });
  apps.init({ fallbackIcon: 'fallback.png' });
  apps.setApplications([
    { id: 'vesktop.desktop', name: 'Vesktop', categories: ['Network', 'InstantMessaging'] },
  ]);

  assert.equal(apps.setSearch('vesk'), 'Internet');
  assert.equal(menu.children.length, 1);
  const submenu = menu.children[0].children[1];
  const appItem = submenu.children[0];
  const highlighted = appItem.children[1].children.find(child => child.tagName === 'u');
  assert.equal(highlighted.textContent, 'Vesk');
  assert.equal(appItem.children[1].children.at(-1).textContent, 'top');
});

test('cross-category application results include a deduplicated Everything group', () => {
  const { apps } = loadModule();
  const view = apps.buildView(
    [
      { id: 'devtool.desktop', name: 'DevTool', categories: ['Development'] },
      { id: 'toolbox.desktop', name: 'Toolbox', categories: ['Utility'] },
    ],
    'tool',
  );

  assert.equal(view.autoOpenKey, '@everything');
  assert.deepEqual(names(view.groups), ['Everything', 'Accessories', 'Development']);
  assert.deepEqual(
    JSON.parse(JSON.stringify(view.groups[0].applications.map(app => app.id))),
    ['devtool.desktop', 'toolbox.desktop'],
  );
});

test('browser-only initialization leaves the original static menu untouched', async () => {
  const menu = new FakeElement();
  const originalEntry = new FakeElement('button');
  menu.appendChild(originalEntry);
  const { apps, bridgeCalls } = loadModule({ menu });

  apps.init();
  await apps.setKeyboardCapture(true);

  assert.equal(apps.enabled, false);
  assert.equal(menu.children[0], originalEntry);
  assert.deepEqual(bridgeCalls, []);
});

test('launch requests use the desktop application ID', async () => {
  const { apps } = loadModule();
  const requests = [];
  apps.adapter = {
    request(method, params) {
      requests.push([method, params]);
      return Promise.resolve();
    },
  };

  await apps.launch('org.example.App.desktop');

  assert.deepEqual(JSON.parse(JSON.stringify(requests)), [
    ['Application.Launch', { id: 'org.example.App.desktop' }],
  ]);
});

test('the default list shows 15 categories and More contains the rest in a submenu', () => {
  const menu = new FakeElement();
  const startMenu = new FakeElement();
  const { apps } = loadModule({ host: true, authority: true, menu, startMenu });
  apps.init({ fallbackIcon: 'fallback.png' });
  const applications = Array.from({ length: 18 }, (_, index) => ({
    id: `app-${index}`,
    name: `App ${index}`,
    categories: [`Custom${String(index).padStart(2, '0')}`],
  }));
  apps.setApplications(applications);

  assert.equal(menu.children.length, 16);
  assert.equal(menu.children[14].dataset.programFolder, 'Custom14');

  const moreFolder = menu.children[15];
  const moreTrigger = moreFolder.children[0];
  const moreSubmenu = moreFolder.children[1];
  assert.equal(moreFolder.className, 'program-menu-folder');
  assert.equal(moreFolder.dataset.programMore, 'true');
  assert.equal(moreTrigger.className, 'program-menu-item');
  assert.equal(moreTrigger.children[1].textContent, 'More...');
  assert.equal(moreTrigger.attributes['aria-haspopup'], 'menu');
  assert.equal(moreSubmenu.className, 'program-submenu');
  assert.equal(moreSubmenu.dataset.programMoreMenu, 'true');
  assert.equal(moreSubmenu.hidden, true);
  assert.equal(moreSubmenu.children.length, 3);
  assert.deepEqual(
    JSON.parse(JSON.stringify(
      moreSubmenu.children.map(folder => folder.children[0].children[1].textContent),
    )),
    ['Custom15', 'Custom16', 'Custom17'],
  );
});

test('search results are not limited to 15 categories', () => {
  const menu = new FakeElement();
  const startMenu = new FakeElement();
  const { apps } = loadModule({ host: true, authority: true, menu, startMenu });
  apps.init({ fallbackIcon: 'fallback.png' });
  apps.setApplications(
    Array.from({ length: 18 }, (_, index) => ({
      id: `app-${index}`,
      name: `App ${index}`,
      categories: [`Custom${String(index).padStart(2, '0')}`],
    })),
  );

  apps.setSearch('Custom');

  assert.equal(menu.children.length, 19);
  assert.equal(menu.children.some(item => item.dataset.programMore), false);

  apps.clearSearch();

  assert.equal(menu.children.length, 16);
  assert.equal(menu.children[15].dataset.programMore, 'true');
});

test('More does not resolve application icons until a nested category opens', () => {
  const menu = new FakeElement();
  const startMenu = new FakeElement();
  const resolvedIcons = [];
  const { apps } = loadModule({ host: true, authority: true, menu, startMenu });
  apps.init({
    fallbackIcon: 'fallback.png',
    resolveIcon(icon) {
      resolvedIcons.push(icon);
      return Promise.resolve(`resolved:${icon}`);
    },
  });
  apps.setApplications(
    Array.from({ length: 18 }, (_, index) => ({
      id: `app-${index}`,
      name: `App ${index}`,
      icon: `icon-${index}`,
      categories: [`Custom${String(index).padStart(2, '0')}`],
    })),
  );

  const moreMenu = menu.children[15].children[1];
  apps.loadIcons(moreMenu);
  assert.deepEqual(resolvedIcons, []);

  apps.loadIcons(moreMenu.children[0].children[1]);
  assert.deepEqual(resolvedIcons, ['icon-15']);
});

test('AXTML menu keyboard capture arms on-demand and releases on close', async () => {
  const { apps, bridgeCalls } = loadModule({
    host: true,
    authority: true,
    menu: new FakeElement(),
    startMenu: new FakeElement(),
  });
  apps.init();

  await apps.setKeyboardCapture(true);
  await apps.setKeyboardCapture(false);

  assert.deepEqual(bridgeCalls, ['armKeyboard', 'releaseKeyboard']);
});
