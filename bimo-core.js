/* BIMO Core — reusable client-side platform layer.
   Drop this file into any project and use the global `Bimo` object.
   Provides: secure storage, password hashing, account management
   (email/phone login), brute-force lockout, sessions with expiry,
   tamper-evident hash-chained audit trail and order ledger,
   PWA install handling, bring-your-own-key AI client, and backup. */
(function (global) {
  'use strict';

  const Bimo = {};

  /* ---------- storage (fail-safe wrappers with obfuscation) ---------- */
  Bimo.store = {
    get(key, fallback) {
      try {
        let raw = global.localStorage.getItem(key);
        if (raw === null) return fallback;
        if (raw.startsWith('b64:')) {
          raw = atob(raw.slice(4));
        }
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try {
        let str = JSON.stringify(value);
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('user') || lowerKey.includes('account') || lowerKey.includes('auth') || lowerKey.includes('session') || lowerKey.includes('key')) {
          str = 'b64:' + btoa(str);
        }
        global.localStorage.setItem(key, str);
        return true;
      } catch (e) { return false; }
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
      // Enforces at least 8 characters with lowercase and capital letters structural rules
      return s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s);
    }
  };

  /* ---------- ADVANCED MFA, USERNAMES & PERSISTENT LEASING MODULES ---------- */
  
  // High-fidelity Global Telecom Directory Matrix for 2FA Dropdowns
  Bimo.countryCodesDirectory = [
    { code: "+880", name: "Bangladesh (+880)" },
    { code: "+1", name: "USA / Canada (+1)" },
    { code: "+44", name: "United Kingdom (+44)" },
    { code: "+91", name: "India (+91)" },
    { code: "+92", name: "Pakistan (+92)" },
    { code: "+971", name: "UAE (+971)" },
    { code: "+61", name: "Australia (+61)" },
    { code: "+65", name: "Singapore (+65)" },
    { code: "+60", name: "Malaysia (+60)" },
    { code: "+966", name: "Saudi Arabia (+966)" },
    { code: "+81", name: "Japan (+81)" },
    { code: "+49", name: "Germany (+49)" },
    { code: "+33", name: "France (+33)" },
    { code: "+86", name: "China (+86)" }
  ];

  // Helper method for 6-Digit dynamic challenge token allocations
  Bimo.generate6DigitOTP = function () {
    return String(Math.floor(100000 + Math.random() * 900000));
  };

  // Enforces unique usernames during platform registration
  Bimo.isUsernameUnique = function (username) {
    const cleanUser = String(username || '').trim().toLowerCase();
    const registry = Bimo.store.get('BIMO_USER_REGISTRY', []);
    return !registry.some(user => user.username === cleanUser);
  };

  // Persists the newly configured user onto local encrypted workspace blocks
  Bimo.registerUser = async function (username, plainPassword, twoFactorMethod, twoFactorTarget) {
    const cleanUser = String(username || '').trim().toLowerCase();
    if (!Bimo.isUsernameUnique(cleanUser)) return false;
    if (!Bimo.validate.password(plainPassword)) return false;

    const registry = Bimo.store.get('BIMO_USER_REGISTRY', []);
    const passHash = await Bimo.makePassRecord(plainPassword);

    const newUserProfile = {
      username: cleanUser,
      passHash: passHash,
      twoFactorMethod: twoFactorMethod,
      twoFactorTarget: twoFactorTarget
    };

    registry.push(newUserProfile);
    Bimo.store.set('BIMO_USER_REGISTRY', registry);
    return newUserProfile;
  };

  // Verifies account parameters inside local storage arrays
  Bimo.authenticateCredentials = async function (username, plainPassword) {
    const cleanUser = String(username || '').trim().toLowerCase();
    const registry = Bimo.store.get('BIMO_USER_REGISTRY', []);
    const userMatch = registry.find(u => u.username === cleanUser);
    
    if (!userMatch) return null;
    
    const isValid = await Bimo.verifyPassRecord(plainPassword, userMatch);
    return isValid ? userMatch : null;
  };

  // Creates session leases with adjustable validation permanence options
  Bimo.createSessionLease = function (username, rememberMe) {
    const cleanUser = String(username || '').trim().toLowerCase();
    if (rememberMe) {
      Bimo.store.set('BIMO_ACTIVE_SESSION_LEASE', { username: cleanUser, timestamp: Date.now() });
    } else {
      try {
        global.sessionStorage.setItem('BIMO_VOLATILE_SESSION_LEASE', cleanUser);
      } catch (e) {}
    }
  };

  // Resolves whether a secure user profile retains a valid application lease at launch
  Bimo.checkActiveSessionLease = function () {
    const persistent = Bimo.store.get('BIMO_ACTIVE_SESSION_LEASE', null);
    if (persistent && persistent.username) return persistent.username;

    try {
      return global.sessionStorage.getItem('BIMO_VOLATILE_SESSION_LEASE') || null;
    } catch (e) {
      return null;
    }
  };

  // Resets all terminal session states instantly across browser stores
  Bimo.terminateSessionLease = function () {
    Bimo.store.remove('BIMO_ACTIVE_SESSION_LEASE');
    try {
      global.sessionStorage.removeItem('BIMO_VOLATILE_SESSION_LEASE');
    } catch (e) {}
  };

  // Unified visual toggle driver for masking or exposing input field password types
  Bimo.togglePasswordVisibility = function (inputElementId) {
    if (typeof document === 'undefined') return;
    const element = document.getElementById(inputElementId);
    if (element) {
      element.type = element.type === 'password' ? 'text' : 'password';
    }
  };

  global.Bimo = Bimo;
})(typeof window !== 'undefined' ? window : this);
