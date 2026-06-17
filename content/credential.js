// Credential storage and field detection for global username/password autofill.
// Exports window.__afCredential.

// Kill switch: set to false to disable the credential feature entirely
// (dropdown will not offer saved username/password on any field).
const AF_CREDENTIAL_ENABLED = true;

(() => {
  if (window.__afCredential) return;
  if (!AF_CREDENTIAL_ENABLED) return;

  const CRED_KEY = 'af_credential';

  function load() {
    return new Promise(resolve => {
      chrome.storage.local.get(CRED_KEY, res => {
        resolve(res[CRED_KEY] || null);
      });
    });
  }

  function save(username, password) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [CRED_KEY]: { username, password } }, resolve);
    });
  }

  function clear() {
    return new Promise(resolve => {
      chrome.storage.local.remove(CRED_KEY, resolve);
    });
  }

  // Collect every textual signal a developer might use to label a field.
  function fieldSignals(el) {
    const attrs = [
      el.id, el.name, el.className, el.placeholder, el.title,
      el.autocomplete, el.getAttribute('aria-label'), el.getAttribute('aria-labelledby'),
      el.getAttribute('formcontrolname'), el.getAttribute('ng-reflect-name'),
      el.getAttribute('data-testid'), el.getAttribute('data-test'),
      el.getAttribute('data-qa'), el.getAttribute('data-cy'),
      el.getAttribute('data-field'), el.getAttribute('data-name'),
      el.getAttribute('data-role'),
    ];
    // Label linked by `for=` or wrapping <label>.
    try {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) attrs.push(lbl.textContent);
      }
      const wrap = el.closest('label');
      if (wrap) attrs.push(wrap.textContent);
      // aria-labelledby resolution
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        labelledBy.split(/\s+/).forEach(id => {
          const node = document.getElementById(id);
          if (node) attrs.push(node.textContent);
        });
      }
    } catch (_) { /* ignore */ }
    return attrs.filter(Boolean).join(' ').toLowerCase();
  }

  function isAcceptableInputType(el) {
    if (el.tagName !== 'INPUT') return false;
    const type = (el.type || 'text').toLowerCase();
    // Anything that can hold text. Excludes pickers/buttons.
    return !['checkbox', 'radio', 'file', 'submit', 'button', 'image', 'range', 'color', 'hidden'].includes(type);
  }

  function isUsernameField(el) {
    if (!el || !isAcceptableInputType(el)) return false;
    const type = (el.type || 'text').toLowerCase();
    if (['email', 'tel'].includes(type)) return true;
    const ac = (el.autocomplete || '').toLowerCase();
    if (['username', 'email', 'nickname'].includes(ac)) return true;
    const sig = fieldSignals(el);
    // Hebrew + English terms commonly used for user identifier fields.
    const terms = [
      'username', 'user-name', 'user_name', 'userid', 'user-id', 'user_id',
      'user', 'login', 'loginid', 'login-id', 'login_id', 'signin', 'sign-in',
      'email', 'e-mail', 'mail', 'account', 'identifier', 'ident',
      'משתמש', 'מייל', 'אימייל', 'דוא"ל', 'דואל', 'דואר', 'התחברות', 'כניסה', 'חשבון', 'מזהה',
    ];
    return terms.some(t => sig.includes(t));
  }

  function isPasswordField(el) {
    if (!el || !isAcceptableInputType(el)) return false;
    if ((el.type || '').toLowerCase() === 'password') return true;
    const ac = (el.autocomplete || '').toLowerCase();
    if (['current-password', 'new-password', 'one-time-code'].includes(ac)) return true;
    // Sites that mask via CSS / web-component while leaving type="text".
    const inputmode = (el.getAttribute('inputmode') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const sig = fieldSignals(el);
    const terms = [
      'password', 'passwd', 'pwd', 'pass-word', 'pass_word',
      'secret', 'passcode', 'pin-code', 'pincode',
      'סיסמ', 'סיסמא', 'סיסמה', 'קוד סודי', 'קוד אישי',
    ];
    if (terms.some(t => sig.includes(t))) return true;
    // Class hint patterns: ".password-control", ".password-astrix", "-pass-"
    if (/(^|[-_ ])(password|passwd|pwd|pass)([-_ ]|$)/.test(sig)) return true;
    if (ariaLabel && /(password|סיסמ)/.test(ariaLabel)) return true;
    // Masked via inputmode + role hints (rare fallback)
    if (inputmode === 'password') return true;
    return false;
  }

  window.__afCredential = { load, save, clear, isUsernameField, isPasswordField };
})();
