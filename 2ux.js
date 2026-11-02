(function () {
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);

  // Offline banner
  const net = document.createElement('div');
  net.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:50;background:#b45309;color:#fff;text-align:center;font:600 12px system-ui;padding:6px';
  net.textContent = 'Internet nei. Data phone e save hocche, ekhon kaaj korte paren.';
  document.body.appendChild(net);
  const showNet = () => net.style.display = navigator.onLine ? 'none' : 'block';
  addEventListener('online', showNet);
  addEventListener('offline', showNet);
  showNet();

  // Install guide popup
  let steps;
  if (isIOS) steps = ['Safari te khulo (Chrome e hobe na)', 'Niche Share (↑) icon e tap koro', 'Add to Home Screen select koro', 'Add tap koro'];
  else if (isSamsung) steps = ['Menu (≡) e tap koro', 'Add page to → Home screen select koro', 'Add tap koro'];
  else if (isFirefox) steps = ['Menu (⋮) e tap koro', 'Install ba Add to Home screen select koro'];
  else steps = ['Menu (⋮) e tap koro', 'Install app ba Add to Home screen select koro', 'Install tap koro'];

  const guide = document.createElement('div');
  guide.setAttribute('role', 'dialog');
  guide.style.cssText = 'display:none;position:fixed;inset:0;background:#0009;z-index:60;align-items:center;justify-content:center;padding:14px';
  guide.innerHTML = `<div style="background:#1e293b;color:#f8fafc;border:1px solid #ffffff1a;border-radius:14px;padding:18px;max-width:380px;width:100%;font:14px system-ui;box-sizing:border-box">
    <h3 style="margin:0 0 10px;font-size:17px;color:#fb7185">📲 Phone e BIMO install korun</h3>
    <ol style="padding-left:20px;margin:0 0 14px;line-height:1.7">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
    <button id="ux-close" style="width:100%;padding:12px;border:0;border-radius:10px;background:#e11d48;color:#fff;font:inherit;font-weight:700;cursor:pointer">Bujhlam</button>
  </div>`;
  document.body.appendChild(guide);
  guide.querySelector('#ux-close').onclick = () => guide.style.display = 'none';
  guide.onclick = e => { if (e.target === guide) guide.style.display = 'none'; };

  // Install button
  let deferred = null;
  const install = document.createElement('button');
  install.textContent = '📲 App install korun';
  install.style.cssText = 'display:none;position:fixed;left:14px;bottom:88px;z-index:12;background:#16a34a;color:#fff;border:0;border-radius:999px;padding:10px 14px;font:700 12px system-ui;box-shadow:0 6px 18px #0006';
  install.onclick = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      install.style.display = 'none';
    } else {
      guide.style.display = 'flex';
    }
  };
  document.body.appendChild(install);
  if (!isStandalone) install.style.display = 'block';
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', () => install.style.display = 'none');

  // Scroll-to-top button
  const up = document.createElement('button');
  up.textContent = '↑';
  up.setAttribute('aria-label', 'Upore jao');
  up.style.cssText = 'display:none;position:fixed;right:14px;bottom:140px;z-index:12;width:42px;height:42px;border-radius:50%;border:0;background:#e11d48;color:#fff;font-size:18px;box-shadow:0 6px 18px #0006';
  up.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(up);
  addEventListener('scroll', () => up.style.display = scrollY > 400 ? 'block' : 'none', { passive: true });
})();
