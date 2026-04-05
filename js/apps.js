const XPApps = {
  apps: {},
  webampInstance: null,
  webampLoading: false,
  webampConstructorPromise: null,
  webampWindowId: null,
  webampIgnoreWindowClose: false,
  webampMinimized: false,

  init() {
    this.registerApps();
  },

  registerApps() {
    this.apps = {
      ie: () => this.createInternetExplorer(),
      minesweeper: () => this.createMinesweeper(),
      notepad: () => this.createNotepad(),
      paint: () => this.createPaint(),
      mycomputer: () => this.createMyComputer(),
      winamp: () => this.createWinamp(),
      internet: () => this.createInternetExplorer(),
      email: () => this.createErrorBox('C:\\\nApplication not found', true),
      mediaplayer: () =>
        this.createErrorBox('C:\\\nApplication not found', true),
      messenger: () => this.createErrorBox('C:\\\nApplication not found', true),
      mydocs: () => this.createErrorBox('C:\\\nApplication not found', true),
      myrecent: () => this.createErrorBox('C:\\\nApplication not found', true),
      mypictures: () =>
        this.createErrorBox('C:\\\nApplication not found', true),
      mymusic: () => this.createErrorBox('C:\\\nApplication not found', true),
      controlpanel: () =>
        this.createErrorBox('C:\\\nApplication not found', true),
      setprogramaccess: () =>
        this.createErrorBox('C:\\\nApplication not found', true),
      connectto: () => this.createErrorBox('C:\\\nApplication not found', true),
      printers: () => this.createErrorBox('C:\\\nApplication not found', true),
      help: () => this.createErrorBox('C:\\\nApplication not found', true),
      search: () => this.createErrorBox('C:\\\nApplication not found', true),
      run: () => this.createErrorBox('C:\\\nApplication not found', true),
    };
  },

  open(appName) {
    if (appName === 'allprograms') {
      this.createErrorBox('C:\\nApplication not found', true);
      return;
    }

    const appFactory = this.apps[appName];
    if (appFactory) {
      appFactory();
    } else {
      this.createErrorBox('C:\\nApplication not found', true);
    }
  },

  createWindow(title, icon, content, options = {}) {
    return XPWindowManager.createWindow({
      title,
      icon,
      content,
      width: options.width || 660,
      height: options.height || 500,
      x: options.x || 100,
      y: options.y || 50,
      resizable: options.resizable !== false,
      minimizable: options.minimizable !== false,
      maximizable: options.maximizable !== false,
      closable: options.closable !== false,
      showInTaskbar: options.showInTaskbar !== false,
      minWidth: options.minWidth || 220,
      minHeight: options.minHeight || 140,
      onClose: options.onClose || null,
      onMinimize: options.onMinimize || null,
      onMaximize: options.onMaximize || null,
      onRestore: options.onRestore || null,
    });
  },

  getWebampMountTarget() {
    const desktop = document.querySelector('.xp-desktop');
    if (!desktop) {
      return null;
    }

    let mount = document.getElementById('webamp-host');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'webamp-host';
      mount.className = 'webamp-host';
      desktop.appendChild(mount);
    }

    return mount;
  },

  setWebampVisibility(visible) {
    const webampRoot = document.getElementById('webamp');
    if (webampRoot) {
      webampRoot.style.display = visible ? '' : 'none';
      webampRoot.style.pointerEvents = visible ? 'auto' : 'none';
    }

    this.webampMinimized = !visible;
  },

  getWebampConstructor() {
    if (this.webampConstructorPromise) {
      return this.webampConstructorPromise;
    }

    this.webampConstructorPromise = (async () => {
      const moduleCandidates = [
        'vendor/webamp/packages/webamp/built/webamp.bundle.min.mjs',
        'https://unpkg.com/webamp@^2',
      ];
      let lastError = null;

      for (const modulePath of moduleCandidates) {
        try {
          const webampModule = await import(modulePath);
          if (webampModule?.default) {
            return webampModule.default;
          }
        } catch (error) {
          lastError = error;
        }
      }

      this.webampConstructorPromise = null;
      throw lastError || new Error('Unable to load Webamp constructor');
    })();

    return this.webampConstructorPromise;
  },

  createNotepad() {
    const content = `
      <div class="app-notepad">
        <div class="notepad-toolbar">
          <div class="menu-bar">
            <span class="menu-item">File</span>
            <span class="menu-item">Edit</span>
            <span class="menu-item">Format</span>
            <span class="menu-item">View</span>
            <span class="menu-item">Help</span>
          </div>
        </div>
        <textarea class="notepad-textarea" placeholder=""></textarea>
      </div>
    `;

    this.createWindow(
      'Untitled - Notepad',
      'assets/windowsIcons/327(16x16).png',
      content,
      {
        x: 270,
        y: 60,
      },
    );
  },

  createMinesweeper() {
    const difficulty = 'Beginner';
    const getWindowSize = diff => {
      const settings = {
        Beginner: { cols: 9, rows: 9 },
        Intermediate: { cols: 16, rows: 16 },
        Expert: { cols: 30, rows: 16 },
      };
      const board = settings[diff] || settings.Beginner;
      const width = board.cols * 16 + 25;
      const height = board.rows * 16 + 109;
      return { width, height };
    };

    const content = `
      <div class="app-minesweeper">
        <div class="mine-menu-bar">
          <span class="menu-item" data-menu="game">Game</span>
          <span class="menu-item" data-menu="help">Help</span>
        </div>
        <div class="mine-menu-dropdown" id="mine-menu" style="display:none;">
          <div class="dropdown-content" id="dropdown-content"></div>
        </div>
        <div class="mine-play-area">
          <div class="minesweeper-header">
            <div class="mine-count" id="mine-count">
              <img src="assets/minesweeper/digit0.png" alt="0" />
              <img src="assets/minesweeper/digit1.png" alt="1" />
              <img src="assets/minesweeper/digit0.png" alt="0" />
            </div>
            <div class="face-button-outer">
              <button class="face-button" id="face-btn" type="button">
                <img src="assets/minesweeper/smile.png" alt="Face" />
              </button>
            </div>
            <div class="timer" id="timer">
              <img src="assets/minesweeper/digit0.png" alt="0" />
              <img src="assets/minesweeper/digit0.png" alt="0" />
              <img src="assets/minesweeper/digit0.png" alt="0" />
            </div>
          </div>
          <div class="minesweeper-grid" id="minesweeper-grid"></div>
        </div>
      </div>
    `;
    const size = getWindowSize(difficulty);

    const windowId = this.createWindow(
      'Minesweeper',
      'assets/minesweeper/mine-icon.png',
      content,
      {
        x: 180,
        y: 170,
        resizable: false,
        maximizable: true,
        width: size.width,
        height: size.height,
      },
    );

    this.initMinesweeperGame(windowId);
  },

  initMinesweeperGame(windowId) {
    const getWindowSize = difficultyName => {
      const board = {
        Beginner: { cols: 9, rows: 9 },
        Intermediate: { cols: 16, rows: 16 },
        Expert: { cols: 30, rows: 16 },
      }[difficultyName] || { cols: 9, rows: 9 };
      return {
        width: board.cols * 16 + 25,
        height: board.rows * 16 + 109,
      };
    };

    const CONFIG = {
      Beginner: {
        rows: 9,
        cols: 9,
        mines: 10,
        ...getWindowSize('Beginner'),
      },
      Intermediate: {
        rows: 16,
        cols: 16,
        mines: 40,
        ...getWindowSize('Intermediate'),
      },
      Expert: {
        rows: 16,
        cols: 30,
        mines: 99,
        ...getWindowSize('Expert'),
      },
    };

    const WINDOW_SIZES = {
      Beginner: getWindowSize('Beginner'),
      Intermediate: getWindowSize('Intermediate'),
      Expert: getWindowSize('Expert'),
    };

    let difficulty = 'Beginner';
    let config = CONFIG[difficulty];
    let grid = [];
    let gameStatus = 'new';
    let timer = 0;
    let timerInterval = null;
    let minesLeft = config.mines;
    let mouseDownOnGrid = false;
    let openMenuName = '';

    const MENU_DATA = {
      Game: [
        { text: 'New', action: 'new', hotkey: 'F2' },
        { type: 'separator' },
        { text: 'Beginner', action: 'Beginner', checked: true },
        { text: 'Intermediate', action: 'Intermediate', checked: false },
        { text: 'Expert', action: 'Expert', checked: false },
        { text: 'Custom...', action: 'custom', disabled: true },
        { type: 'separator' },
        { text: 'Marks (?)', action: 'marks', checked: true, disabled: true },
        { text: 'Color', action: 'color', checked: true, disabled: true },
        { text: 'Sound', action: 'sound', disabled: true },
        { type: 'separator' },
        { text: 'Best Times...', action: 'best-times', disabled: true },
        { type: 'separator' },
        { text: 'Exit', action: 'exit' },
      ],
      Help: [
        { text: 'Contents', action: 'contents', hotkey: 'F1', disabled: true },
        {
          text: 'Search for Help on...',
          action: 'search-help',
          disabled: true,
        },
        { text: 'Using Help', action: 'using-help', disabled: true },
        { type: 'separator' },
        { text: 'About Minesweeper', action: 'about' },
      ],
    };

    function isGameOver() {
      return gameStatus === 'won' || gameStatus === 'died';
    }

    function setGridInteractive(enabled) {
      const gridEl = document.getElementById('minesweeper-grid');
      if (!gridEl) return;
      gridEl.classList.toggle('game-over', !enabled);
    }

    function setActiveMenu(menuName) {
      const menuBar = document.querySelector('.mine-menu-bar');
      if (!menuBar) return;
      menuBar.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.menu === menuName);
      });
    }

    function renderDigits(elementId, value) {
      const el = document.getElementById(elementId);
      el.innerHTML = '';
      let num = value;
      if (num < 0) {
        const absNum = Math.abs(num) % 100;
        el.innerHTML += `<img src="assets/minesweeper/digit-.png" alt="-" />`;
        if (absNum === 0) {
          el.innerHTML += '<img src="assets/minesweeper/digit0.png" alt="0" /><img src="assets/minesweeper/digit0.png" alt="0" />';
        } else if (absNum < 10) {
          el.innerHTML += `<img src="assets/minesweeper/digit0.png" alt="0" /><img src="assets/minesweeper/digit${absNum}.png" alt="${absNum}" />`;
        } else {
          const str = String(absNum);
          el.innerHTML += `<img src="assets/minesweeper/digit${str[0]}.png" alt="${str[0]}" /><img src="assets/minesweeper/digit${str[1]}.png" alt="${str[1]}" />`;
        }
      } else {
        if (num > 999) num = 999;
        const str = num < 10 ? '00' + num : num < 100 ? '0' + num : String(num);
        for (let i = 0; i < str.length; i++) {
          el.innerHTML += `<img src="assets/minesweeper/digit${str[i]}.png" alt="${str[i]}" />`;
        }
      }
    }

    function resizeWindow(newDifficulty) {
      const size = WINDOW_SIZES[newDifficulty];
      const win = document.getElementById(`window-${windowId}`);
      if (win) {
        win.style.width = size.width + 'px';
        win.style.height = size.height + 'px';
      }
    }

    function initGrid() {
      grid = [];
      for (let r = 0; r < config.rows; r++) {
        grid[r] = [];
        for (let c = 0; c < config.cols; c++) {
          grid[r][c] = { state: 'cover', minesAround: 0, hasMine: false };
        }
      }
    }

    function placeMines(excludeRow, excludeCol) {
      const positions = [];
      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          if (r !== excludeRow || c !== excludeCol) {
            positions.push({ r, c });
          }
        }
      }

      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      for (let i = 0; i < config.mines; i++) {
        const pos = positions[i];
        grid[pos.r][pos.c].hasMine = true;
        grid[pos.r][pos.c].minesAround = -1;
      }

      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          if (!grid[r][c].hasMine) {
            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr,
                  nc = c + dc;
                if (
                  nr >= 0 &&
                  nr < config.rows &&
                  nc >= 0 &&
                  nc < config.cols &&
                  grid[nr][nc].hasMine
                ) {
                  count++;
                }
              }
            }
            grid[r][c].minesAround = count;
          }
        }
      }
    }

    function renderGrid() {
      const gridEl = document.getElementById('minesweeper-grid');
      gridEl.innerHTML = '';
      gridEl.style.gridTemplateColumns = `repeat(${config.cols}, 16px)`;
      gridEl.style.gridTemplateRows = `repeat(${config.rows}, 16px)`;

      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          const cell = document.createElement('div');
          cell.className = 'mine-cell';
          cell.dataset.r = r;
          cell.dataset.c = c;
          updateCell(cell, grid[r][c]);

          cell.addEventListener('click', () => handleCellClick(r, c));
          cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            handleCellRightClick(r, c);
          });
          cell.addEventListener('dblclick', () => handleCellChord(r, c));

          gridEl.appendChild(cell);
        }
      }
    }

    function updateCell(cell, cellData) {
      cell.className = 'mine-cell';

      if (cellData.state === 'cover') {
        cell.classList.add('covered');
        cell.innerHTML = '';
      } else if (cellData.state === 'flag') {
        cell.classList.add('flagged');
        cell.innerHTML = '<img src="assets/minesweeper/flag.png" alt="F" />';
      } else if (cellData.state === 'question') {
        cell.classList.add('question');
        cell.innerHTML =
          '<img src="assets/minesweeper/question.png" alt="?" />';
      } else if (cellData.state === 'open' || cellData.state === 'mine') {
        cell.classList.add('open');
        if (cellData.minesAround < 0) {
          cell.innerHTML =
            '<img src="assets/minesweeper/mine-ceil.png" alt="M" />';
        } else if (cellData.minesAround > 0) {
          cell.innerHTML = `<img src="assets/minesweeper/open${cellData.minesAround}.png" alt="${cellData.minesAround}" />`;
        }
      } else if (cellData.state === 'die') {
        cell.classList.add('open', 'die');
        cell.innerHTML =
          '<img src="assets/minesweeper/mine-death.png" alt="X" />';
      } else if (cellData.state === 'misflagged') {
        cell.classList.add('open', 'misflagged');
        cell.innerHTML =
          '<img src="assets/minesweeper/misflagged.png" alt="X" />';
      }
    }

    function handleCellClick(r, c) {
      if (isGameOver()) return;
      const cellData = grid[r][c];
      if (cellData.state === 'flag' || cellData.state === 'open') return;

      if (gameStatus === 'new') {
        placeMines(r, c);
        gameStatus = 'started';
        startTimer();
      }

      if (cellData.minesAround < 0) {
        gameOver(false, r, c);
        return;
      }

      revealCell(r, c);
      checkWin();
    }

    function handleCellChord(r, c) {
      if (gameStatus !== 'started' || isGameOver()) return;
      const cellData = grid[r][c];
      if (cellData.state !== 'open' || cellData.minesAround <= 0) return;

      let flagCount = 0;
      const neighbors = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) {
            neighbors.push({ r: nr, c: nc });
            if (grid[nr][nc].state === 'flag') flagCount++;
          }
        }
      }

      if (flagCount === cellData.minesAround) {
        for (const n of neighbors) {
          const nCell = grid[n.r][n.c];
          if (nCell.state !== 'flag') {
            if (nCell.minesAround < 0) {
              gameOver(false, n.r, n.c);
              return;
            }
            revealCell(n.r, n.c);
          }
        }
        checkWin();
      }
    }

    function revealCell(r, c) {
      if (isGameOver()) return;
      const cellData = grid[r][c];
      if (cellData.state === 'open' || cellData.state === 'flag') return;

      cellData.state = 'open';

      if (cellData.minesAround === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr,
              nc = c + dc;
            if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) {
              revealCell(nr, nc);
            }
          }
        }
      }

      const cellEl = document.querySelector(
        `.mine-cell[data-r="${r}"][data-c="${c}"]`,
      );
      if (cellEl) updateCell(cellEl, cellData);
    }

    function handleCellRightClick(r, c) {
      if (isGameOver()) return;
      const cellData = grid[r][c];
      if (cellData.state === 'open') return;

      if (cellData.state === 'cover') {
        cellData.state = 'flag';
        minesLeft--;
      } else if (cellData.state === 'flag') {
        cellData.state = 'question';
        minesLeft++;
      } else if (cellData.state === 'question') {
        cellData.state = 'cover';
      }

      renderDigits('mine-count', minesLeft);
      const cellEl = document.querySelector(
        `.mine-cell[data-r="${r}"][data-c="${c}"]`,
      );
      if (cellEl) updateCell(cellEl, cellData);
    }

    function checkWin() {
      let covered = 0;
      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          if (grid[r][c].state !== 'open') covered++;
        }
      }
      if (covered === config.mines) {
        gameOver(true);
      }
    }

    function gameOver(won, deathR, deathC) {
      gameStatus = won ? 'won' : 'died';
      stopTimer();
      setGridInteractive(false);

      const faceBtn = document.getElementById('face-btn');
      faceBtn.innerHTML = `<img src="assets/minesweeper/${won ? 'win' : 'dead'}.png" alt="Face" />`;

      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          const cellData = grid[r][c];
          if (!won && cellData.minesAround < 0 && cellData.state !== 'flag') {
            cellData.state = 'mine';
          } else if (won && cellData.minesAround < 0) {
            cellData.state = 'flag';
          } else if (
            !won &&
            cellData.state === 'flag' &&
            cellData.minesAround >= 0
          ) {
            cellData.state = 'misflagged';
          }
          const cellEl = document.querySelector(
            `.mine-cell[data-r="${r}"][data-c="${c}"]`,
          );
          if (cellEl) updateCell(cellEl, cellData);
        }
      }

      if (!won && deathR !== undefined && deathC !== undefined) {
        const deathCell = document.querySelector(
          `.mine-cell[data-r="${deathR}"][data-c="${deathC}"]`,
        );
        if (deathCell) {
          deathCell.classList.add('die');
          deathCell.innerHTML =
            '<img src="assets/minesweeper/mine-death.png" alt="X" />';
        }
      }
    }

    function startTimer() {
      timer = 0;
      timerInterval = setInterval(() => {
        timer++;
        renderDigits('timer', timer);
      }, 1000);
    }

    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    function resetGame(newDifficulty) {
      if (newDifficulty && newDifficulty !== difficulty) {
        difficulty = newDifficulty;
        config = CONFIG[difficulty];
        minesLeft = config.mines;
        resizeWindow(difficulty);
        updateMenuChecks();
      }
      stopTimer();
      gameStatus = 'new';
      timer = 0;
      minesLeft = config.mines;
      renderDigits('timer', 0);
      renderDigits('mine-count', minesLeft);
      document.getElementById('face-btn').innerHTML =
        '<img src="assets/minesweeper/smile.png" alt="Face" />';
      initGrid();
      renderGrid();
      setGridInteractive(true);
    }

    function showMenu(menuName, targetElement) {
      const dropdown = document.getElementById('mine-menu');
      const content = document.getElementById('dropdown-content');
      const menuKey = menuName
        ? menuName.charAt(0).toUpperCase() + menuName.slice(1).toLowerCase()
        : '';
      const items = MENU_DATA[menuKey];
      if (!items || !dropdown || !content) return;
      openMenuName = menuName;
      setActiveMenu(menuName);

      content.innerHTML = '';
      items.forEach(item => {
        if (item.type === 'separator') {
          const sep = document.createElement('div');
          sep.className = 'dropdown-separator';
          content.appendChild(sep);
        } else {
          const el = document.createElement('div');
          el.className = 'dropdown-item';
          if (item.disabled) {
            el.classList.add('disabled');
          }
          const check = item.checked
            ? '<img src="assets/windowsIcons/checked.png" alt="" />'
            : '';
          const hotkey = item.hotkey || '';
          el.innerHTML = `
            <span class="dropdown-check" aria-hidden="true">${check}</span>
            <span class="dropdown-text">${item.text}</span>
            <span class="dropdown-hotkey">${hotkey}</span>
            <span class="dropdown-arrow-spacer" aria-hidden="true"></span>
          `;
          if (!item.disabled) {
            el.addEventListener('click', () => handleMenuAction(item.action));
          }
          content.appendChild(el);
        }
      });
      
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = rect.top + rect.height + 'px';
      }
      
      dropdown.style.display = 'block';
    }

    function hideMenu() {
      const dropdown = document.getElementById('mine-menu');
      if (!dropdown) return;
      dropdown.style.display = 'none';
      openMenuName = '';
      setActiveMenu('');
    }

    function handleMenuAction(action) {
      hideMenu();
      switch (action) {
        case 'new':
          resetGame();
          break;
        case 'Beginner':
        case 'Intermediate':
        case 'Expert':
          resetGame(action);
          break;
        case 'exit':
          const win = document.getElementById(`window-${windowId}`);
          if (win && win.parentElement) win.parentElement.remove();
          break;
        case 'about':
          alert('Minesweeper\n\nClassic Minesweeper game for Windows XP');
          break;
      }
    }

    function updateMenuChecks() {
      MENU_DATA.Game.forEach(item => {
        if (item.action === 'Beginner' || item.action === 'Intermediate' || item.action === 'Expert') {
          item.checked = item.action === difficulty;
        }
      });
    }

    function setFaceOhh() {
      if (gameStatus === 'new' || gameStatus === 'started') {
        const faceBtn = document.getElementById('face-btn');
        faceBtn.innerHTML = '<img src="assets/minesweeper/ohh.png" alt="Face" />';
      }
    }

    function setFaceNormal() {
      if (gameStatus === 'new' || gameStatus === 'started') {
        const faceBtn = document.getElementById('face-btn');
        faceBtn.innerHTML = '<img src="assets/minesweeper/smile.png" alt="Face" />';
      }
    }

    initGrid();
    renderGrid();
    setGridInteractive(true);

    document.getElementById('face-btn').addEventListener('click', () => resetGame());

    const menuBar = document.querySelector('.mine-menu-bar');
    if (menuBar) {
      menuBar.addEventListener('mousedown', e => {
        const item = e.target.closest('.menu-item');
        if (item) {
          e.preventDefault();
          const menuName = item.dataset.menu;
          if (menuName === 'game' || menuName === 'help') {
            const dropdown = document.getElementById('mine-menu');
            const isOpen = dropdown && dropdown.style.display === 'block';
            if (isOpen && openMenuName === menuName) {
              hideMenu();
            } else {
              showMenu(menuName, item);
            }
          }
        }
      });

      menuBar.addEventListener('mouseover', e => {
        const item = e.target.closest('.menu-item');
        if (!item) return;
        const menuName = item.dataset.menu;
        if (menuName !== 'game' && menuName !== 'help') return;
        const dropdown = document.getElementById('mine-menu');
        const isOpen = dropdown && dropdown.style.display === 'block';
        if (isOpen && openMenuName !== menuName) {
          showMenu(menuName, item);
        }
      });
    }

    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('mine-menu');
      const menuBar = document.querySelector('.mine-menu-bar');
      if (dropdown && dropdown.style.display === 'block' && !dropdown.contains(e.target) && (!menuBar || !menuBar.contains(e.target))) {
        hideMenu();
      }
    });

    const gridEl = document.getElementById('minesweeper-grid');
    if (gridEl) {
      gridEl.addEventListener('mousedown', (e) => {
        if (e.button === 0 && (gameStatus === 'new' || gameStatus === 'started')) {
          setFaceOhh();
          mouseDownOnGrid = true;
        }
      });
      gridEl.addEventListener('mouseup', () => {
        if (mouseDownOnGrid) {
          setFaceNormal();
          mouseDownOnGrid = false;
        }
      });
      gridEl.addEventListener('mouseleave', () => {
        if (mouseDownOnGrid) {
          setFaceNormal();
          mouseDownOnGrid = false;
        }
      });
    }
  },

  createInternetExplorer() {
    const content = `
      <div class="app-ie">
        <div class="ie-toolbar">
          <div class="ie-menu">
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Favorites</span>
            <span>Tools</span>
            <span>Help</span>
          </div>
          <img class="ie-windows-logo" src="assets/windowsIcons/windows.png" alt="Windows" />
        </div>
        <div class="ie-navbar">
          <div class="ie-nav-btn disabled"><img src="assets/windowsIcons/back.png" alt="Back" /><span>Back</span><div class="ie-nav-arrow"></div></div>
          <div class="ie-nav-btn disabled"><img src="assets/windowsIcons/forward.png" alt="Forward" /><div class="ie-nav-arrow"></div></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/stop.png" alt="Stop" /></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/refresh.png" alt="Refresh" /></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/home.png" alt="Home" /></div>
          <div class="ie-separator"></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/299(32x32).png" alt="Search" /><span>Search</span></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/744(32x32).png" alt="Favorites" /><span>Favorites</span></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/history.png" alt="History" /></div>
          <div class="ie-separator"></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/mail.png" alt="Mail" /><div class="ie-nav-arrow mail-arrow"></div></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/17(32x32).png" alt="Print" /></div>
          <div class="ie-nav-btn disabled"><img src="assets/windowsIcons/edit.png" alt="Edit" /></div>
          <div class="ie-nav-btn"><img src="assets/windowsIcons/msn.png" alt="MSN" /></div>
        </div>
        <div class="ie-addressbar">
          <span class="address-label">Address</span>
          <div class="address-input">
            <img src="assets/windowsIcons/ie-paper.png" alt="IE" />
            <span>http://www.google.com/</span>
            <img class="dropdown" src="assets/windowsIcons/dropdown.png" alt="v" />
          </div>
          <div class="go-btn">
            <img src="assets/windowsIcons/290.png" alt="Go" />
            <span>Go</span>
          </div>
          <div class="address-separator"></div>
          <div class="links-btn">
            <span>Links</span>
            <img src="assets/windowsIcons/links.png" alt="Links" />
          </div>
        </div>
        <div class="ie-content">
          <div class="google-2007">
            <img class="google-2007-logo" src="assets/google-logo-2007.gif" alt="Google" />

            <div class="google-2007-tabs">
              <a href="#" class="active">Web</a>
              <a href="#">Images</a>
              <a href="#">Video</a>
              <a href="#">News</a>
              <a href="#">Maps</a>
                <a href="#" class="google-2007-more">more »</a>
            </div>

            <div class="google-2007-search-block">
              <div class="google-2007-search-row">
                <input id="ie-google-query" class="google-2007-input" type="text" value="" />
                <div class="google-2007-side-links">
                  <a href="#">Advanced Search</a>
                  <a href="#">Preferences</a>
                  <a href="#">Language Tools</a>
                </div>
              </div>
              <div class="google-2007-buttons">
                <button class="google-2007-btn" id="ie-google-search">Google Search</button>
                <button class="google-2007-btn">I'm Feeling Lucky</button>
              </div>
            </div>

            <div class="google-2007-footer-links">
              <a href="#">Advertising Programs</a>
              <span>-</span>
              <a href="#">Business Solutions</a>
              <span>-</span>
              <a href="#">About Google</a>
            </div>

            <div class="google-2007-copyright">©2007 Google</div>
          </div>
        </div>
        <div class="ie-footer">
          <div class="status">
            <img src="assets/windowsIcons/ie-paper.png" alt="" />
            <span>Done</span>
          </div>
          <div class="secure">
            <img src="assets/windowsIcons/earth.png" alt="" />
            <span>Internet</span>
          </div>
        </div>
      </div>
    `;

    this.createWindow(
      'Internet Explorer',
      'assets/windowsIcons/ie-paper.png',
      content,
      {
        x: 140,
        y: 30,
      },
    );

    const searchInput = document.getElementById('ie-google-query');
    const searchButton = document.getElementById('ie-google-search');
    const addressText = document.querySelector('.address-input span');

    if (searchInput && addressText) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const query = searchInput.value.trim();
        if (!query) return;
        addressText.textContent = `http://www.google.com/search?q=${encodeURIComponent(query)}`;
      });
    }

    if (searchButton && searchInput && addressText) {
      searchButton.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (!query) return;
        addressText.textContent = `http://www.google.com/search?q=${encodeURIComponent(query)}`;
      });
    }
  },

  createPaint() {
    const content = `
      <div class="app-paint">
        <iframe src="https://jspaint.app" frameborder="0" title="Paint"></iframe>
      </div>
    `;

    this.createWindow(
      'Untitled - Paint',
      'assets/windowsIcons/680(16x16).png',
      content,
      {
        x: 280,
        y: 70,
      },
    );
  },

  createMyComputer() {
    const content = `
      <div class="app-mycomputer">
        <section class="mcx-toolbar">
          <div class="mcx-toolbar-menu">
            <span>File</span>
            <span>Edit</span>
            <span>View</span>
            <span>Favorites</span>
            <span>Tools</span>
            <span>Help</span>
          </div>
          <img src="assets/windowsIcons/windows.png" alt="Windows" class="mcx-windows-logo" />
        </section>

        <section class="mcx-function-bar">
          <div class="mcx-fn-btn mcx-fn-btn-disabled">
            <img src="assets/windowsIcons/back.png" alt="Back" class="mcx-fn-icon mcx-fn-icon-big" />
            <span>Back</span>
            <i class="mcx-fn-arrow"></i>
          </div>
          <div class="mcx-fn-btn mcx-fn-btn-disabled">
            <img src="assets/windowsIcons/forward.png" alt="Forward" class="mcx-fn-icon mcx-fn-icon-big" />
            <i class="mcx-fn-arrow"></i>
          </div>
          <div class="mcx-fn-btn">
            <img src="assets/windowsIcons/up.png" alt="Up" class="mcx-fn-icon" />
          </div>
          <div class="mcx-fn-separator"></div>
          <div class="mcx-fn-btn">
            <img src="assets/windowsIcons/299(32x32).png" alt="Search" class="mcx-fn-icon" />
            <span>Search</span>
          </div>
          <div class="mcx-fn-btn">
            <img src="assets/windowsIcons/337(32x32).png" alt="Folders" class="mcx-fn-icon" />
            <span>Folders</span>
          </div>
          <div class="mcx-fn-separator"></div>
          <div class="mcx-fn-btn">
            <img src="assets/windowsIcons/358(32x32).png" alt="Menu" class="mcx-fn-icon mcx-fn-icon-menu" />
            <i class="mcx-fn-arrow"></i>
          </div>
        </section>

        <section class="mcx-address-bar">
          <div class="mcx-address-title">Address</div>
          <div class="mcx-address-field">
            <img src="assets/windowsIcons/676(16x16).png" alt="Computer" />
            <span>My Computer</span>
            <img src="assets/windowsIcons/dropdown.png" alt="Dropdown" class="mcx-dropdown" />
          </div>
          <button class="mcx-go-btn" type="button">
            <img src="assets/windowsIcons/290.png" alt="Go" />
            <span>Go</span>
          </button>
        </section>

        <div class="mcx-content">
          <aside class="mcx-sidebar">
            <section class="mcx-side-card">
              <header class="mcx-side-card-header">
                <strong>System Tasks</strong>
                <img src="assets/windowsIcons/pullup.png" alt="Toggle" />
              </header>
              <div class="mcx-side-card-body">
                <div class="mcx-side-row"><img src="assets/windowsIcons/view-info.ico" alt="View" /><span>View system information</span></div>
                <div class="mcx-side-row"><img src="assets/windowsIcons/302(16x16).png" alt="Programs" /><span>Add or remove programs</span></div>
                <div class="mcx-side-row"><img src="assets/windowsIcons/300(16x16).png" alt="Settings" /><span>Change a setting</span></div>
              </div>
            </section>

            <section class="mcx-side-card">
              <header class="mcx-side-card-header">
                <strong>Other Places</strong>
                <img src="assets/windowsIcons/pullup.png" alt="Toggle" />
              </header>
              <div class="mcx-side-card-body">
                <div class="mcx-side-row"><img src="assets/windowsIcons/693(16x16).png" alt="Network" /><span>My Network Places</span></div>
                <div class="mcx-side-row"><img src="assets/windowsIcons/308(16x16).png" alt="Documents" /><span>My Documents</span></div>
                <div class="mcx-side-row"><img src="assets/windowsIcons/318(16x16).png" alt="Shared Documents" /><span>Shared Documents</span></div>
                <div class="mcx-side-row"><img src="assets/windowsIcons/300(16x16).png" alt="Control Panel" /><span>Control Panel</span></div>
              </div>
            </section>
          </aside>

          <main class="mcx-main">
            <section class="mcx-group">
              <h3>Files Stored on This Computer</h3>
              <div class="mcx-group-items">
                <div class="mcx-main-item"><img src="assets/windowsIcons/318(48x48).png" alt="Shared Documents" /><span>Shared Documents</span></div>
                <div class="mcx-main-item"><img src="assets/windowsIcons/318(48x48).png" alt="User Documents" /><span>User's Documents</span></div>
              </div>
            </section>

            <section class="mcx-group">
              <h3>Hard Disk Drives</h3>
              <div class="mcx-group-items">
                <div class="mcx-main-item"><img src="assets/windowsIcons/334(48x48).png" alt="Local Disk" /><span>Local Disk (C:)</span></div>
              </div>
            </section>

            <section class="mcx-group">
              <h3>Devices with Removable Storage</h3>
              <div class="mcx-group-items">
                <div class="mcx-main-item"><img src="assets/windowsIcons/111(48x48).png" alt="CD Drive" /><span>CD Drive (D:)</span></div>
              </div>
            </section>
          </main>
        </div>
      </div>
    `;

    this.createWindow(
      'My Computer',
      'assets/windowsIcons/676(16x16).png',
      content,
      {
        x: 24,
        y: 28,
        width: 660,
        height: 500,
      },
    );
  },

  async createWinamp() {
    if (this.webampWindowId !== null) {
      XPWindowManager.restoreWindow(this.webampWindowId);
      XPWindowManager.focusWindow(this.webampWindowId);
    }

    if (this.webampInstance) {
      this.setWebampVisibility(true);
      return;
    }

    if (this.webampLoading) {
      return;
    }

    this.webampLoading = true;

    try {
      this.webampWindowId = this.createWindow('Winamp', 'assets/windowsIcons/winamp.png', '', {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        resizable: false,
        minimizable: true,
        maximizable: false,
        onClose: () => {
          if (this.webampIgnoreWindowClose) {
            this.webampIgnoreWindowClose = false;
            return;
          }

          this.setWebampVisibility(false);

          if (this.webampInstance) {
            this.webampInstance.close();
          }
          this.webampWindowId = null;
        },
        onMinimize: () => {
          this.setWebampVisibility(false);
        },
        onRestore: () => {
          this.setWebampVisibility(true);
        },
      });

      const webampWindowEl = document.getElementById(`window-${this.webampWindowId}`);
      if (webampWindowEl) {
        webampWindowEl.classList.add('webamp-shell-window');
      }

      const mountTarget = this.getWebampMountTarget();
      if (!mountTarget) {
        throw new Error('Desktop mount point not found');
      }

      const Webamp = await this.getWebampConstructor();
      const webamp = new Webamp({
        initialTracks: [
          {
            metaData: {
              artist: 'DJ Mike Llama',
              title: "Llama Whippin' Intro",
            },
            url: 'https://cdn.jsdelivr.net/gh/captbaritone/webamp@43434d82cfe0e37286dbbe0666072dc3190a83bc/mp3/llama-2.91.mp3',
            duration: 5.322286,
          },
        ],
      });

      if (typeof webamp.renderInto === 'function') {
        await webamp.renderInto(mountTarget);
      } else {
        await webamp.renderWhenReady(mountTarget);
      }
      this.setWebampVisibility(true);

      webamp.onClose(() => {
        if (this.webampWindowId !== null) {
          this.webampIgnoreWindowClose = true;
          XPWindowManager.closeWindow(this.webampWindowId);
        }

        this.webampInstance = null;
        this.webampWindowId = null;
        this.webampMinimized = false;
      });

      webamp.onWillClose((cancel) => {
        if (this.webampLoading) {
          cancel();
        }
      });

      webamp.onMinimize(() => {
        if (this.webampWindowId !== null) {
          XPWindowManager.minimizeWindow(this.webampWindowId, false);
        }
        this.setWebampVisibility(false);
      });

      this.webampInstance = webamp;
    } catch (error) {
      console.error(error);
      if (this.webampWindowId !== null) {
        XPWindowManager.closeWindow(this.webampWindowId);
        this.webampWindowId = null;
      }
      this.createErrorBox('C:\\nUnable to load Webamp', true);
    } finally {
      this.webampLoading = false;
    }
  },

  createErrorBox(message, withSound = false) {
    if (withSound) {
      try {
        const audio = new Audio('./assets/sounds/error.wav');
        audio.currentTime = 0;
        audio.play().catch((error) => {
          console.error(error);
        });
      } catch (error) {
        console.error(error);
      }
    }

    const normalizedMessage = message.replace('\\n', '\n');

    const content = `
      <div class="app-errorbox">
        <div class="error-top">
          <div class="error-icon">
            <img src="assets/windowsIcons/897(32x32).png" alt="Error" />
          </div>
          <div class="error-message">
            <p>${normalizedMessage.replace(/\n/g, '<br>')}</p>
          </div>
        </div>
        <div class="error-bottom">
          <div class="error-button">
          <button class="error-ok-btn">OK</button>
          </div>
        </div>
      </div>
    `;

    const errorWindowId = this.createWindow(
      'C:\\',
      'assets/windowsIcons/897(16x16).png',
      content,
      {
        x: window.innerWidth / 2 - 190,
        y: window.innerHeight / 2 - 60,
        width: 380,
        height: 118,
        resizable: false,
        minimizable: false,
        maximizable: false,
        showInTaskbar: false,
      },
    );

    const errorWindow = document.getElementById(`window-${errorWindowId}`);
    const okButton = errorWindow?.querySelector('.error-ok-btn');
    if (okButton) {
      okButton.addEventListener('click', () => {
        XPWindowManager.closeWindow(errorWindowId);
      });
    }
  },
};

window.XPApps = XPApps;
