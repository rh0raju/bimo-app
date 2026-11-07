/* BIMO Orders — pure order/report helpers (no DOM). Used by index.html and tested in Node. */
(function (g) {
  'use strict';
  const STATUSES = ['pending', 'paid', 'cancelled'];
  const MAX_AMOUNT = 10000000;
  const DAY_MS = 86400000;

  const pad = n => String(n).padStart(2, '0');
  function localToday(d = new Date()) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function newId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  /* Returns a clean order object, or null if the input is not a valid order. */
  function cleanOrder(o) {
    if (!o || typeof o !== 'object') return null;
    const customer = String(o.customer ?? '').trim().slice(0, 80);
    const product = String(o.product ?? '').trim().slice(0, 120);
    const qty = Math.floor(Number(o.qty));
    const amount = Number(o.amount);
    if (!customer || !product) return null;
    if (!(qty >= 1) || qty > 100000) return null;
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(o.date || '')) ? o.date : localToday();
    return {
      id: String(o.id || newId()).slice(0, 40),
      date,
      customer,
      product,
      qty,
      amount: Math.round((amount + Number.EPSILON) * 100) / 100,
      source: String(o.source || 'Other').slice(0, 30),
      status: STATUSES.includes(o.status) ? o.status : 'pending'
    };
  }

  /* CSV cell: quotes everything and neutralises spreadsheet formula injection. */
  function csvCell(v) {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function buildCsv(orders) {
    const head = ['date', 'customer', 'product', 'qty', 'amount', 'source', 'status'];
    const lines = [head.join(',')].concat((orders || []).map(o => head.map(k => csvCell(o[k])).join(',')));
    return '\ufeff' + lines.join('\r\n');
  }

  function computeStats(orders) {
    const s = { revenue: 0, pendingAmt: 0, counts: { pending: 0, paid: 0, cancelled: 0 }, total: (orders || []).length };
    for (const o of (orders || [])) {
      if (s.counts[o.status] !== undefined) s.counts[o.status]++;
      if (o.status === 'paid') s.revenue += o.amount;
      if (o.status === 'pending') s.pendingAmt += o.amount;
    }
    s.revenue = Math.round((s.revenue + Number.EPSILON) * 100) / 100;
    s.pendingAmt = Math.round((s.pendingAmt + Number.EPSILON) * 100) / 100;
    return s;
  }

  /* Products ranked by quantity sold (cancelled orders excluded). */
  function topProducts(orders, n = 5) {
    const prod = {};
    for (const o of (orders || [])) {
      if (o.status !== 'cancelled') {
        prod[o.product] = (prod[o.product] || 0) + o.qty;
      }
    }
    return Object.entries(prod).sort((a, b) => b[1] - a[1]).slice(0, n);
  }

  /* Newest first by date, then by insertion order. */
  function recentOrders(orders, n = 5) {
    return (orders || []).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, n);
  }

  function filterOrders(orders, { status = 'all', query = '' } = {}) {
    const q = String(query).trim().toLowerCase();
    return (orders || []).filter(o =>
      (status === 'all' || o.status === status) &&
      (!q || o.customer.toLowerCase().includes(q) || o.product.toLowerCase().includes(q)));
  }

  /* Whole days since an ISO timestamp. Infinity if missing or invalid. */
  function daysSince(iso, now = Date.now()) {
    const t = Date.parse(iso);
    return Number.isFinite(t) ? Math.floor((now - t) / DAY_MS) : Infinity;
  }

  function makeBackup(orders, brandName, now = new Date()) {
    return { app: 'BIMO', version: 1, exportedAt: now.toISOString(), brandName: brandName || '', orders: orders || [] };
  }

  /* Validates a parsed backup object. Returns { ok, orders } or { ok:false, error }. */
  function validateBackup(data) {
    if (!data || typeof data !== 'object' || data.app !== 'BIMO' || !Array.isArray(data.orders)) {
      return { ok: false, error: 'notBackup' };
    }
    const orders = data.orders.map(cleanOrder).filter(Boolean);
    return { ok: true, orders, skipped: data.orders.length - orders.length };
  }

  g.BimoOrders = {
    STATUSES, MAX_AMOUNT, localToday, newId, cleanOrder, csvCell, buildCsv,
    computeStats, topProducts, recentOrders, filterOrders, daysSince, makeBackup, validateBackup
  };
})(typeof window !== 'undefined' ? window : this);
