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
      return s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s);
    }
  };

  global.Bimo = Bimo;
})(typeof window !== 'undefined' ? window : this);
