document.addEventListener('DOMContentLoaded', () => {
  // DOM references
  const listEl = document.getElementById('extension-list');
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = {
    toggle: document.getElementById('tab-toggle'),
    mapping: document.getElementById('tab-mapping'),
    view: document.getElementById('tab-view'),
  };
  const themeToggle = document.getElementById('theme-toggle');
  const searchInput = document.getElementById('search-input');
  const closeButton = document.getElementById('close-button');

  const mappingListEl = document.getElementById('mapping-list');
  const resetKeysButton = document.getElementById('reset-keys-button');
  const columnsSelect = document.getElementById('columns-select');
  const maxHeightSelect = document.getElementById('max-height-select');

  // State
  let keyBindings = {};            // "a", "aa" -> toggle function
  let keyMappings = {};            // extensionId -> "a", "aa", ...
  let mappingFilter = '';          // text filter for Key Mapping tab

  let allExtensions = [];          // chrome.management.getAll() result
  let currentFilter = '';          // text filter for Toggle Keys tab

  let viewOptions = {
    columnsPerRow: 3,
    maxHeight: 600,
  };

  // Key sequence state (for 2-letter keys)
  let twoLetterPrefixes = new Set();
  let keySequence = '';
  let keySequenceTimer = null;
  const KEY_SEQUENCE_TIMEOUT = 250; // ms

  // chrome.storage availability
  let hasStorage = false;
  try {
    if (
      typeof chrome !== 'undefined' &&
      typeof chrome.storage !== 'undefined' &&
      typeof chrome.storage.local !== 'undefined'
    ) {
      hasStorage = true;
    }
  } catch (e) {
    hasStorage = false;
  }

  // 0 -> a, 1 -> b, ..., 25 -> z, 26 -> aa, 27 -> ab ...
  function indexToKey(index) {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let n = index;
    let s = '';

    do {
      s = letters[n % 26] + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);

    return s;
  }

  // Initialization
  initTabs();
  initThemeFromStorage();
  initThemeToggle();
  initCloseButton();
  initFindShortcut();
  initSearch();
  initMappingSearch();
  initKeyMappingReset();
  initViewOptionsHandlers();
  loadKeyMappingsAndExtensions();
  initKeyListener();

  // -----------------------------
  // Tabs
  // -----------------------------

  function initTabs() {
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        Object.entries(panels).forEach(([name, panel]) => {
          if (!panel) return;
          panel.classList.toggle('active', name === target);
        });

        if (hasStorage) {
          chrome.storage.local.set({ activeTab: target });
        }
      });
    });
  }

  function restoreActiveTab(tabName) {
    const target = tabName || 'toggle';
    const tab = tabs.find((t) => t.dataset.tab === target);
    if (!tab) return;

    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    Object.entries(panels).forEach(([name, panel]) => {
      if (!panel) return;
      panel.classList.toggle('active', name === target);
    });
  }

  // -----------------------------
  // Theme
  // -----------------------------

  function initThemeFromStorage() {
    const body = document.body;

    if (!hasStorage) {
      body.classList.add('theme-light');
      return;
    }

    chrome.storage.local.get({ theme: 'light' }, (data) => {
      const theme = data.theme === 'dark' ? 'dark' : 'light';
      body.classList.remove('theme-light', 'theme-dark');
      body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    });
  }

  function initThemeToggle() {
    if (!themeToggle) return;

    themeToggle.addEventListener('click', () => {
      const body = document.body;
      const isDarkNow = body.classList.contains('theme-dark');
      const nextTheme = isDarkNow ? 'light' : 'dark';

      body.classList.remove('theme-light', 'theme-dark');
      body.classList.add(nextTheme === 'dark' ? 'theme-dark' : 'theme-light');

      if (hasStorage) {
        chrome.storage.local.set({ theme: nextTheme });
      }
    });
  }

  // -----------------------------
  // Window controls
  // -----------------------------

  function initCloseButton() {
    if (!closeButton) return;
    closeButton.addEventListener('click', () => {
      window.close();
    });
  }

  // -----------------------------
  // Search (Ctrl+F / Cmd+F)
  // -----------------------------

  function initFindShortcut() {
    document.addEventListener('keydown', (event) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const isFindKey =
        (isMac && event.metaKey && event.key === 'f') ||
        (!isMac && event.ctrlKey && event.key === 'f');

      if (!isFindKey) return;

      const activeTab = document.querySelector('.tab.active');
      if (!activeTab) return;

      event.preventDefault();

      if (activeTab.dataset.tab === 'toggle') {
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (activeTab.dataset.tab === 'mapping') {
        const mappingSearchInput = document.getElementById('mapping-search-input');
        if (mappingSearchInput) {
          mappingSearchInput.focus();
          mappingSearchInput.select();
        }
      }
    });
  }

  // -----------------------------
  // Toggle tab search
  // -----------------------------

  function initSearch() {
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
      currentFilter = searchInput.value.trim().toLowerCase();
      const filtered = getFilteredExtensions();
      renderExtensionList(filtered);
    });

    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        searchInput.blur();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        searchInput.value = '';
        currentFilter = '';
        const filtered = getFilteredExtensions();
        renderExtensionList(filtered);
        searchInput.blur();
      }
    });
  }

  function getFilteredExtensions() {
    if (!currentFilter) {
      return allExtensions.slice();
    }
    return allExtensions.filter((ext) =>
      ext.name.toLowerCase().includes(currentFilter)
    );
  }

  // -----------------------------
  // Key Mapping search
  // -----------------------------

  function initMappingSearch() {
    const mappingSearchInput = document.getElementById('mapping-search-input');
    if (!mappingSearchInput) return;

    mappingSearchInput.addEventListener('input', () => {
      mappingFilter = mappingSearchInput.value.trim().toLowerCase();
      renderMappingList(allExtensions);
    });
  }

  // -----------------------------
  // Key Mapping reset
  // -----------------------------

  function initKeyMappingReset() {
    if (!resetKeysButton) return;

    resetKeysButton.addEventListener('click', () => {
      if (!confirm('Reset all key mappings?')) return;

      keyMappings = {};
      saveKeyMappings();

      const filtered = getFilteredExtensions();
      renderExtensionList(filtered);
      renderMappingList(allExtensions);
    });
  }

  // -----------------------------
  // View Options
  // -----------------------------

  function initViewOptionsHandlers() {
    if (columnsSelect) {
      columnsSelect.addEventListener('change', () => {
        const val = parseInt(columnsSelect.value, 10);
        if (!Number.isNaN(val) && val >= 1 && val <= 6) {
          viewOptions.columnsPerRow = val;
          applyViewOptions();
          saveViewOptions();

          const filtered = getFilteredExtensions();
          renderExtensionList(filtered);
        }
      });
    }

    if (maxHeightSelect) {
      maxHeightSelect.addEventListener('change', () => {
        const val = parseInt(maxHeightSelect.value, 10);
        if (!Number.isNaN(val) && val >= 360 && val <= 800) {
          viewOptions.maxHeight = val;
          applyViewOptions();
          saveViewOptions();
        }
      });
    }
  }

  function applyViewOptions() {
    const cols = viewOptions.columnsPerRow || 3;
    const maxH = viewOptions.maxHeight || 600;

    if (listEl) {
      listEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    }

    const clampedMaxH = Math.max(360, Math.min(maxH, 800));
    document.documentElement.style.maxHeight = `${clampedMaxH}px`;
    document.body.style.maxHeight = `${clampedMaxH}px`;

    const baseWidthPerCol = 220;
    const idealWidth = cols * baseWidthPerCol;
    const maxPopupWidth = 800;
    const finalWidth = Math.min(idealWidth, maxPopupWidth);

    document.documentElement.style.width = `${finalWidth}px`;
    document.body.style.width = `${finalWidth}px`;

    if (columnsSelect) {
      columnsSelect.value = String(cols);
    }
    if (maxHeightSelect) {
      maxHeightSelect.value = String(clampedMaxH);
    }
  }

  // -----------------------------
  // Storage load / save
  // -----------------------------

  function loadKeyMappingsAndExtensions() {
    if (!hasStorage) {
      keyMappings = {};
      viewOptions = { columnsPerRow: 3, maxHeight: 600 };
      applyViewOptions();
      loadExtensions();
      return;
    }

    chrome.storage.local.get(
      {
        keyMappings: {},
        viewOptions: { columnsPerRow: 3, maxHeight: 600 },
        activeTab: 'toggle',
      },
      (data) => {
        keyMappings = data.keyMappings || {};
        viewOptions = data.viewOptions || { columnsPerRow: 3, maxHeight: 600 };
        applyViewOptions();
        restoreActiveTab(data.activeTab || 'toggle');
        loadExtensions();
      }
    );
  }

  function saveKeyMappings() {
    if (!hasStorage) return;
    chrome.storage.local.set({ keyMappings });
  }

  function saveViewOptions() {
    if (!hasStorage) return;
    chrome.storage.local.set({ viewOptions });
  }

  function loadExtensions() {
    if (!listEl) return;

    chrome.management.getAll((extensions) => {
      extensions.sort((a, b) => a.name.localeCompare(b.name));
      extensions = extensions.filter(
        (ext) => ext.type === 'extension' && ext.id !== chrome.runtime.id
      );

      allExtensions = extensions;

      const toRender = getFilteredExtensions();
      renderExtensionList(toRender);
      renderMappingList(allExtensions);
    });
  }

  // -----------------------------
  // Toggle Keys list (auto key assignment)
  // -----------------------------

  function renderExtensionList(extensions) {
    listEl.innerHTML = '';
    keyBindings = {};
    twoLetterPrefixes = new Set();

    const usedKeys = new Set(
      Object.values(keyMappings)
        .filter(Boolean)
        .map((k) => k.toLowerCase())
    );

    let nextIndex = 0;
    let needsSave = false;

    function getNextAutoKey() {
      while (true) {
        const candidate = indexToKey(nextIndex);
        nextIndex++;
        const lower = candidate.toLowerCase();
        if (!usedKeys.has(lower)) {
          usedKeys.add(lower);
          return candidate;
        }
      }
    }

    extensions.forEach((extension) => {
      let key = keyMappings[extension.id];

      if (!key) {
        key = getNextAutoKey();
        keyMappings[extension.id] = key;
        needsSave = true;
      }

      const item = document.createElement('li');
      item.className = 'extension-item';

      if (key) {
        const keyLabel = document.createElement('span');
        keyLabel.className = 'key-label';
        keyLabel.textContent = `Key: ${key}`;
        item.appendChild(keyLabel);
      }

      const extensionContainer = document.createElement('div');
      extensionContainer.className = 'extension-container';

      const img = document.createElement('img');
      img.className = 'extension-icon';
      const iconUrl =
        extension.icons && extension.icons.length > 0
          ? extension.icons[0].url
          : 'default-icon.png';
      img.src = iconUrl;

      const extensionNameSpan = document.createElement('span');
      extensionNameSpan.textContent = extension.name;
      extensionNameSpan.className = 'extension-name';

      extensionContainer.appendChild(img);
      extensionContainer.appendChild(extensionNameSpan);
      item.appendChild(extensionContainer);

      const toggleButton = document.createElement('button');
      updateButtonLabel(extension, toggleButton);

      toggleButton.onclick = () => {
        chrome.management.get(extension.id, (currentExt) => {
          chrome.management.setEnabled(
            currentExt.id,
            !currentExt.enabled,
            () => {
              chrome.management.get(currentExt.id, (updatedExt) => {
                updateButtonLabel(updatedExt, toggleButton);
              });
            }
          );
        });
      };

      item.appendChild(toggleButton);
      listEl.appendChild(item);

      if (key) {
        const lower = key.toLowerCase();
        keyBindings[lower] = toggleButton.onclick;
        if (lower.length === 2) {
          twoLetterPrefixes.add(lower[0]);
        }
      }
    });

    if (needsSave) {
      saveKeyMappings();
    }
  }

  function updateButtonLabel(extension, button) {
    button.textContent = extension.enabled ? 'Disable' : 'Enable';
    button.className = extension.enabled ? 'disable-button' : 'enable-button';
  }

  // -----------------------------
  // Key Mapping list
  // -----------------------------

  function renderMappingList(extensions) {
    if (!mappingListEl) return;
    mappingListEl.innerHTML = '';

    const sorted = extensions
      .filter((ext) =>
        !mappingFilter
          ? true
          : ext.name.toLowerCase().includes(mappingFilter)
      )
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach((extension) => {
      const li = document.createElement('li');
      li.className = 'mapping-item';

      const iconImg = document.createElement('img');
      iconImg.className = 'mapping-icon';
      const iconUrl =
        extension.icons && extension.icons.length > 0
          ? extension.icons[0].url
          : 'default-icon.png';
      iconImg.src = iconUrl;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'mapping-name';
      nameSpan.textContent = extension.name;

      const keyLabel = document.createElement('span');
      keyLabel.className = 'mapping-key-label';
      const currentKey = keyMappings[extension.id] || '-';
      keyLabel.textContent = `Key: ${currentKey}`;

      const input = document.createElement('input');
      input.className = 'mapping-key-input';
      input.type = 'text';
      input.maxLength = 2;
      input.value = currentKey !== '-' ? currentKey : '';

      const errorSpan = document.createElement('span');
      errorSpan.className = 'mapping-error';
      errorSpan.textContent = '';

      input.addEventListener('focus', () => {
        input.select();
        errorSpan.textContent = '';
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyKeyChange(extension, input, keyLabel, errorSpan);
          input.blur();
        }
      });

      input.addEventListener('blur', () => {
        applyKeyChange(extension, input, keyLabel, errorSpan);
      });

      li.appendChild(iconImg);
      li.appendChild(nameSpan);
      li.appendChild(keyLabel);
      li.appendChild(input);
      li.appendChild(errorSpan);
      mappingListEl.appendChild(li);
    });
  }

  // -----------------------------
  // Key Mapping change
  // -----------------------------

  function applyKeyChange(extension, inputEl, labelEl, errorEl) {
    const prevKey = keyMappings[extension.id] || '';
    if (errorEl) {
      errorEl.textContent = '';
    }

    let raw = (inputEl.value || '').trim().toLowerCase();

    // Empty -> remove key
    if (!raw) {
      delete keyMappings[extension.id];
      labelEl.textContent = 'Key: -';
      inputEl.value = '';
      saveKeyMappings();

      const filtered = getFilteredExtensions();
      renderExtensionList(filtered);
      renderMappingList(allExtensions);
      return;
    }

    // Validation: 1–2 letters a–z only
    if (raw.length > 2 || !/^[a-z]+$/.test(raw)) {
      inputEl.value = prevKey;
      if (errorEl) {
        errorEl.textContent = 'Key must be 1–2 letters (a–z).';
      }
      return;
    }

    const newKey = raw;

    // Find conflicts: other extensions already using this key
    const conflicts = allExtensions.filter((ext) => {
      if (ext.id === extension.id) return false;
      const k = keyMappings[ext.id];
      return k && k.toLowerCase() === newKey;
    });

    // If there are conflicts, ask for confirmation
    if (conflicts.length > 0) {
      const names = conflicts.map((ext) => ext.name).join(', ');
      const ok = confirm(
        `Key '${newKey}' is already used by: ${names}.\n\n` +
        'Replace the key there and assign it to this extension?'
      );
      if (!ok) {
        inputEl.value = prevKey;
        return;
      }
    }

    // Remove key from all conflicting extensions
    for (const ext of conflicts) {
      delete keyMappings[ext.id];
    }

    // Assign new key to current extension
    keyMappings[extension.id] = newKey;
    labelEl.textContent = `Key: ${newKey}`;
    inputEl.value = newKey;

    saveKeyMappings();

    // Update both views so duplicates disappear everywhere
    const filtered = getFilteredExtensions();
    renderExtensionList(filtered);
    renderMappingList(allExtensions);

    if (errorEl) {
      if (conflicts.length > 0) {
        errorEl.textContent =
          `Key reassigned from ${conflicts.length} other extension(s).`;
      } else {
        errorEl.textContent = '';
      }
    }
  }

  // -----------------------------
  // Keyboard listener (Toggle Keys)
  // -----------------------------

  function initKeyListener() {
    document.addEventListener('keydown', (event) => {
      const activeTab = document.querySelector('.tab.active');
      if (!activeTab || activeTab.dataset.tab !== 'toggle') return;

      const target = event.target;
      const tag = target.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        return;
      }

      // 영문자 물리키 위치만 허용 (KeyA ~ KeyZ: QWERTY 알파벳 키)
      const code = event.code;
      if (!/^Key[a-zA-Z]$/.test(code)) {
        return;
      }

      // 키 시퀀스 로직: code 기준으로
      if (keySequenceTimer) {
        clearTimeout(keySequenceTimer);
        keySequenceTimer = null;
      }

      const ch = code.slice(3).toLowerCase();

      keySequence += ch;
      if (keySequence.length > 2) {
        keySequence = ch;
      }

      const seq = keySequence;
      const hasExact = !!keyBindings[seq];
      const hasLonger = seq.length === 1 && twoLetterPrefixes.has(seq);

      if (hasExact && !hasLonger) {
        keyBindings[seq]();
        keySequence = '';
        event.preventDefault();
        return;
      }

      keySequenceTimer = setTimeout(() => {
        const finalSeq = keySequence;
        keySequence = '';
        if (keyBindings[finalSeq]) {
          keyBindings[finalSeq]();
        }
      }, KEY_SEQUENCE_TIMEOUT);
    });
  }
});
