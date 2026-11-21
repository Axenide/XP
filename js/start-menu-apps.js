const XPStartMenuApps = {
  menu: null,
  adapter: null,
  enabled: false,
  applications: [],
  searchTerm: '',
  maxVisibleCategories: 15,
  loading: true,
  available: true,
  nextMenuId: 1,
  everythingKey: '@everything',
  categoryOrder: [
    'Accessories',
    'Development',
    'Education',
    'Games',
    'Graphics',
    'Internet',
    'Multimedia',
    'Office',
    'Other',
    'System',
  ],
  categoryAliases: new Map([
    ['accessibility', 'Accessories'],
    ['archiving', 'Accessories'],
    ['calculator', 'Accessories'],
    ['compression', 'Accessories'],
    ['dictionary', 'Accessories'],
    ['discburning', 'Accessories'],
    ['filemanager', 'Accessories'],
    ['filetools', 'Accessories'],
    ['printing', 'Accessories'],
    ['scanning', 'Accessories'],
    ['terminalemulator', 'Accessories'],
    ['texteditor', 'Accessories'],
    ['utility', 'Accessories'],
    ['building', 'Development'],
    ['debugger', 'Development'],
    ['development', 'Development'],
    ['guidesigner', 'Development'],
    ['ide', 'Development'],
    ['revisioncontrol', 'Development'],
    ['education', 'Education'],
    ['languages', 'Education'],
    ['math', 'Education'],
    ['reference', 'Education'],
    ['science', 'Education'],
    ['teaching', 'Education'],
    ['actiongame', 'Games'],
    ['adventuregame', 'Games'],
    ['arcadegame', 'Games'],
    ['boardgame', 'Games'],
    ['blocksgame', 'Games'],
    ['cardgame', 'Games'],
    ['emulator', 'Games'],
    ['game', 'Games'],
    ['kidsgame', 'Games'],
    ['logicgame', 'Games'],
    ['rolegame', 'Games'],
    ['simulation', 'Games'],
    ['sportsgame', 'Games'],
    ['strategygame', 'Games'],
    ['2dgraphics', 'Graphics'],
    ['3dgraphics', 'Graphics'],
    ['graphics', 'Graphics'],
    ['photography', 'Graphics'],
    ['publishing', 'Graphics'],
    ['rastergraphics', 'Graphics'],
    ['vectorgraphics', 'Graphics'],
    ['chat', 'Internet'],
    ['email', 'Internet'],
    ['filetransfer', 'Internet'],
    ['instantmessaging', 'Internet'],
    ['network', 'Internet'],
    ['remoteaccess', 'Internet'],
    ['webbrowser', 'Internet'],
    ['audio', 'Multimedia'],
    ['audiovideo', 'Multimedia'],
    ['audiovideoediting', 'Multimedia'],
    ['midi', 'Multimedia'],
    ['music', 'Multimedia'],
    ['player', 'Multimedia'],
    ['recorder', 'Multimedia'],
    ['video', 'Multimedia'],
    ['tv', 'Multimedia'],
    ['calendar', 'Office'],
    ['contactmanagement', 'Office'],
    ['database', 'Office'],
    ['finance', 'Office'],
    ['office', 'Office'],
    ['presentation', 'Office'],
    ['projectmanagement', 'Office'],
    ['spreadsheet', 'Office'],
    ['wordprocessor', 'Office'],
    ['desktopsettings', 'System'],
    ['hardwaresettings', 'System'],
    ['monitor', 'System'],
    ['packagemanager', 'System'],
    ['security', 'System'],
    ['settings', 'System'],
    ['system', 'System'],
  ]),
  ignoredCategories: new Set(['application', 'gnome', 'gtk', 'kde', 'qt']),

  init(adapter) {
    if (adapter) this.adapter = adapter;
    this.menu ||= document.getElementById('all-programs-menu');
    if (
      !this.menu ||
      !window.axtml ||
      window.__axtmlWindowMode ||
      !window.XPShellSync?.isAuthority
    ) {
      return;
    }
    if (this.enabled) return;
    this.enabled = true;
    document
      .getElementById('start-menu')
      ?.setAttribute('data-axctl-apps-enabled', 'true');
    this.render();
  },

  setApplications(applications) {
    this.loading = false;
    this.available = true;
    const seen = new Set();
    this.applications = Array.isArray(applications)
      ? applications
          .filter(application => {
            if (!application?.id || !application?.name || seen.has(application.id)) {
              return false;
            }
            seen.add(application.id);
            return true;
          })
          .sort((first, second) => this.compareNames(first.name, second.name))
      : [];
    this.render();
  },

  setUnavailable() {
    this.loading = false;
    this.available = false;
    this.render();
  },

  setSearch(query) {
    this.searchTerm = String(query || '');
    const view = this.buildView(this.applications, this.searchTerm);
    this.render(view);
    return view.autoOpenKey;
  },

  clearSearch() {
    if (!this.searchTerm) return;
    this.searchTerm = '';
    this.render();
  },

  setKeyboardCapture(active) {
    if (!this.enabled || !window.axtml) return Promise.resolve();
    const method = active ? 'armKeyboard' : 'releaseKeyboard';
    const options = active ? [{ band: 2 }] : [];
    const commandId = window.XPShellSync?.currentInputCommand ?? null;
    window.XPShellSync?.debugInput?.('keyboard-capture-request', {
      active,
      band: active ? 2 : null,
      commandId,
    });
    return window.axtml.call(method, ...options).then(() => {
      window.XPShellSync?.debugInput?.('keyboard-capture-resolved', {
        active,
        band: active ? 2 : null,
        commandId,
      });
    }).catch(error => {
      window.XPShellSync?.debugInput?.('keyboard-capture-failed', {
        active,
        band: active ? 2 : null,
        commandId,
        error: String(error),
      });
    });
  },

  normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
  },

  compareNames(first, second) {
    return String(first || '').localeCompare(String(second || ''), undefined, {
      sensitivity: 'base',
    });
  },

  categoryLabels(application) {
    const labels = new Set();
    const categories = Array.isArray(application.categories) ? application.categories : [];
    for (const rawCategory of categories) {
      const key = this.normalizeText(rawCategory).replace(/[^a-z0-9]/g, '');
      if (!key || this.ignoredCategories.has(key)) continue;
      const label = this.categoryAliases.get(key) || this.humanizeCategory(rawCategory);
      if (label) labels.add(label);
    }
    return labels.size ? [...labels] : ['Other'];
  },

  humanizeCategory(category) {
    const value = String(category || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .trim();
    return value || 'Other';
  },

  groupApplications(applications) {
    const groups = new Map();
    for (const application of applications) {
      for (const label of this.categoryLabels(application)) {
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(application);
      }
    }
    return [...groups]
      .map(([name, entries]) => ({ key: name, name, applications: entries }))
      .sort((first, second) => {
        const firstIndex = this.categoryOrder.indexOf(first.name);
        const secondIndex = this.categoryOrder.indexOf(second.name);
        if (firstIndex >= 0 || secondIndex >= 0) {
          return (firstIndex < 0 ? this.categoryOrder.length : firstIndex) -
            (secondIndex < 0 ? this.categoryOrder.length : secondIndex);
        }
        return this.compareNames(first.name, second.name);
      });
  },

  uniqueApplications(applications) {
    const seen = new Set();
    return applications.filter(application => {
      if (seen.has(application.id)) return false;
      seen.add(application.id);
      return true;
    });
  },

  buildView(applications, query) {
    const search = String(query || '').trim();
    const groups = this.groupApplications(applications);
    if (!search) return { mode: 'all', groups, autoOpenKey: '' };

    const normalizedSearch = this.normalizeText(search);
    const categoryMatches = groups.filter(group =>
      this.normalizeText(group.name).startsWith(normalizedSearch),
    );
    if (categoryMatches.length) {
      const autoOpenKey =
        categoryMatches.length === 1
          ? categoryMatches[0].key
          : this.everythingKey;
      return {
        mode: 'category',
        groups:
          categoryMatches.length > 1
            ? [
                {
                  key: this.everythingKey,
                  name: 'Everything',
                  applications: this.uniqueApplications(
                    categoryMatches.flatMap(group => group.applications),
                  ),
                  artificial: true,
                },
                ...categoryMatches,
              ]
            : categoryMatches,
        autoOpenKey,
      };
    }

    const matches = applications.filter(application => {
      const fields = [
        application.name,
        application.genericName,
        application.comment,
        application.id,
        ...(Array.isArray(application.keywords) ? application.keywords : []),
      ];
      return this.normalizeText(fields.join(' ')).includes(normalizedSearch);
    });
    const matchingGroups = this.groupApplications(matches);
    if (matchingGroups.length === 1) {
      return {
        mode: 'application',
        groups: matchingGroups,
        autoOpenKey: matchingGroups[0].key,
        highlightQuery: search,
      };
    }

    const everything = {
      key: this.everythingKey,
      name: 'Everything',
      applications: this.uniqueApplications(matches),
      artificial: true,
    };
    if (!matchingGroups.length) {
      everything.emptyMessage = 'No matching applications';
      return {
        mode: 'application',
        groups: [everything],
        autoOpenKey: this.everythingKey,
        highlightQuery: search,
      };
    }
    return {
      mode: 'application',
      groups: [everything, ...matchingGroups],
      autoOpenKey: this.everythingKey,
      highlightQuery: search,
    };
  },

  render(view = this.buildView(this.applications, this.searchTerm)) {
    if (!this.menu) return;
    this.menu.replaceChildren();
    if (this.loading) {
      this.renderStatus('Loading installed applications…');
      return;
    }
    if (!this.available) {
      this.renderStatus('Unable to load installed applications.');
      return;
    }
    if (!this.applications.length && !this.searchTerm.trim()) {
      this.renderStatus('No installed applications found.');
      return;
    }
    const hasMoreGroups = view.mode === 'all' && view.groups.length > this.maxVisibleCategories;
    const visibleGroups = hasMoreGroups
      ? view.groups.slice(0, this.maxVisibleCategories)
      : view.groups;
    visibleGroups.forEach(group => this.renderGroup(group, view));
    if (hasMoreGroups) {
      this.renderGroup(
        {
          key: '@more',
          name: 'More...',
          applications: [],
          subgroups: view.groups.slice(this.maxVisibleCategories),
        },
        view,
      );
    }
  },

  renderStatus(message) {
    const status = document.createElement('div');
    status.className = 'program-menu-status';
    status.setAttribute('role', 'status');
    status.textContent = message;
    this.menu.appendChild(status);
  },

  renderGroup(group, view, parentMenu = this.menu) {
    const hasSubgroups = Array.isArray(group.subgroups);
    const folder = document.createElement('div');
    folder.className = 'program-menu-folder';
    folder.dataset.programFolder = group.key;
    if (hasSubgroups) {
      folder.dataset.programMore = 'true';
    } else {
      folder.dataset.installedCategory = 'true';
    }
    if (group.artificial) folder.dataset.programArtificial = 'true';

    const trigger = document.createElement('button');
    trigger.className = 'program-menu-item';
    trigger.type = 'button';
    trigger.setAttribute('role', 'menuitem');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    const submenuId = `installed-app-category-${this.nextMenuId++}`;
    trigger.setAttribute('aria-controls', submenuId);

    const icon = document.createElement('img');
    icon.src = 'assets/windowsIcons/358(16x16).png';
    icon.alt = '';
    const label = document.createElement('span');
    label.textContent = group.name;
    const arrow = document.createElement('span');
    arrow.className = 'program-menu-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    trigger.append(icon, label, arrow);

    const submenu = document.createElement('div');
    submenu.className = 'program-submenu';
    submenu.id = submenuId;
    if (hasSubgroups) {
      submenu.dataset.programMoreMenu = 'true';
    } else {
      submenu.dataset.programCategory = group.key;
    }
    submenu.setAttribute('role', 'menu');
    submenu.setAttribute('aria-label', group.name);
    submenu.hidden = true;
    if (hasSubgroups) {
      for (const subgroup of group.subgroups) {
        this.renderGroup(subgroup, view, submenu);
      }
    } else if (!group.applications.length) {
      submenu.dataset.programEmpty = 'true';
      const empty = document.createElement('span');
      empty.className = 'program-menu-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = group.emptyMessage || 'No applications';
      submenu.appendChild(empty);
    } else {
      for (const application of group.applications) {
        submenu.appendChild(this.createApplicationItem(application, view));
      }
    }
    folder.append(trigger, submenu);
    parentMenu.appendChild(folder);
  },

  createApplicationItem(application, view) {
    const button = document.createElement('button');
    button.className = 'program-menu-item installed-app-item';
    button.type = 'button';
    button.dataset.installedAppId = application.id;
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-label', application.name);
    button.title = [application.name, application.genericName, application.comment]
      .filter(Boolean)
      .join('\n');

    const icon = document.createElement('img');
    icon.alt = '';
    icon.src = this.adapter?.fallbackIcon || 'assets/windowsIcons/windows.png';
    if (application.icon) icon.dataset.applicationIcon = application.icon;

    const label = document.createElement('span');
    const highlightQuery = view.mode === 'application' ? view.highlightQuery : '';
    const matchIndex = highlightQuery
      ? this.normalizeText(application.name).indexOf(this.normalizeText(highlightQuery))
      : -1;
    if (matchIndex < 0) {
      label.textContent = application.name;
    } else {
      const matchedText = application.name.slice(matchIndex, matchIndex + highlightQuery.length);
      label.append(document.createTextNode(application.name.slice(0, matchIndex)));
      const underline = document.createElement('u');
      underline.className = 'program-menu-match';
      underline.textContent = matchedText;
      label.append(
        underline,
        document.createTextNode(application.name.slice(matchIndex + matchedText.length)),
      );
    }
    button.append(icon, label);
    return button;
  },

  loadIcons(container) {
    if (
      !this.adapter?.resolveIcon ||
      !container ||
      container.dataset.programMoreMenu
    ) {
      return;
    }
    for (const image of container.querySelectorAll('img[data-application-icon]')) {
      const iconName = image.dataset.applicationIcon;
      if (!iconName || image.dataset.iconRequested) continue;
      image.dataset.iconRequested = 'true';
      this.adapter
        .resolveIcon(iconName)
        .then(source => {
          if (image.isConnected && source) image.src = source;
        })
        .catch(() => {});
    }
  },

  async launch(id) {
    if (!this.adapter?.request) return;
    await this.adapter.request('Application.Launch', { id: String(id) });
  },
};

window.XPStartMenuApps = XPStartMenuApps;
