(function () {
  'use strict';

  const DEFAULT_LOW_STOCK = 5;
  const STORAGE_PREFIX = 'bimo_products_';

  function getCurrentUser() {
    if (window.Bimo && window.Bimo.session) return window.Bimo.session.active();
    return null;
  }

  function getAccountKey(user) {
    if (!user) return 'anonymous';
    if (window.Bimo && window.Bimo.accountKeyOf) return window.Bimo.accountKeyOf(user);
    return String(user.email || user.phone || user.brandName || 'anonymous').toLowerCase();
  }

  function getProductsKey() {
    const user = getCurrentUser();
    return STORAGE_PREFIX + getAccountKey(user);
  }

  function normalizeProducts(raw) {
    const products = Array.isArray(raw) ? raw : [];
    return products.map((p, index) => {
      const stock = Number(p && p.stock != null ? p.stock : 0);
      const lowStock = Number(p && p.lowStock != null ? p.lowStock : DEFAULT_LOW_STOCK);
      return {
        id: p && p.id ? p.id : `product-${Date.now()}-${index}`,
        name: String(p && p.name ? p.name : 'Untitled product').trim(),
        stock: Number.isFinite(stock) ? stock : 0,
        lowStock: Number.isFinite(lowStock) && lowStock >= 0 ? lowStock : DEFAULT_LOW_STOCK,
        price: Number(p && p.price != null ? p.price : 0) || 0,
        cost: Number(p && p.cost != null ? p.cost : 0) || 0,
        updatedAt: p && p.updatedAt ? p.updatedAt : Date.now()
      };
    });
  }

  function readProducts() {
    try {
      const key = getProductsKey();
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return normalizeProducts(parsed);
    } catch (e) {
      return [];
    }
  }

  function writeProducts(products) {
    try {
      const normalized = normalizeProducts(products);
      localStorage.setItem(getProductsKey(), JSON.stringify(normalized));
      return normalized;
    } catch (e) {
      return [];
    }
  }

  function getLowStockProducts(products) {
    return (products || readProducts()).filter((p) => Number(p.stock) <= Number(p.lowStock || DEFAULT_LOW_STOCK));
  }

  function renderLowStockCard() {
    const card = document.querySelector('[data-low-stock-card]');
    if (!card) return;

    const low = getLowStockProducts(readProducts());
    const list = card.querySelector('[data-low-stock-list]');
    const count = card.querySelector('[data-low-stock-count]');
    if (count) count.textContent = String(low.length);

    if (!list) return;
    if (!low.length) {
      list.innerHTML = '<div style="color:#94a3b8;">No products are at the alert threshold.</div>';
      return;
    }

    list.innerHTML = low.map((p) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span>${escapeHtml(p.name)}</span>
        <span style="color:#f59e0b;font-weight:700;">${Number(p.stock)} left</span>
      </div>
    `).join('');
  }

  function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    const products = readProducts();
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">No products yet. Add your first product.</td></tr>';
      return;
    }

    tbody.innerHTML = products.map((p) => {
      const low = Number(p.stock) <= Number(p.lowStock || DEFAULT_LOW_STOCK);
      const status = low
        ? '<span style="color:#f59e0b;font-weight:700;">Low stock</span>'
        : '<span style="color:#22c55e;font-weight:700;">Healthy</span>';

      return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>৳${Number(p.price || 0).toLocaleString('en-BD')}</td>
          <td>৳${Number(p.cost || 0).toLocaleString('en-BD')}</td>
          <td>${Number(p.stock || 0)}</td>
          <td>${Number(p.lowStock || DEFAULT_LOW_STOCK)}</td>
          <td>${status}</td>
          <td>
            <button type="button" style="padding:7px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:#fff;cursor:pointer;" onclick="window.BimoLowStock.restock('${p.id}', Number(prompt('Add quantity to stock', '1')) || 0)">Restock</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function addProduct(product) {
    const next = writeProducts([...readProducts(), {
      id: product && product.id ? product.id : `product-${Date.now()}`,
      name: product && product.name ? product.name : 'New product',
      stock: Number(product && product.stock != null ? product.stock : 0) || 0,
      lowStock: Number(product && product.lowStock != null ? product.lowStock : DEFAULT_LOW_STOCK) || DEFAULT_LOW_STOCK,
      price: Number(product && product.price != null ? product.price : 0) || 0,
      cost: Number(product && product.cost != null ? product.cost : 0) || 0,
      updatedAt: Date.now()
    }]);
    renderLowStockCard();
    renderProductsTable();
    return next;
  }

  function restock(productId, qty) {
    const products = readProducts();
    const index = products.findIndex((p) => String(p.id) === String(productId));
    if (index === -1) return false;
    products[index].stock = Math.max(0, Number(products[index].stock || 0) + Number(qty || 0));
    products[index].updatedAt = Date.now();
    writeProducts(products);
    renderLowStockCard();
    renderProductsTable();
    return true;
  }

  function setLowStockThreshold(productId, threshold) {
    const products = readProducts();
    const index = products.findIndex((p) => String(p.id) === String(productId));
    if (index === -1) return false;
    products[index].lowStock = Math.max(0, Number(threshold || DEFAULT_LOW_STOCK));
    products[index].updatedAt = Date.now();
    writeProducts(products);
    renderLowStockCard();
    renderProductsTable();
    return true;
  }

  function deleteProduct(productId) {
    const next = readProducts().filter((p) => String(p.id) !== String(productId));
    writeProducts(next);
    renderLowStockCard();
    renderProductsTable();
    return true;
  }

  function ensureDemoData() {
    const products = readProducts();
    if (products.length) return;
    writeProducts([
      { id: 'demo-1', name: 'Premium T-Shirt', stock: 3, lowStock: 5, price: 1200, cost: 700 },
      { id: 'demo-2', name: 'Cotton Kurta', stock: 12, lowStock: 5, price: 1800, cost: 900 },
      { id: 'demo-3', name: 'Laptop Sleeve', stock: 8, lowStock: 5, price: 700, cost: 250 }
    ]);
  }

  function setupDashboardCard() {
    const home = document.getElementById('page-home');
    if (!home || document.querySelector('[data-low-stock-card]')) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-low-stock-card', 'true');
    card.innerHTML = `
      <h3>Stock running low</h3>
      <div data-low-stock-count style="font-size:28px;font-weight:800;color:#f59e0b;">0</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:8px;">Products at alert threshold</div>
      <div data-low-stock-list style="margin-top:14px;"></div>
    `;
    home.appendChild(card);
  }

  function setupProductsTable() {
    const page = document.getElementById('page-products');
    if (!page) return;
    renderProductsTable();
  }

  function refreshAll() {
    renderLowStockCard();
    renderProductsTable();
  }

  window.BimoLowStock = {
    DEFAULT_LOW_STOCK,
    readProducts,
    writeProducts,
    getLowStockProducts,
    renderLowStockCard,
    renderProductsTable,
    addProduct,
    restock,
    setLowStockThreshold,
    deleteProduct,
    ensureDemoData,
    refreshAll
  };

  window.addEventListener('load', function () {
    ensureDemoData();
    setupDashboardCard();
    setupProductsTable();
    refreshAll();
  });

  document.addEventListener('DOMContentLoaded', function () {
    ensureDemoData();
    setupDashboardCard();
    setupProductsTable();
    refreshAll();
  });
})();
