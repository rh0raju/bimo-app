(function () {
  const net = document.createElement('div');
  net.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:50;background:#b45309;color:#fff;text-align:center;font:600 12px system-ui;padding:6px';
  net.textContent = 'Internet nei. Data phone e save hocche, ekhon kaaj korte paren.';
  document.body.appendChild(net);
  const showNet = () => net.style.display = navigator.onLine ? 'none' : 'block';
  addEventListener('online', showNet);
  addEventListener('offline', showNet);
  showNet();

  const up = document.createElement('button');
  up.textContent = '↑';
  up.setAttribute('aria-label', 'Upore jao');
  up.style.cssText = 'display:none;position:fixed;right:14px;bottom:140px;z-index:12;width:42px;height:42px;border-radius:50%;border:0;background:#e11d48;color:#fff;font-size:18px;box-shadow:0 6px 18px #0006';
  up.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(up);
  addEventListener('scroll', () => up.style.display = scrollY > 400 ? 'block' : 'none', { passive: true });
})();
