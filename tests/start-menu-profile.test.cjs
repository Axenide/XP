const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

function loadProfile({ host = true, authority = true, windowMode = false, call } = {}) {
  const calls = [];
  const window = {
    axtml: host
      ? {
          call(...args) {
            calls.push(args);
            return call ? call(...args) : Promise.resolve({ code: 1 });
          },
        }
      : undefined,
    __axtmlWindowMode: windowMode,
    XPShellSync: { isAuthority: authority },
  };
  const context = vm.createContext({ window });
  vm.runInContext(
    readFileSync(require.resolve('../js/start-menu-profile.js'), 'utf8'),
    context,
  );
  return { calls, profile: window.XPStartMenuProfile };
}

function createStartMenu() {
  return {
    image: { alt: 'User', src: 'assets/windowsIcons/user.png', isConnected: true },
    label: { textContent: 'User' },
    querySelector(selector) {
      if (selector === '.header-img') return this.image;
      if (selector === '.header-text') return this.label;
      return null;
    },
  };
}

test('AXTML profile loads the capitalized username and ~/.face.icon', async () => {
  const { calls, profile } = loadProfile({
    call(method, options) {
      if (options.cmd[0] === 'sh') {
        return Promise.resolve({
          code: 0,
          stdout: 'adriano\n/home/adriano/.face.icon',
        });
      }
      return Promise.resolve({
        code: 0,
        base64: true,
        stdout: 'iVBORw0KGgoAAAANSUhEUg==',
      });
    },
  });
  const startMenu = createStartMenu();

  await profile.init(startMenu);

  assert.equal(startMenu.label.textContent, 'Adriano');
  assert.equal(startMenu.image.alt, 'Adriano');
  assert.equal(startMenu.image.src, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
  assert.deepEqual(
    JSON.parse(JSON.stringify(calls[1])),
    ['execRun', {
      cmd: ['cat', '/home/adriano/.face.icon'],
      timeoutMs: 3000,
      maxBytes: 1 << 20,
      binary: true,
    }],
  );
});

test('the username still updates when ~/.face.icon is unavailable', async () => {
  const { profile } = loadProfile({
    call(method, options) {
      return Promise.resolve(
        options.cmd[0] === 'sh'
          ? { code: 0, stdout: 'adriano\n/home/adriano/.face.icon' }
          : { code: 1, stdout: '', base64: true },
      );
    },
  });
  const startMenu = createStartMenu();

  await profile.init(startMenu);

  assert.equal(startMenu.label.textContent, 'Adriano');
  assert.equal(startMenu.image.src, 'assets/windowsIcons/user.png');
});

test('browser and non-authority views keep the static profile unchanged', async () => {
  const startMenu = createStartMenu();
  const web = loadProfile({ host: false });
  const secondary = loadProfile({ authority: false });
  const nativeWindow = loadProfile({ windowMode: true });

  await web.profile.init(startMenu);
  await secondary.profile.init(startMenu);
  await nativeWindow.profile.init(startMenu);

  assert.equal(startMenu.label.textContent, 'User');
  assert.equal(startMenu.image.src, 'assets/windowsIcons/user.png');
  assert.equal(web.calls.length, 0);
  assert.equal(secondary.calls.length, 0);
  assert.equal(nativeWindow.calls.length, 0);
});

test('profile capitalization uppercases only the first character', () => {
  const { profile } = loadProfile();

  assert.equal(profile.capitalize('adriano'), 'Adriano');
  assert.equal(profile.capitalize('mARIA'), 'MARIA');
  assert.equal(profile.capitalize(''), 'User');
});
