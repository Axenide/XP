const XPApps = {
  apps: {},

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
    if (appName === 'winamp' || appName === 'allprograms') {
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
    });
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
    const content = `
      <div class="app-minesweeper">
        <div class="minesweeper-header">
          <div class="mine-count" id="mine-count">010</div>
          <div class="face-button" id="face-btn">
            <img src="assets/minesweeper/smile.png" alt="Face" />
          </div>
          <div class="timer" id="timer">000</div>
        </div>
        <div class="minesweeper-grid" id="minesweeper-grid"></div>
      </div>
    `;

    const windowId = this.createWindow(
      'Minesweeper',
      'assets/minesweeper/mine-icon.png',
      content,
      {
        x: 180,
        y: 170,
        resizable: false,
        width: 171,
        height: 220,
      },
    );

    this.initMinesweeperGame();
  },

  initMinesweeperGame() {
    const CONFIG = {
      Beginner: { rows: 9, cols: 9, mines: 10 },
      Intermediate: { rows: 16, cols: 16, mines: 40 },
      Expert: { rows: 16, cols: 30, mines: 99 },
    };

    let difficulty = 'Beginner';
    let config = CONFIG[difficulty];
    let grid = [];
    let gameStatus = 'new';
    let timer = 0;
    let timerInterval = null;
    let minesLeft = config.mines;

    function initGrid() {
      grid = [];
      for (let r = 0; r < config.rows; r++) {
        grid[r] = [];
        for (let c = 0; c < config.cols; c++) {
          grid[r][c] = { state: 'cover', minesAround: 0 };
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
        [positions[i], positions[j]] = [positions[posj], positions[i]];
      }

      for (let i = 0; i < config.mines; i++) {
        const pos = positions[i];
        grid[pos.r][pos.c].minesAround = -10;
      }

      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          if (grid[r][c].minesAround >= 0) {
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
                  grid[nr][nc].minesAround < 0
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
      } else if (cellData.state === 'open') {
        cell.classList.add('open');
        if (cellData.minesAround < 0) {
          cell.innerHTML =
            '<img src="assets/minesweeper/mine-icon.png" alt="M" />';
        } else if (cellData.minesAround > 0) {
          cell.innerHTML = `<span class="num-${cellData.minesAround}">${cellData.minesAround}</span>`;
        }
      } else if (cellData.state === 'die') {
        cell.classList.add('die');
        cell.innerHTML =
          '<img src="assets/minesweeper/mine-death.png" alt="X" />';
      } else if (cellData.state === 'misflagged') {
        cell.classList.add('misflagged');
        cell.innerHTML =
          '<img src="assets/minesweeper/misflagged.png" alt="X" />';
      }
    }

    function handleCellClick(r, c) {
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

    function revealCell(r, c) {
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

      document.getElementById('mine-count').textContent = String(
        minesLeft,
      ).padStart(3, '0');
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

      const faceBtn = document.getElementById('face-btn');
      faceBtn.innerHTML = `<img src="assets/minesweeper/${won ? 'win' : 'dead'}.png" alt="Face" />`;

      for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
          const cellData = grid[r][c];
          if (!won && cellData.minesAround < 0 && cellData.state !== 'flag') {
            cellData.state = 'open';
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
        document.getElementById('timer').textContent = String(
          Math.min(timer, 999),
        ).padStart(3, '0');
      }, 1000);
    }

    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    function resetGame() {
      stopTimer();
      gameStatus = 'new';
      timer = 0;
      minesLeft = config.mines;
      document.getElementById('timer').textContent = '000';
      document.getElementById('mine-count').textContent = String(
        minesLeft,
      ).padStart(3, '0');
      document.getElementById('face-btn').innerHTML =
        '<img src="assets/minesweeper/smile.png" alt="Face" />';
      initGrid();
      renderGrid();
    }

    initGrid();
    renderGrid();

    document.getElementById('face-btn').addEventListener('click', resetGame);
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

  createWinamp() {
    const content = `
      <div class="app-winamp">
        <div class="winamp-notice">
          <h2>Winamp</h2>
          <p>Winamp requires webamp library which is not available in static mode.</p>
          <p>This is a placeholder window.</p>
        </div>
      </div>
    `;

    this.createWindow('Winamp', 'assets/windowsIcons/winamp.png', content, {
      x: 0,
      y: 0,
      resizable: false,
      width: 200,
      height: 150,
    });
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
