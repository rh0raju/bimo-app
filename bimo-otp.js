/* BIMO OTP engine (no DOM, no dependencies) · MIT License
 *
 * MODE "demo" (default): the code is generated in the browser and SHOWN ON SCREEN. Nothing is sent.
 *                        Good for demos and testing. It does NOT prove who owns the phone or email.
 * MODE "api":            your server sends and checks the code; the browser never sees it.
 *     POST {endpoint}/send    {"type":"phone"|"email","to":"..."}          -> {"ok":true}
 *     POST {endpoint}/verify  {"type":"...","to":"...","code":"123456"}    -> {"ok":true}  or  {"ok":false,"error":"..."}
 *     The server MUST rate-limit, expire codes and cap wrong attempts. The limits below only keep the screen honest.
 *
 * Configure BEFORE this file loads:
 *     <script>window.BIMO_OTP_CONFIG = { mode: 'api', endpoint: 'https://your-host/otp' };</script>
 */
(function (root) {
  'use strict';
  var CFG = Object.assign({
    mode: 'demo', endpoint: '',
    ttlMs: 5 * 60 * 1000,        // a code lives 5 minutes
    resendMs: 30 * 1000,         // wait 30 s between codes
    maxAttempts: 5,              // wrong guesses before the code is burned
    maxSends: 5,                 // codes per sign-up session
    verifiedMs: 30 * 60 * 1000,  // how long "verified" stays valid while the user fills the next step
    timeoutMs: 10000
  }, root.BIMO_OTP_CONFIG || {});

  var st = null, sends = 0, lastSend = 0, verified = null;
  var now = function () { return Date.now(); };
  var hex = function (buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); };

  async function sha(text) {
    if (root.crypto && root.crypto.subtle) return hex(await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return 'plain:' + text;                                   // insecure origins (http on a LAN) have no crypto.subtle
  }
  function randomCode() {                                      // uniform 6 digits, no modulo bias
    var a = new Uint32Array(1);
    do { root.crypto.getRandomValues(a); } while (a[0] >= 4294000000);
    return ('00000' + (a[0] % 1000000)).slice(-6);
  }
  function randomSalt() { var a = new Uint8Array(12); root.crypto.getRandomValues(a); return hex(a); }
  function fail(code, error, extra) { return Object.assign({ ok: false, code: code, error: error }, extra || {}); }

  async function post(path, body) {
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, CFG.timeoutMs);
    try {
      var res = await fetch(String(CFG.endpoint).replace(/\/$/, '') + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal, cache: 'no-store'
      });
      var data = {}; try { data = await res.json(); } catch (e) {}
      if (res.ok && data.ok !== false) return { ok: true, data: data };
      return { ok: false, status: res.status, error: data.error || (res.status === 429 ? 'Too many attempts. Please wait a while.' : 'Server error (' + res.status + ').') };
    } catch (e) {
      return { ok: false, network: true, error: e.name === 'AbortError' ? 'The server took too long to respond.' : 'No connection. Check your internet and try again.' };
    } finally { clearTimeout(timer); }
  }

  async function send(target) {
    if (!target || !target.value) return fail('none', 'There is nothing to send the code to.');
    var t = now();
    if (lastSend && t - lastSend < CFG.resendMs) {
      var w = Math.ceil((CFG.resendMs - (t - lastSend)) / 1000);
      return fail('cooldown', 'Please wait ' + w + 's before requesting another code.', { wait: w });
    }
    if (sends >= CFG.maxSends) return fail('limit', 'Too many codes requested. Please try again later.');
    verified = null;
    if (CFG.mode === 'api') {
      var r = await post('/send', { type: target.type, to: target.value });
      if (!r.ok) return fail(r.network ? 'network' : 'server', r.error);
      st = { target: target, api: true, exp: t + CFG.ttlMs, attempts: 0 };
      sends++; lastSend = t;
      return { ok: true };
    }
    var code = randomCode(), salt = randomSalt();
    st = { target: target, salt: salt, hash: await sha(salt + code), exp: t + CFG.ttlMs, attempts: 0 };
    sends++; lastSend = t;
    return { ok: true, demoCode: code };
  }

  async function verify(code) {
    code = String(code == null ? '' : code).trim();
    if (!st || st.done) return fail('none', 'Request a code first.');
    if (!/^\d{6}$/.test(code)) return fail('format', 'Enter the 6-digit code.');
    if (now() > st.exp) return fail('expired', 'This code has expired. Request a new one.');
    if (st.locked) return fail('locked', 'Too many wrong codes. Request a new one.');
    var ok, mine = st;
    if (st.api) {
      var r = await post('/verify', { type: st.target.type, to: st.target.value, code: code });
      if (r.network || (r.status && r.status >= 500)) return fail(r.network ? 'network' : 'server', r.error);
      ok = r.ok;
    } else {
      ok = (await sha(st.salt + code)) === st.hash;
    }
    if (mine !== st) return fail('none', 'That code was replaced. Use the newest one.');   // a resend happened mid-check
    if (ok) {
      verified = { type: st.target.type, value: st.target.value, until: now() + CFG.verifiedMs };
      st.done = true; st.hash = null;
      return { ok: true };
    }
    st.attempts++;
    var left = Math.max(0, CFG.maxAttempts - st.attempts);
    if (left === 0) { st.locked = true; return fail('locked', 'Too many wrong codes. Request a new one.', { attemptsLeft: 0 }); }
    return fail('wrong', 'That code is not right. ' + left + (left === 1 ? ' attempt left.' : ' attempts left.'), { attemptsLeft: left });
  }

  function status() {
    var t = now();
    return {
      active: !!st && !st.done, mode: CFG.mode, target: st ? st.target : null,
      expiresIn: st ? Math.max(0, Math.ceil((st.exp - t) / 1000)) : 0,
      resendIn: lastSend ? Math.max(0, Math.ceil((CFG.resendMs - (t - lastSend)) / 1000)) : 0,
      attemptsLeft: st ? Math.max(0, CFG.maxAttempts - st.attempts) : 0,
      locked: !!(st && st.locked), sendsLeft: Math.max(0, CFG.maxSends - sends)
    };
  }
  function isVerifiedFor(target) { return !!(verified && target && verified.type === target.type && verified.value === target.value && now() < verified.until); }
  function reset() { st = null; sends = 0; lastSend = 0; verified = null; }
  function mask(target) {
    if (!target) return '';
    var v = String(target.value);
    if (target.type === 'email') { var p = v.split('@'); return (p[0].slice(0, 2) + '***') + '@' + (p[1] || ''); }
    var d = v.replace(/\s/g, ''); return d.length <= 6 ? d : d.slice(0, 3) + new Array(d.length - 5).join('*') + d.slice(-3);
  }

  root.BimoOtp = { config: CFG, send: send, verify: verify, status: status, isVerifiedFor: isVerifiedFor, reset: reset, mask: mask };
})(typeof window !== 'undefined' ? window : globalThis);
