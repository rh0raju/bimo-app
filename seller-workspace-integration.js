/* BIMO Seller Workspace integration loader.
 * Include once after bimo-core.js in index.html. It loads the existing
 * seller-workspace.js module only; it deliberately does not load
 * seller-low-stock.js because that module currently uses a separate product store.
 */
(function () {
  'use strict';

  if (window.__bimoSellerWorkspaceLoader) return;
  window.__bimoSellerWorkspaceLoader = true;

  function loadWorkspace() {
    if (!window.Bimo || !window.Bimo.session) {
      window.setTimeout(loadWorkspace, 50);
      return;
    }

    if (document.querySelector('script[data-bimo-seller-workspace]')) return;

    const currentScript = document.currentScript;
    const base = currentScript && currentScript.src
      ? new URL('.', currentScript.src).href
      : new URL('.', window.location.href).href;
    const script = document.createElement('script');
    script.src = new URL('seller-workspace.js', base).href;
    script.async = false;
    script.dataset.bimoSellerWorkspace = 'true';
    script.onerror = function () {
      console.error('BIMO seller workspace failed to load. Check that seller-workspace.js is deployed beside index.html.');
    };
    document.head.appendChild(script);
  }

  loadWorkspace();
})();
