document.addEventListener('DOMContentLoaded', () => {
  const authScreen = document.getElementById('auth-screen');
  const mainScreen = document.getElementById('main-screen');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegisterBtn = document.getElementById('tab-register-btn');
  const brandField = document.getElementById('brand-field');
  const authForm = document.getElementById('auth-form');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authError = document.getElementById('auth-error');
  
  let isRegisterMode = false;

  // Toggle Login/Register
  tabLoginBtn.addEventListener('click', () => {
    isRegisterMode = false;
    tabLoginBtn.classList.add('active');
    tabRegisterBtn.classList.remove('active');
    brandField.style.display = 'none';
    authSubmitBtn.textContent = 'Login';
    authError.textContent = '';
  });

  tabRegisterBtn.addEventListener('click', () => {
    isRegisterMode = true;
    tabRegisterBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    brandField.style.display = 'block';
    authSubmitBtn.textContent = 'Register';
    authError.textContent = '';
  });

  // Check active session on load
  fetch('/api/me')
    .then(res => {
      if (res.ok) return res.json();
      throw new Error('Not logged in');
    })
    .then(data => {
      showDashboard(data.user);
    })
    .catch(() => {
      authScreen.classList.add('active');
      mainScreen.classList.remove('active');
    });

  // Auth form submit placeholder
  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const brand = document.getElementById('brand-input').value;

    const endpoint = isRegisterMode ? '/api/register' : '/api/login';
    const payload = isRegisterMode ? { email, password, brand } : { email, password };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.error || 'Authentication failed');
      window.location.reload();
    })
    .catch(err => {
      authError.textContent = err.message;
    });
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    fetch('/api/logout', { method: 'POST' }).then(() => window.location.reload());
  });

  // Sidebar navigation tabs
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  function showDashboard(user) {
    authScreen.classList.remove('active');
    mainScreen.classList.add('active');
    document.getElementById('user-email-display').textContent = user.email;
    document.getElementById('user-brand-badge').textContent = user.brand || 'BIMO Brand';
  }
});
