/* BIMO Core — reusable client-side platform layer.
   Drop this file into any project and use the global `Bimo` object.
   Provides: secure storage, password hashing, account management
   (email/phone login), brute-force lockout, sessions with expiry,
   tamper-evident hash-chained audit trail and order ledger,
   PWA install handling, bring-your-own-key AI client, and backup. */
(function (global) {
  'use strict';

  const Bimo = {};

  /* ---------- storage (fail-safe wrappers) ---------- */
  Bimo.store = {
    get(key, fallback) {
      try {
        const raw = global.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { global.localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove(key) {
      try { global.localStorage.removeItem(key); } catch (e) {}
    }
  };

  /* ---------- crypto helpers ---------- */
  function bytesToHex(buf) {
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  Bimo.randomHex = function (bytes = 16) {
    const a = new Uint8Array(bytes);
    (global.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.fill(0);
    return bytesToHex(a);
  };
  Bimo.sha256 = async function (text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
    return bytesToHex(buf);
  };

  /* Passwords: salted SHA-256 (salt:hash). Legacy plaintext is upgraded on first
     successful login. Client-side hashing protects at-rest data but cannot replace
     a server; see results notes. */
  Bimo.makePassRecord = async function (pass) {
    const salt = Bimo.randomHex(16);
    return salt + ':' + (await Bimo.sha256(salt + ':' + pass));
  };
  Bimo.verifyPassRecord = async function (pass, user) {
    if (user.passHash) {
      const [salt, h] = String(user.passHash).split(':');
      return salt && h && (await Bimo.sha256(salt + ':' + pass)) === h;
    }
    return user.pass !== undefined && user.pass === pass;
  };

  /* ---------- validation ---------- */
  const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const RX_PHONE = /^\+?[0-9]{6,15}$/;
  const RX_URL = /^https?:\/\/[^\s]+\.[^\s]+$/i;
  Bimo.validate = {
    email: v => RX_EMAIL.test(String(v || '').trim()),
    phone: v => RX_PHONE.test(String(v || '').trim()),
    url: v => !v || RX_URL.test(String(v || '').trim()),
    password: p => {
      const s = String(p || '');
      if (s.length < 8) return 'Password must be at least 8 characters.';
      if (!/[A-Z]/.test(s) || !/[a-z]/.test(s)) return 'Password must include Capital & Lowercase letters.';
      return null;
    },
    text(v, max = 200) {
      return String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
    },
    amount(v) {
      const n = Math.round(parseFloat(v) * 100) / 100;
      return Number.isFinite(n) && n > 0 ? n : null;
    }
  };

  /* ---------- accounts ---------- */
  const USERS_KEY = 'bimo_users_db';
  const K = {
    users: () => USERS_KEY,
    sec: k => 'bimo_sec_' + k,
    audit: k => 'bimo_audit_' + k,
    ledger: k => 'bimo_ledger_' + k,
    orders: k => 'bimo_orders_' + k,
    lock: k => 'bimo_lock_' + k,
    session: 'bimo_active_user',
    theme: 'bimo_theme',
    ai: 'bimo_ai_config',
    gsi: 'bimo_google_client_id'
  };
  Bimo.keys = K;

  Bimo.accountKeyOf = function (user) {
    return String(user.gmail || user.email || user.phone || '').toLowerCase();
  };

  function getUsers() { return Bimo.store.get(K.users(), {}); }
  function setUsers(users) { Bimo.store.set(K.users(), users); }

  Bimo.accounts = {
    list: getUsers,
    find(identifier) {
      const id = String(identifier || '').trim().toLowerCase();
      if (!id) return null;
      const users = getUsers();
      return users[id] || Object.values(users).find(u =>
        String(u.phone || '').replace(/[^0-9]/g, '') === id.replace(/[^0-9]/g, '')) || null;
    },
    keyOfIdentifier(identifier) {
      const u = Bimo.accounts.find(identifier);
      return u ? Bimo.accountKeyOf(u) : String(identifier || '').trim().toLowerCase();
    },
    async create(profile) {
      const users = getUsers();
      const email = Bimo.validate.email(profile.email) ? profile.email.trim().toLowerCase() : '';
      const phone = Bimo.validate.phone(profile.phone) ? profile.phone.trim() : '';
      if (!email && !phone) return { error: 'A valid email or phone number is required.' };
      if (profile.email && !email) return { error: 'The email address is not valid.' };
      if (profile.phone && !phone) return { error: 'The phone number is not valid (use digits, optional +). ' };
      if (email && users[email]) return { error: 'An account with this email already exists.' };
      if (phone) {
        const digits = phone.replace(/[^0-9]/g, '');
        const phoneTaken = Object.values(users).some(u => String(u.phone || '').replace(/[^0-9]/g, '') === digits);
        if (phoneTaken) return { error: 'An account with this phone already exists.' };
      }
      const key = email || phone;
      if (users[key]) return { error: 'An account with these details already exists.' };
      const user = {
        key, email, phone,
        brandName: Bimo.validate.text(profile.brandName, 60),
        brandType: Bimo.validate.text(profile.brandType, 30) || 'Other',
        brandUrl: Bimo.validate.url(profile.brandUrl) ? String(profile.brandUrl).trim() : '',
        logo: typeof profile.logo === 'string' && profile.logo.startsWith('data:image/') ? profile.logo : '',
        provider: profile.provider === 'google' ? 'google' : 'local',
        created: Date.now()
      };
      if (profile.pass) user.passHash = await Bimo.makePassRecord(profile.pass);
      user.sec = Bimo.randomHex(32);
      users[key] = user;
      setUsers(users);
      Bimo.audit.log(key, 'ACCOUNT_CREATED', { provider: user.provider });
      return { user };
    },
    save(user) {
      const users = getUsers();
      users[Bimo.accountKeyOf(user)] = user;
      setUsers(users);
    },
    remove(key) {
      const users = getUsers();
      delete users[key];
      setUsers(users);
      [K.sec(key), K.audit(key), K.ledger(key), K.orders(key), K.lock(key)].forEach(Bimo.store.remove);
    }
  };

  /* ---------- brute-force lockout ---------- */
  const MAX_FAILS = 5;
  const LOCK_MS = 5 * 60 * 1000;
  Bimo.loginLock = {
    check(key) {
      const l = Bimo.store.get(K.lock(key), null);
      if (l && l.until > Date.now()) return Math.ceil((l.until - Date.now()) / 60000);
      return 0;
    },
    fail(key) {
      const l = Bimo.store.get(K.lock(key), { n: 0, until: 0 });
      l.n += 1;
      if (l.n >= MAX_FAILS) { l.until = Date.now() + LOCK_MS; l.n = 0; }
      Bimo.store.set(K.lock(key), l);
    },
    clear(key) { Bimo.store.remove(K.lock(key)); }
  };

  /* ---------- login / session ---------- */
  const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

  Bimo.auth = {
    async login(identifier, pass) {
      const user = Bimo.accounts.find(identifier);
      if (!user) return { error: 'No account found for that email or phone.' };
      const key = Bimo.accountKeyOf(user);
      const mins = Bimo.loginLock.check(key);
      if (mins > 0) return { error: `Too many failed attempts. Try again in ${mins} minute(s).` };
      if (!(await Bimo.verifyPassRecord(pass, user))) {
        Bimo.loginLock.fail(key);
        Bimo.audit.log(key, 'LOGIN_FAILED', {});
        const left = MAX_FAILS - Bimo.store.get(K.lock(key), { n: 0 }).n;
        return { error: `Incorrect password. ${left} attempt(s) left before a temporary lock.` };
      }
      if (!user.passHash && user.pass !== undefined) {
        user.passHash = await Bimo.makePassRecord(pass);
        delete user.pass;
        Bimo.accounts.save(user);
      }
      Bimo.loginLock.clear(key);
      Bimo.audit.log(key, 'LOGIN_SUCCESS', {});
      return { user: Bimo.session.start(user) };
    },
    async changePassword(user, currentPass, newPass) {
      if (!(await Bimo.verifyPassRecord(currentPass, user))) return { error: 'Current password is incorrect.' };
      const err = Bimo.validate.password(newPass);
      if (err) return { error: err };
      user.passHash = await Bimo.makePassRecord(newPass);
      delete user.pass;
      Bimo.accounts.save(user);
      Bimo.audit.log(Bimo.accountKeyOf(user), 'PASSWORD_CHANGED', {});
      return { ok: true };
    },
    async resetPassword(key, newPass) {
      const users = getUsers();
      if (!users[key]) return { error: 'Account not found.' };
      const err = Bimo.validate.password(newPass);
      if (err) return { error: err };
      users[key].passHash = await Bimo.makePassRecord(newPass);
      delete users[key].pass;
      setUsers(users);
      Bimo.audit.log(key, 'PASSWORD_RESET', {});
      return { ok: true };
    }
  };

  Bimo.session = {
    start(user) {
      user.sessionExp = Date.now() + SESSION_MS;
      Bimo.store.set(K.session, user);
      return user;
    },
    active() {
      const user = Bimo.store.get(K.session, null);
      if (!user) return null;
      if (!user.sessionExp || user.sessionExp < Date.now()) { Bimo.session.end(); return null; }
      return user;
    },
    end() { Bimo.store.remove(K.session); }
  };

  /* ---------- hash-chained audit trail (tamper-evident) ---------- */
  Bimo.audit = {
    async log(key, event, details) {
      const list = Bimo.store.get(K.audit(key), []);
      const prev = list.length ? list[list.length - 1].h : '';
      const entry = { t: Date.now(), event: String(event).slice(0, 40), d: details || {} };
      entry.h = await Bimo.sha256(prev + '|' + (Bimo.store.get(K.sec(key), '')) + '|' + JSON.stringify(entry));
      list.push(entry);
      if (list.length > 200) list.splice(0, list.length - 200);
      Bimo.store.set(K.audit(key), list);
    },
    list(key) { return Bimo.store.get(K.audit(key), []); },
    async verify(key) {
      const list = Bimo.store.get(K.audit(key), []);
      let prev = '';
      for (const e of list) {
        const { h, ...rest } = e;
        const expect = await Bimo.sha256(prev + '|' + Bimo.store.get(K.sec(key), '') + '|' + JSON.stringify(rest));
        if (expect !== h) return false;
        prev = h;
      }
      return true;
    }
  };

  /* ---------- tamper-evident order ledger ---------- */
  Bimo.ledger = {
    async sign(key, orders) {
      const sec = Bimo.store.get(K.sec(key), '');
      const sig = await Bimo.sha256(sec + '|' + JSON.stringify(orders || []));
      Bimo.store.set(K.ledger(key), { n: (orders || []).length, sig });
      return sig;
    },
    async verify(key, orders) {
      const meta = Bimo.store.get(K.ledger(key), null);
      if (!meta) return true; // never signed yet (fresh account)
      const sec = Bimo.store.get(K.sec(key), '');
      const sig = await Bimo.sha256(sec + '|' + JSON.stringify(orders || []));
      return meta.sig === sig && meta.n === (orders || []).length;
    }
  };

  /* ---------- PWA install ---------- */
  Bimo.install = (function () {
    let deferred = null;
    const listeners = new Set();
    function isStandalone() {
      return global.matchMedia('(display-mode: standalone)').matches || global.navigator.standalone === true;
    }
    function emit() { listeners.forEach(fn => fn(deferred && !isStandalone())); }
    global.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferred = e;
      emit();
    });
    global.addEventListener('appinstalled', () => {
      deferred = null;
      emit();
    });
    return {
      available(fn) { if (typeof fn === 'function') listeners.add(fn); emit(); },
      async prompt() {
        if (!deferred) return { ok: false, reason: 'unavailable' };
        deferred.prompt();
        const choice = await deferred.userChoice;
        deferred = null;
        emit();
        return { ok: choice.outcome === 'accepted' };
      }
    };
  })();

  /* ---------- bring-your-own-key AI client (OpenAI-compatible) ---------- */
  const AI_PRESETS = {
    openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.1-8b-instant' },
    openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
    custom: { label: 'Custom (OpenAI-compatible)', baseUrl: '', model: '' }
  };
  Bimo.ai = {
    presets: AI_PRESETS,
    getConfig() { return Bimo.store.get(K.ai, { provider: '', baseUrl: '', apiKey: '', model: '' }); },
    saveConfig(cfg) {
      Bimo.store.set(K.ai, {
        provider: Bimo.validate.text(cfg.provider, 20),
        baseUrl: Bimo.validate.url(cfg.baseUrl) ? String(cfg.baseUrl).trim() : '',
        apiKey: String(cfg.apiKey || '').trim(),
        model: Bimo.validate.text(cfg.model, 60)
      });
    },
    configured() {
      const c = Bimo.ai.getConfig();
      return Boolean(c.apiKey && c.baseUrl && c.model);
    },
    async chat(messages) {
      const c = Bimo.ai.getConfig();
      if (!Bimo.ai.configured()) return { error: 'No AI provider configured. Add your API key in Settings → AI.' };
      try {
        const res = await fetch(c.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
          body: JSON.stringify({ model: c.model, messages, max_tokens: 500 })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: (data.error && data.error.message) || ('API error ' + res.status) };
        const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        return content ? { text: content } : { error: 'Empty response from provider.' };
      } catch (e) {
        return { error: 'Network error while contacting the AI provider.' };
      }
    }
  };

  /* ---------- backup / restore ---------- */
  Bimo.backup = {
    exportFor(user) {
      const key = Bimo.accountKeyOf(user);
      return {
        bimoBackup: 1,
        version: 1,
        exportedAt: new Date().toISOString(),
        profile: { key, email: user.email, phone: user.phone, brandName: user.brandName, brandType: user.brandType, brandUrl: user.brandUrl, logo: user.logo || '' },
        orders: Bimo.store.get(K.orders(key), []),
        audit: Bimo.audit.list(key)
      };
    },
    async importFor(user, data) {
      if (!data || data.bimoBackup !== 1 || !Array.isArray(data.orders)) return { error: 'Not a valid BIMO backup file.' };
      const key = Bimo.accountKeyOf(user);
      const clean = data.orders.filter(o => o && o.id && o.customer && Number.isFinite(parseFloat(o.amount)));
      await Bimo.ledger.sign(key, clean);
      Bimo.store.set(K.orders(key), clean);
      if (Array.isArray(data.audit)) Bimo.store.set(K.audit(key), data.audit.slice(-200));
      if (data.profile && typeof data.profile === 'object') {
        ['brandName', 'brandType', 'brandUrl', 'logo'].forEach(f => {
          if (typeof data.profile[f] === 'string') user[f] = data.profile[f];
        });
        Bimo.accounts.save(user);
      }
      Bimo.audit.log(key, 'BACKUP_IMPORTED', { orders: clean.length });
      return { ok: true, orders: clean.length };
    }
  };

  global.Bimo = Bimo;
})(window);
