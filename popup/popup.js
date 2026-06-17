const KEY = 'af_rules';

async function loadRules() {
  const data = await chrome.storage.local.get(KEY);
  return data[KEY] || [];
}

async function saveRules(rules) {
  await chrome.storage.local.set({ [KEY]: rules });
}

async function render() {
  const rules = await loadRules();
  const list = document.getElementById('rules-list');
  const countEl = document.getElementById('total-count');

  countEl.textContent = rules.length;
  list.innerHTML = '';

  if (!rules.length) {
    list.innerHTML = '<div class="empty">אין כללים עדיין.<br>לחץ ימני על שדה כלשהו כדי להתחיל.</div>';
    return;
  }

  // Resolve matchType/matchValue (backward-compat with old domain-only rules).
  const resolved = rules.map(r => {
    const matchType = r.matchType || (r.domain === '*' ? 'global' : r.domain ? 'domain' : 'global');
    const matchValue = r.matchValue ?? (matchType === 'domain' ? r.domain : '');
    return { ...r, _matchType: matchType, _matchValue: matchValue };
  });

  // Group by match type + value.
  const groups = {};
  resolved.forEach(r => {
    const key = r._matchType === 'global' ? '__global__' : `${r._matchType}::${r._matchValue}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  const groupTitle = key => {
    if (key === '__global__') return '🌐 גלובלי';
    const [type, value] = key.split('::');
    if (type === 'domain') return `🌍 ${value}`;
    if (type === 'url-contains') return `🔗 URL מכיל: ${value}`;
    return value;
  };

  const orderedKeys = ['__global__', ...Object.keys(groups).filter(k => k !== '__global__')];

  orderedKeys.forEach(key => {
    if (!groups[key]) return;
    const titleEl = document.createElement('div');
    titleEl.className = 'af-group-title';
    titleEl.textContent = groupTitle(key);
    list.appendChild(titleEl);

    groups[key].forEach(rule => {
      const row = document.createElement('div');
      row.className = 'af-rule-row';

      row.innerHTML = `
        <div class="af-rule-info">
          <div class="af-rule-label">${escHtml(rule.label || rule.selector)}</div>
          <div class="af-rule-meta">${escHtml(rule.selector)} · ${rule.options?.length || 0} אפשרויות</div>
        </div>
        <label class="af-toggle">
          <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-id="${rule.id}">
          <span class="af-slider"></span>
        </label>
        <button class="af-del-btn" data-id="${rule.id}" title="מחק">×</button>
      `;

      row.querySelector('input[type=checkbox]').addEventListener('change', async e => {
        const all = await loadRules();
        const updated = all.map(r => r.id === rule.id ? { ...r, enabled: e.target.checked } : r);
        await saveRules(updated);
      });

      row.querySelector('.af-del-btn').addEventListener('click', async () => {
        const all = await loadRules();
        await saveRules(all.filter(r => r.id !== rule.id));
        render();
      });

      list.appendChild(row);
    });
  });
}

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

render();

// --- Credentials section ---

function loadCredSection() {
  chrome.storage.local.get('af_credential', (res) => {
    const cred = res.af_credential;
    const status = document.getElementById('cred-status');
    if (cred && cred.username) {
      status.textContent = `מוגדר: ${cred.username}`;
      status.style.color = '#2a7a2a';
    } else {
      status.textContent = 'לא מוגדר';
      status.style.color = '#888';
    }
  });
}

document.getElementById('cred-save').addEventListener('click', () => {
  const u = document.getElementById('cred-username').value.trim();
  const p = document.getElementById('cred-password').value;
  if (!u && !p) return;
  chrome.storage.local.set({ af_credential: { username: u, password: p } }, loadCredSection);
});

document.getElementById('cred-clear').addEventListener('click', () => {
  chrome.storage.local.remove('af_credential', () => {
    document.getElementById('cred-username').value = '';
    document.getElementById('cred-password').value = '';
    loadCredSection();
  });
});

document.getElementById('cred-toggle').addEventListener('click', () => {
  const pw = document.getElementById('cred-password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
});

loadCredSection();
