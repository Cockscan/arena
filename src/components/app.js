/* ═══════════════════════════════════════════
   APP.JS — PixelPlex Interactivity
   ═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ══════════════════════════════════════════
  //  TOAST NOTIFICATION
  // ══════════════════════════════════════════
  function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${type === 'success'
          ? '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
          : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'}
      </div>
      <span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
  }


  // ══════════════════════════════════════════
  //  AUTH SYSTEM (Server API)
  // ══════════════════════════════════════════

  // Current session is cached client-side for UI, but truth lives on server
  let currentUser = null;

  // Video data cache
  let videoDataMap = {}; // { videoId: { ...videoData, purchased: bool } }
  let userPurchasedIds = new Set();

  // Wallet state
  let walletBalance = 0; // in paise
  let walletBalanceRupees = 0;
  let walletTransactions = [];

  function getSession() {
    return currentUser;
  }

  function isLoggedIn() {
    return currentUser !== null;
  }

  // Fetch current session from server (cookie-based)
  async function fetchSession() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      const data = await res.json();
      if (data.ok && data.user) {
        currentUser = data.user;
        // Update wallet balance from session
        walletBalance = data.user.wallet_balance || 0;
        walletBalanceRupees = data.user.wallet_balance_rupees || 0;
      } else {
        currentUser = null;
        walletBalance = 0;
        walletBalanceRupees = 0;
      }
    } catch {
      currentUser = null;
      walletBalance = 0;
      walletBalanceRupees = 0;
    }
    updateHeaderForAuth();
    return currentUser;
  }

  // Fetch wallet balance from API
  async function fetchWalletBalance() {
    if (!currentUser) return;

    try {
      const res = await fetch('/api/wallet/balance', { credentials: 'include' });
      const data = await res.json();

      if (data.ok) {
        walletBalance = data.balance;
        walletBalanceRupees = data.balance_rupees;
        updateWalletDisplay();
      }
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
    }
  }

  // Update wallet display in UI
  function updateWalletDisplay() {
    const walletAmountEls = document.querySelectorAll('.wallet-amount');
    walletAmountEls.forEach(el => {
      el.textContent = `₹${walletBalanceRupees}`;
      el.classList.add('updated');
      setTimeout(() => el.classList.remove('updated'), 500);
    });
  }

  // Sign Up via API
  async function signUp(username, email, password, confirmPassword) {
    if (!username || username.trim().length < 3) return { ok: false, error: 'Username must be at least 3 characters' };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please enter a valid email address' };
    if (!password || password.length < 6) return { ok: false, error: 'Password must be at least 6 characters' };
    if (password !== confirmPassword) return { ok: false, error: 'Passwords do not match' };

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password })
      });
      const data = await res.json();
      if (data.ok) {
        currentUser = data.user;
        updateHeaderForAuth();
      }
      return data;
    } catch (err) {
      console.error('Signup fetch error:', err);
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }

  // Sign In via API
  async function signIn(identifier, password) {
    if (!identifier || !password) return { ok: false, error: 'Please enter your credentials' };

    try {
      const res = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: identifier.trim(), password })
      });
      const data = await res.json();
      if (data.ok) {
        currentUser = data.user;
        updateHeaderForAuth();
      }
      return data;
    } catch (err) {
      console.error('Signin fetch error:', err);
      return { ok: false, error: 'Network error. Please try again.' };
    }
  }

  // Sign Out via API
  async function clearSession() {
    try {
      await fetch('/api/signout', { method: 'POST', credentials: 'include' });
    } catch (err) { console.error('Signout error:', err); }
    currentUser = null;
    updateHeaderForAuth();
  }


  // ══════════════════════════════════════════
  //  HEADER AUTH STATE
  // ══════════════════════════════════════════
  function updateHeaderForAuth() {
    const session = getSession();
    const signinBtn = document.querySelector('.btn-signin');
    if (!signinBtn) return;

    if (session) {
      signinBtn.textContent = '';
      signinBtn.className = 'btn-signin logged-in';
      signinBtn.innerHTML = `
        <span class="header-user-avatar">${session.username.charAt(0).toUpperCase()}</span>
        <span class="header-username">${session.username}</span>
        ${session.payment_status === 'paid' ? '<span class="premium-badge">PRO</span>' : ''}
        <svg class="header-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      `;

      // Remove old dropdown if any
      let dropdown = document.querySelector('.header-dropdown');
      if (dropdown) dropdown.remove();

      // Create dropdown
      dropdown = document.createElement('div');
      dropdown.className = 'header-dropdown';
      dropdown.innerHTML = `
        <div class="dropdown-header">
          <div class="dropdown-avatar">${session.username.charAt(0).toUpperCase()}</div>
          <div>
            <div class="dropdown-name">${session.username} ${session.payment_status === 'paid' ? '<span class="premium-badge small">PRO</span>' : ''}</div>
            <div class="dropdown-email">${session.email}</div>
            ${session.payment_status !== 'paid' ? '<div class="dropdown-plan-status">Free Plan</div>' : '<div class="dropdown-plan-status paid">Premium Active</div>'}
          </div>
        </div>
        <div class="dropdown-wallet-section" style="padding: 12px; margin: 8px 0; background: rgba(133,199,66,0.05); border-radius: 8px; border: 1px solid rgba(133,199,66,0.2);">
          <div class="wallet-balance-display" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 24px;">💰</span>
            <div>
              <div class="wallet-amount" style="font-size: 18px; font-weight: 700; color: var(--accent);">₹${walletBalanceRupees}</div>
              <div class="wallet-label" style="font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;">Wallet Balance</div>
            </div>
          </div>
          <button class="dropdown-add-money" style="width: 100%; padding: 8px; background: linear-gradient(135deg, var(--accent), #6aad2d); color: #111; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;">+ Add Money</button>
        </div>
        <div class="dropdown-divider"></div>
        ${session.payment_status !== 'paid' ? `
        <a class="dropdown-item dropdown-upgrade" data-action="upgrade">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Activate Account — ₹99
        </a>
        <div class="dropdown-divider"></div>
        ` : ''}
        <a class="dropdown-item" data-action="profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          My Profile
        </a>
        <a class="dropdown-item" data-action="history">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Transaction History
        </a>
        <a class="dropdown-item" data-action="settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </a>
        <div class="dropdown-divider"></div>
        <a class="dropdown-item dropdown-signout" data-action="signout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </a>
      `;
      signinBtn.parentElement.style.position = 'relative';
      signinBtn.parentElement.appendChild(dropdown);

      // Toggle dropdown
      signinBtn.onclick = (e) => {
        e.preventDefault();
        dropdown.classList.toggle('show');
      };

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!signinBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove('show');
        }
      });

      // Add Money button handler
      const addMoneyBtn = dropdown.querySelector('.dropdown-add-money');
      if (addMoneyBtn) {
        addMoneyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.remove('show');
          openAddMoneyModal();
        });
      }

      // Dropdown actions
      dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          e.preventDefault();
          const action = item.getAttribute('data-action');
          if (action === 'signout') {
            await clearSession();
            showToast('Signed out successfully');
            dropdown.classList.remove('show');
          } else if (action === 'upgrade') {
            dropdown.classList.remove('show');
            openPaymentModal();
          } else if (action === 'history') {
            dropdown.classList.remove('show');
            openTransactionHistory();
          } else if (action === 'profile') {
            dropdown.classList.remove('show');
            openProfilePage();
          } else {
            showToast(`${item.textContent.trim()} — coming soon`);
          }
        });
      });

    } else {
      signinBtn.className = 'btn-signin';
      signinBtn.innerHTML = 'Sign In';
      signinBtn.onclick = (e) => {
        e.preventDefault();
        openAuthModal('signin');
      };
    }
  }


  // ══════════════════════════════════════════
  //  AUTH MODAL (Sign In / Sign Up)
  // ══════════════════════════════════════════
  function openAuthModal(mode = 'signin') {
    // Remove existing
    const existing = document.querySelector('.auth-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-modal">
        <button class="auth-close" aria-label="Close">&times;</button>

        <!-- TABS -->
        <div class="auth-tabs">
          <button class="auth-tab ${mode === 'signin' ? 'active' : ''}" data-tab="signin">Sign In</button>
          <button class="auth-tab ${mode === 'signup' ? 'active' : ''}" data-tab="signup">Sign Up</button>
        </div>

        <!-- SIGN IN FORM -->
        <form class="auth-form" data-form="signin" style="${mode === 'signin' ? '' : 'display:none'}">
          <div class="auth-field">
            <label class="auth-label">Username or Email</label>
            <input type="text" class="auth-input" name="identifier" placeholder="Enter your username or email" required autocomplete="username">
          </div>
          <div class="auth-field">
            <label class="auth-label">Password</label>
            <input type="password" class="auth-input" name="password" placeholder="Enter your password" required autocomplete="current-password">
          </div>
          <div class="auth-error" style="display:none"></div>
          <button type="submit" class="auth-submit-btn">Sign In</button>
          <div style="text-align:center; margin-top:12px;">
            <a href="#" class="forgot-password-link" style="color:var(--accent); font-size:13px; text-decoration:none; opacity:0.8; transition:opacity 0.2s;">Forgot password?</a>
          </div>
        </form>

        <!-- SIGN UP FORM -->
        <form class="auth-form" data-form="signup" style="${mode === 'signup' ? '' : 'display:none'}">
          <div class="auth-field">
            <label class="auth-label">Username</label>
            <input type="text" class="auth-input" name="username" placeholder="Choose a username" required minlength="3" autocomplete="username">
          </div>
          <div class="auth-field">
            <label class="auth-label">Email</label>
            <input type="email" class="auth-input" name="email" placeholder="Enter your email" required autocomplete="email">
          </div>
          <div class="auth-field">
            <label class="auth-label">Password</label>
            <input type="password" class="auth-input" name="password" placeholder="Create a password (min 6 chars)" required minlength="6" autocomplete="new-password">
          </div>
          <div class="auth-field">
            <label class="auth-label">Confirm Password</label>
            <input type="password" class="auth-input" name="confirmPassword" placeholder="Confirm your password" required autocomplete="new-password">
          </div>
          <div class="auth-error" style="display:none"></div>
          <button type="submit" class="auth-submit-btn">Create Account</button>
        </form>

        <p class="auth-footer-text">
          By continuing, you agree to our
          <a href="info.html#terms" target="_blank">Terms of Service</a> and
          <a href="info.html#privacy" target="_blank">Privacy Policy</a>.
        </p>
      </div>`;

    document.body.appendChild(overlay);

    // Tab switching
    overlay.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        overlay.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        overlay.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
        overlay.querySelector(`[data-form="${target}"]`).style.display = '';
        // Clear errors
        overlay.querySelectorAll('.auth-error').forEach(e => { e.style.display = 'none'; e.textContent = ''; });
      });
    });

    // Sign In submit
    overlay.querySelector('[data-form="signin"]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const errEl = form.querySelector('.auth-error');
      const submitBtn = form.querySelector('.auth-submit-btn');
      const identifier = form.identifier.value;
      const password = form.password.value;

      // Loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
      errEl.style.display = 'none';

      try {
        const result = await signIn(identifier, password);
        if (result.ok) {
          closeAuthModal(overlay);
          await fetchSession();
          await fetchVideos();
          if (window._pendingVideoId) {
            const pendingId = window._pendingVideoId;
            window._pendingVideoId = null;
            showToast(`Welcome back, ${getSession().username}!`, 'success');
            setTimeout(() => showPremiumOrPlay(pendingId), 400);
          } else {
            showToast(`Welcome back, ${getSession().username}!`, 'success');
          }
        } else {
          errEl.textContent = result.error || 'Something went wrong';
          errEl.style.display = 'block';
          submitBtn.classList.add('shake');
          setTimeout(() => submitBtn.classList.remove('shake'), 500);
        }
      } catch (err) {
        console.error('Sign in error:', err);
        errEl.textContent = 'Connection error. Please try again.';
        errEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
      }
    });

    // Forgot password handler
    const forgotLink = overlay.querySelector('.forgot-password-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        const signinForm = overlay.querySelector('[data-form="signin"]');
        signinForm.innerHTML = `
          <div style="text-align:center; padding: 20px 0;">
            <div style="font-size: 48px; margin-bottom: 16px;">📧</div>
            <h3 style="margin: 0 0 8px; font-size: 20px; color: #fff;">Reset Your Password</h3>
            <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0 0 20px;">Enter your email and we'll send you a reset link.</p>
          </div>
          <div class="auth-field">
            <label class="auth-label">Email Address</label>
            <input type="email" class="auth-input" name="reset-email" placeholder="Enter your registered email" required autocomplete="email">
          </div>
          <div class="auth-error" style="display:none"></div>
          <button type="submit" class="auth-submit-btn">Send Reset Link</button>
          <div style="text-align:center; margin-top:12px;">
            <a href="#" class="back-to-signin" style="color:var(--accent); font-size:13px; text-decoration:none; opacity:0.8;">← Back to Sign In</a>
          </div>
        `;
        signinForm.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const email = signinForm.querySelector('[name="reset-email"]').value;
          if (email) {
            signinForm.innerHTML = `
              <div style="text-align:center; padding: 30px 0;">
                <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                <h3 style="margin: 0 0 8px; font-size: 20px; color: #fff;">Check Your Email</h3>
                <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0;">If an account exists for <strong style="color:var(--accent);">${email}</strong>, you'll receive a password reset link shortly.</p>
              </div>
            `;
          }
        });
        const backLink = signinForm.querySelector('.back-to-signin');
        if (backLink) {
          backLink.addEventListener('click', (ev) => {
            ev.preventDefault();
            closeAuthModal(overlay);
            setTimeout(() => openAuthModal('signin'), 200);
          });
        }
      });
    }

    // Sign Up submit
    overlay.querySelector('[data-form="signup"]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const errEl = form.querySelector('.auth-error');
      const submitBtn = form.querySelector('.auth-submit-btn');
      const username = form.username.value;
      const email = form.email.value;
      const password = form.password.value;
      const confirmPassword = form.confirmPassword.value;

      // Loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';
      errEl.style.display = 'none';

      try {
        const result = await signUp(username, email, password, confirmPassword);
        if (result.ok) {
          closeAuthModal(overlay);
          await fetchVideos();
          showToast(`Account created! Welcome to PixelPlex!`, 'success');
        } else {
          errEl.textContent = result.error || 'Something went wrong';
          errEl.style.display = 'block';
          submitBtn.classList.add('shake');
          setTimeout(() => submitBtn.classList.remove('shake'), 500);
        }
      } catch (err) {
        console.error('Sign up error:', err);
        errEl.textContent = 'Connection error. Please try again.';
        errEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    });

    // Close handlers
    overlay.querySelector('.auth-close').addEventListener('click', () => closeAuthModal(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAuthModal(overlay); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { closeAuthModal(overlay); document.removeEventListener('keydown', esc); }
    });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Focus first input
    setTimeout(() => {
      const firstInput = overlay.querySelector('.auth-form:not([style*="display:none"]) .auth-input');
      if (firstInput) firstInput.focus();
    }, 300);
  }

  function closeAuthModal(overlay) {
    overlay.classList.remove('show');
    overlay.addEventListener('transitionend', () => overlay.remove());
  }

  // ══════════════════════════════════════════
  //  PAYMENT HELPERS
  // ══════════════════════════════════════════

  function isPaid() {
    return currentUser && currentUser.payment_status === 'paid';
  }

  // ══════════════════════════════════════════
  //  PAYMENT MODAL (Razorpay UPI)
  // ══════════════════════════════════════════
  async function openPaymentModal() {
    if (!isLoggedIn()) { openAuthModal('signup'); return; }
    if (isPaid()) { showToast('You already have premium access!', 'success'); return; }

    // Remove existing payment overlay
    const existing = document.querySelector('.payment-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay payment-overlay';
    overlay.innerHTML = `
      <div class="auth-modal payment-modal">
        <button class="auth-close" aria-label="Close">&times;</button>

        <div class="payment-header">
          <div class="payment-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#85c742" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <h2 class="payment-title">Activate Your PixelPlex Account</h2>
          <p class="payment-subtitle">One-time activation fee to start purchasing and streaming content</p>
        </div>

        <div class="payment-plan">
          <div class="plan-badge">BEST VALUE</div>
          <div class="plan-price">
            <span class="plan-currency">₹</span>
            <span class="plan-amount">99</span>
            <span class="plan-period">/ one-time</span>
          </div>
          <ul class="plan-features">
            <li>✓ Account activation — one-time fee</li>
            <li>✓ Browse and purchase individual videos</li>
            <li>✓ HD quality streaming on all devices</li>
            <li>✓ Access your purchased content anytime</li>
          </ul>
        </div>

        <div class="payment-methods">
          <span class="payment-methods-label">Pay securely via</span>
          <div class="payment-badges">
            <span class="pay-badge">UPI</span>
            <span class="pay-badge">Cards</span>
            <span class="pay-badge">Net Banking</span>
            <span class="pay-badge">Wallets</span>
          </div>
        </div>

        <button class="payment-btn" id="pay-now-btn">
          <span class="payment-btn-text">Pay ₹99 Now</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>

        <p class="payment-disclaimer">
          Secured by Razorpay. UPI, Cards, Net Banking accepted.<br>
          <a href="info.html#refund" target="_blank">Refund Policy</a>
        </p>
      </div>`;

    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelector('.auth-close').addEventListener('click', () => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('show');
        overlay.addEventListener('transitionend', () => overlay.remove());
      }
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') {
        overlay.classList.remove('show');
        overlay.addEventListener('transitionend', () => overlay.remove());
        document.removeEventListener('keydown', esc);
      }
    });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Fetch payment config
    let config;
    try {
      const res = await fetch('/api/payment/config');
      config = await res.json();
    } catch (err) {
      console.error('Payment config error:', err);
      showToast('Payment system unavailable. Please try later.', 'info');
      return;
    }

    // Update displayed amount dynamically
    const amountRupees = Math.round(config.amount / 100);
    overlay.querySelector('.plan-amount').textContent = amountRupees;
    overlay.querySelector('.payment-btn-text').textContent = `Pay ₹${amountRupees} Now`;

    // Pay button
    overlay.querySelector('#pay-now-btn').addEventListener('click', async () => {
      if (!config.enabled) {
        showToast('Payment gateway not configured yet. Contact support.', 'info');
        return;
      }

      const payBtn = overlay.querySelector('#pay-now-btn');
      payBtn.disabled = true;
      payBtn.querySelector('.payment-btn-text').textContent = 'Creating order...';

      try {
        // Create order on server
        const orderRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        const orderData = await orderRes.json();

        if (!orderData.ok) {
          showToast(orderData.error || 'Could not create order', 'info');
          payBtn.disabled = false;
          payBtn.querySelector('.payment-btn-text').textContent = `Pay ₹${amountRupees} Now`;
          return;
        }

        // Open Razorpay Checkout
        const options = {
          key: config.key_id,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: 'PixelPlex',
          description: 'Premium Access',
          order_id: orderData.order.id,
          prefill: {
            name: currentUser.username,
            email: currentUser.email
          },
          theme: { color: '#85c742' },
          method: { upi: true, card: true, netbanking: true, wallet: true },
          handler: async function(response) {
            // Verify payment on server
            try {
              const verifyRes = await fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();

              if (verifyData.ok) {
                currentUser.payment_status = 'paid';
                updateHeaderForAuth();

                overlay.classList.remove('show');
                overlay.addEventListener('transitionend', () => overlay.remove());

                showToast('Account activated! You can now purchase videos.', 'success');

                // Check if there's a pending video purchase
                if (window._pendingVideoId) {
                  const pendingId = window._pendingVideoId;
                  window._pendingVideoId = null;
                  setTimeout(() => openVideoPaymentModal(pendingId), 500);
                }
              } else {
                showToast(verifyData.error || 'Payment verification failed', 'info');
              }
            } catch (err) {
              console.error('Payment verify error:', err);
              showToast('Could not verify payment. Contact support.', 'info');
            }
          },
          modal: {
            ondismiss: function() {
              payBtn.disabled = false;
              payBtn.querySelector('.payment-btn-text').textContent = `Pay ₹${amountRupees} Now`;
              showToast('Payment cancelled. You can pay anytime from your profile.', 'info');
            }
          }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          console.error('Payment failed:', response.error);
          showToast(`Payment failed: ${response.error.description}`, 'info');
          payBtn.disabled = false;
          payBtn.querySelector('.payment-btn-text').textContent = `Pay ₹${amountRupees} Now`;
        });
        rzp.open();

      } catch (err) {
        console.error('Payment error:', err);
        showToast('Something went wrong. Please try again.', 'info');
        payBtn.disabled = false;
        payBtn.querySelector('.payment-btn-text').textContent = `Pay ₹${amountRupees} Now`;
      }
    });
  }


  // ══════════════════════════════════════════
  //  VIDEO DATA LAYER
  // ══════════════════════════════════════════

  async function fetchVideos() {
    try {
      // Fetch categories with videos (dynamic content)
      const catRes = await fetch('/api/categories', { credentials: 'include' });
      const catData = await catRes.json();

      // Also fetch videos with purchase status
      const vidRes = await fetch('/api/videos', { credentials: 'include' });
      const vidData = await vidRes.json();

      if (vidData.ok && vidData.videos) {
        videoDataMap = {};
        userPurchasedIds = new Set();
        vidData.videos.forEach(v => {
          videoDataMap[v.id] = v;
          if (v.purchased) userPurchasedIds.add(v.id);
        });
      }

      if (catData.ok && catData.categories) {
        renderDynamicCategories(catData.categories);
      }
      // If API fails, skeleton placeholders remain visible
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      // Keep skeleton placeholders visible — they show the page layout
    }
  }

  function renderDynamicCategories(categories) {
    const container = document.getElementById('categories-container');
    if (!container) return;

    // If API returned no categories at all, keep the skeleton placeholders
    if (categories.length === 0) return;

    let html = '';
    categories.forEach(cat => {
      const sportFilter = cat.slug || 'all';
      const hasVideos = cat.videos && cat.videos.length > 0;

      html += `
        <section class="section" data-sport="${sportFilter}">
          <div class="section-header">
            <h2 class="section-title"><span class="accent-bar"></span> ${cat.icon || ''} ${escapeHtml(cat.name)}</h2>
            <a href="#" class="section-more">View all →</a>
          </div>
          <div class="video-grid">
      `;

      if (hasVideos) {
        cat.videos.forEach(v => {
          const video = videoDataMap[v.id] || v;
          const purchased = userPurchasedIds.has(v.id);
          const thumbUrl = video.thumbnail_url || '';
          const tag = video.tag ? `<span class="video-tag${video.tag === 'TRENDING' ? ' tag-trending' : ''}">${escapeHtml(video.tag)}</span>` : '';
          const liveDot = video.is_live ? '<span class="live-indicator"><span class="live-dot"></span> LIVE</span>' : '';
          const premiumBadge = video.is_premium ? '<span class="video-premium-tag">PREMIUM</span>' : '';

          html += `
              <a class="video-card${purchased ? ' purchased' : ''}" data-video-id="${v.id}" href="#">
                <div class="video-thumb" style="background-image: url('${escapeHtml(thumbUrl)}')">
                  ${liveDot}
                  ${premiumBadge}
                  <span class="video-duration">${video.duration && video.duration !== '0:00' ? video.duration : ''}</span>
                  <div class="video-thumb-overlay">
                    <div class="play-btn"><svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg></div>
                  </div>
                </div>
                <div class="video-info">
                  <div class="video-title">${escapeHtml(video.title)}</div>
                </div>
              </a>
          `;
        });
      } else {
        // Empty category — show skeleton placeholders
        for (let i = 0; i < 4; i++) {
          html += `<div class="skeleton-card"><div class="skeleton-thumb"></div><div class="skeleton-info"><div class="skeleton-line w-title"></div><div class="skeleton-line w-meta"></div></div></div>`;
        }
      }

      html += `
          </div>
        </section>
      `;
    });

    container.innerHTML = html;

    // Re-attach click handlers to video cards
    container.querySelectorAll('.video-card[data-video-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const videoId = parseInt(card.getAttribute('data-video-id'));
        showPremiumOrPlay(videoId);
      });
    });

    // Apply sidebar filter if active
    applySidebarFilter();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function updateVideoCards() {
    // For dynamically rendered cards, re-fetch and re-render
    // This is called after purchase etc
    fetchVideos();
  }


  // ══════════════════════════════════════════
  //  SHOW PREMIUM OR PLAY (video-aware)
  // ══════════════════════════════════════════
  function showPremiumOrPlay(videoId) {
    if (!isLoggedIn()) {
      window._pendingVideoId = videoId || null;
      openAuthModal('signup');
      return;
    }
    if (videoId) {
      openVideoPlayer(videoId);
    } else {
      showToast('Loading stream...', 'success');
    }
  }


  // ══════════════════════════════════════════
  //  VIDEO PAYMENT MODAL
  // ══════════════════════════════════════════
  async function openVideoPaymentModal(videoId) {
    if (!isLoggedIn()) { openAuthModal('signup'); return; }

    const video = videoDataMap[videoId];
    if (!video) { showToast('Video not found', 'info'); return; }
    if (video.purchased) {
      showToast('You already own this video!', 'success');
      openVideoPlayer(videoId);
      return;
    }

    // Remove existing video payment overlay
    const existing = document.querySelector('.video-payment-overlay');
    if (existing) existing.remove();

    const priceRupees = video.price_rupees;

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay video-payment-overlay';
    overlay.innerHTML = `
      <div class="auth-modal payment-modal">
        <button class="auth-close" aria-label="Close">&times;</button>

        <img class="video-purchase-thumb" src="${video.thumbnail_url}" alt="${video.title}">
        <div class="video-purchase-category">${video.category}</div>
        <div class="video-purchase-title">${video.title}</div>

        <div class="payment-plan" style="margin-top:16px;">
          <div class="plan-price">
            <span class="plan-currency">₹</span>
            <span class="plan-amount">${priceRupees}</span>
            <span class="plan-period">/ one-time</span>
          </div>
        </div>

        <div class="payment-methods">
          <span class="payment-methods-label">Pay securely via</span>
          <div class="payment-badges">
            <span class="pay-badge">UPI</span>
            <span class="pay-badge">Cards</span>
            <span class="pay-badge">Net Banking</span>
            <span class="pay-badge">Wallets</span>
          </div>
        </div>

        <button class="payment-btn" id="video-pay-btn">
          <span class="payment-btn-text">Buy for ₹${priceRupees}</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>

        <p class="payment-disclaimer">
          Secured by Razorpay. One-time purchase — watch anytime.<br>
          <a href="info.html#refund" target="_blank">Refund Policy</a>
        </p>
      </div>`;

    document.body.appendChild(overlay);

    // Close handlers
    const closeOverlay = () => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
    };
    overlay.querySelector('.auth-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { closeOverlay(); document.removeEventListener('keydown', esc); }
    });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Fetch payment config for this video
    let config;
    try {
      const res = await fetch(`/api/payment/config?video_id=${videoId}`);
      config = await res.json();
    } catch (err) {
      showToast('Payment system unavailable', 'info');
      return;
    }

    // Pay button handler
    overlay.querySelector('#video-pay-btn').addEventListener('click', async () => {
      if (!config.enabled) {
        showToast('Payment gateway not configured yet. Contact support.', 'info');
        return;
      }

      const payBtn = overlay.querySelector('#video-pay-btn');
      payBtn.disabled = true;
      payBtn.querySelector('.payment-btn-text').textContent = 'Creating order...';

      try {
        const orderRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ video_id: videoId })
        });
        const orderData = await orderRes.json();

        if (!orderData.ok) {
          showToast(orderData.error || 'Could not create order', 'info');
          payBtn.disabled = false;
          payBtn.querySelector('.payment-btn-text').textContent = `Buy for ₹${priceRupees}`;
          return;
        }

        const options = {
          key: config.key_id,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: 'PixelPlex',
          description: video.title,
          order_id: orderData.order.id,
          prefill: { name: currentUser.username, email: currentUser.email },
          theme: { color: '#85c742' },
          method: { upi: true, card: true, netbanking: true, wallet: true },
          handler: async function(response) {
            try {
              const verifyRes = await fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  video_id: videoId
                })
              });
              const verifyData = await verifyRes.json();

              if (verifyData.ok) {
                userPurchasedIds.add(videoId);
                if (videoDataMap[videoId]) videoDataMap[videoId].purchased = true;
                updateVideoCards();

                closeOverlay();
                showToast('Purchase successful! Opening video...', 'success');

                setTimeout(() => openVideoPlayer(videoId), 500);
              } else {
                showToast(verifyData.error || 'Verification failed', 'info');
              }
            } catch (err) {
              console.error('Video payment verify error:', err);
              showToast('Could not verify payment. Contact support.', 'info');
            }
          },
          modal: {
            ondismiss: function() {
              payBtn.disabled = false;
              payBtn.querySelector('.payment-btn-text').textContent = `Buy for ₹${priceRupees}`;
            }
          }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          showToast(`Payment failed: ${response.error.description}`, 'info');
          payBtn.disabled = false;
          payBtn.querySelector('.payment-btn-text').textContent = `Buy for ₹${priceRupees}`;
        });
        rzp.open();

      } catch (err) {
        console.error('Video payment error:', err);
        showToast('Something went wrong. Please try again.', 'info');
        payBtn.disabled = false;
        payBtn.querySelector('.payment-btn-text').textContent = `Buy for ₹${priceRupees}`;
      }
    });
  }


  // ══════════════════════════════════════════
  //  VIDEO CARD CLICK → AUTH/PURCHASE
  // ══════════════════════════════════════════
  document.querySelectorAll('.video-card[data-video-id]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const videoId = parseInt(card.getAttribute('data-video-id'));
      showPremiumOrPlay(videoId);
    });
  });


  // ══════════════════════════════════════════
  //  SIDEBAR SPORT FILTERING
  // ══════════════════════════════════════════
  const sidebarItems = document.querySelectorAll('.sidebar-item[data-filter]');

  function filterBySport(sport) {
    // Re-query sections since they're dynamically rendered
    const sportSections = document.querySelectorAll('.section[data-sport]');
    sportSections.forEach(section => {
      const sectionSport = section.getAttribute('data-sport');
      if (sport === 'all' || sectionSport === sport || sectionSport === 'all') {
        section.style.display = '';
        section.style.animation = 'none';
        section.offsetHeight;
        section.style.animation = '';
      } else {
        section.style.display = 'none';
      }
    });
  }

  function applySidebarFilter() {
    const activeItem = document.querySelector('.sidebar-item[data-filter].active');
    const filter = activeItem ? activeItem.getAttribute('data-filter') : 'all';
    filterBySport(filter);
  }

  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Clear any active tags
      document.querySelectorAll('.sidebar-tag').forEach(t => {
        t.classList.remove('active');
        t.style.background = '';
        t.style.borderColor = '';
        t.style.color = '';
      });

      // Show all video cards (clear tag filtering)
      document.querySelectorAll('.video-card').forEach(card => card.style.display = '');

      const filter = item.getAttribute('data-filter');
      filterBySport(filter);
      const label = item.textContent.trim().split('\n')[0].trim();
      showToast(filter === 'all' ? 'Showing all sports' : `Showing ${label}`);
    });
  });


  // ── Sidebar Tags ──
  function filterByTag(tagText) {
    const allSections = document.querySelectorAll('.section[data-sport]');
    const allCards = document.querySelectorAll('.video-card');
    let matchCount = 0;

    // Show all sections first
    allSections.forEach(section => {
      section.style.display = '';
    });

    // Filter video cards by tag
    allCards.forEach(card => {
      const title = (card.querySelector('.video-title')?.textContent || '').toLowerCase();
      const category = (card.querySelector('.video-category')?.textContent || '').toLowerCase();
      const searchText = (title + ' ' + category).toLowerCase();
      const tagLower = tagText.toLowerCase();

      if (searchText.includes(tagLower)) {
        card.style.display = '';
        matchCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Hide sections that have no visible cards
    allSections.forEach(section => {
      const visibleCards = section.querySelectorAll('.video-card:not([style*="display: none"])');
      if (visibleCards.length === 0) {
        section.style.display = 'none';
      }
    });

    return matchCount;
  }

  document.querySelectorAll('.sidebar-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const wasActive = tag.classList.contains('active');
      const tagText = tag.textContent.trim();

      // Clear all tag active states
      document.querySelectorAll('.sidebar-tag').forEach(t => {
        t.classList.remove('active');
        t.style.background = '';
        t.style.borderColor = '';
        t.style.color = '';
      });

      // Clear sidebar filter active states
      sidebarItems.forEach(i => i.classList.remove('active'));

      if (!wasActive) {
        // Activate this tag
        tag.classList.add('active');
        tag.style.background = 'rgba(133,199,66,0.15)';
        tag.style.borderColor = 'rgba(133,199,66,0.3)';
        tag.style.color = '#85c742';

        // Filter videos by tag
        const matchCount = filterByTag(tagText);
        showToast(matchCount > 0 ? `Showing ${matchCount} videos for "${tagText}"` : `No videos found for "${tagText}"`);
      } else {
        // Deactivate - show all
        const allSections = document.querySelectorAll('.section[data-sport]');
        const allCards = document.querySelectorAll('.video-card');

        allSections.forEach(section => section.style.display = '');
        allCards.forEach(card => card.style.display = '');

        // Reactivate "All Sports" in sidebar
        const allItem = document.querySelector('.sidebar-item[data-filter="all"]');
        if (allItem) allItem.classList.add('active');

        showToast('Showing all videos');
      }
    });
  });


  // ══════════════════════════════════════════
  //  HEADER NAV
  // ══════════════════════════════════════════
  document.querySelectorAll('.header-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.header-nav a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const text = link.textContent.trim();

      if (text === 'Home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Clear tag filters
        document.querySelectorAll('.sidebar-tag').forEach(t => {
          t.classList.remove('active');
          t.style.background = '';
          t.style.borderColor = '';
          t.style.color = '';
        });
        document.querySelectorAll('.video-card').forEach(card => card.style.display = '');

        filterBySport('all');
        sidebarItems.forEach(i => i.classList.remove('active'));
        const allItem = document.querySelector('.sidebar-item[data-filter="all"]');
        if (allItem) allItem.classList.add('active');
      }
      if (text === 'Browse') {
        const firstSection = document.querySelector('.section[data-sport]');
        if (firstSection) firstSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Clear tag filters
        document.querySelectorAll('.sidebar-tag').forEach(t => {
          t.classList.remove('active');
          t.style.background = '';
          t.style.borderColor = '';
          t.style.color = '';
        });
        document.querySelectorAll('.video-card').forEach(card => card.style.display = '');

        filterBySport('all');
        sidebarItems.forEach(i => i.classList.remove('active'));
        const allItem = document.querySelector('.sidebar-item[data-filter="all"]');
        if (allItem) allItem.classList.add('active');
        showToast('Browse all sports');
      }
      if (text === 'Schedule') {
        const schedule = document.querySelector('.schedule-table');
        if (schedule) schedule.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });


  // ══════════════════════════════════════════
  //  WALLET MODALS
  // ══════════════════════════════════════════

  // Open Add Money Modal
  function openAddMoneyModal() {
    if (!currentUser) {
      openAuthModal('signin');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay wallet-modal-overlay';

    const presetAmounts = [
      { value: 10000, label: '₹100' },
      { value: 20000, label: '₹200' },
      { value: 50000, label: '₹500' },
      { value: 100000, label: '₹1000' },
      { value: 200000, label: '₹2000' }
    ];

    let selectedAmount = 50000; // default ₹500

    overlay.innerHTML = `
      <div class="auth-modal wallet-modal" style="max-width: 450px; animation: slideUp 0.3s ease;">
        <button class="auth-close" aria-label="Close">&times;</button>

        <h2 style="margin: 0 0 8px; font-size: 24px; text-align: center;">💰 Add Money to Wallet</h2>
        <p style="margin: 0 0 24px; color: rgba(255,255,255,0.6); text-align: center; font-size: 14px;">Choose an amount to add to your wallet</p>

        <div class="amount-options" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
          ${presetAmounts.map(amt => `
            <button class="amount-chip ${amt.value === selectedAmount ? 'selected' : ''}"
                    data-amount="${amt.value}"
                    style="padding: 14px; background: ${amt.value === selectedAmount ? 'var(--accent)' : 'rgba(255,255,255,0.05)'};
                           color: ${amt.value === selectedAmount ? '#111' : '#fff'}; border: 1px solid ${amt.value === selectedAmount ? 'var(--accent)' : 'rgba(255,255,255,0.1)'};
                           border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 15px;">
              ${amt.label}
            </button>
          `).join('')}
        </div>

        <div class="custom-amount" style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; color: rgba(255,255,255,0.7);">Or enter custom amount</label>
          <input type="number"
                 class="custom-amount-input"
                 placeholder="Enter amount in ₹"
                 min="10"
                 max="10000"
                 style="width: 100%; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 8px; color: #fff; font-size: 16px;">
        </div>

        <button class="wallet-add-btn payment-btn"
                style="width: 100%; padding: 16px; background: linear-gradient(135deg, var(--accent), #6aad2d);
                       color: #111; border: none; border-radius: 8px; font-weight: 700; font-size: 16px; cursor: pointer;">
          <span class="payment-btn-text">Add ₹${Math.round(selectedAmount / 100)} to Wallet</span>
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Amount chip selection
    overlay.querySelectorAll('.amount-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        selectedAmount = parseInt(chip.dataset.amount);
        overlay.querySelectorAll('.amount-chip').forEach(c => {
          c.classList.remove('selected');
          c.style.background = 'rgba(255,255,255,0.05)';
          c.style.color = '#fff';
          c.style.borderColor = 'rgba(255,255,255,0.1)';
        });
        chip.classList.add('selected');
        chip.style.background = 'var(--accent)';
        chip.style.color = '#111';
        chip.style.borderColor = 'var(--accent)';
        overlay.querySelector('.payment-btn-text').textContent = `Add ₹${Math.round(selectedAmount / 100)} to Wallet`;
        overlay.querySelector('.custom-amount-input').value = '';
      });
    });

    // Custom amount input
    const customInput = overlay.querySelector('.custom-amount-input');
    customInput.addEventListener('input', () => {
      const customAmount = parseInt(customInput.value) * 100; // convert to paise
      if (customAmount >= 1000 && customAmount <= 1000000) {
        selectedAmount = customAmount;
        overlay.querySelectorAll('.amount-chip').forEach(c => {
          c.classList.remove('selected');
          c.style.background = 'rgba(255,255,255,0.05)';
          c.style.color = '#fff';
          c.style.borderColor = 'rgba(255,255,255,0.1)';
        });
        overlay.querySelector('.payment-btn-text').textContent = `Add ₹${Math.round(selectedAmount / 100)} to Wallet`;
      }
    });

    // Add money button
    overlay.querySelector('.wallet-add-btn').addEventListener('click', async () => {
      if (selectedAmount < 1000 || selectedAmount > 1000000) {
        showToast('Amount must be between ₹10 and ₹10,000', 'info');
        return;
      }

      await processWalletDeposit(selectedAmount, overlay);
    });

    // Close handlers
    const closeOverlay = () => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
    };
    overlay.querySelector('.auth-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  // Process wallet deposit (Razorpay)
  async function processWalletDeposit(amount, modalOverlay) {
    try {
      const btn = modalOverlay.querySelector('.wallet-add-btn');
      btn.disabled = true;
      btn.querySelector('.payment-btn-text').textContent = 'Creating order...';

      // Create Razorpay order
      const orderRes = await fetch('/api/wallet/add-money/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount })
      });

      const orderData = await orderRes.json();
      if (!orderData.ok) {
        showToast(orderData.error, 'info');
        btn.disabled = false;
        btn.querySelector('.payment-btn-text').textContent = `Add ₹${Math.round(amount / 100)} to Wallet`;
        return;
      }

      const options = {
        key: orderData.order.key_id || window.RAZORPAY_KEY_ID,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'PixelPlex',
        description: `Add ₹${Math.round(amount / 100)} to Wallet`,
        order_id: orderData.order.id,
        prefill: {
          name: currentUser.username,
          email: currentUser.email
        },
        theme: { color: '#85c742' },
        handler: async (response) => {
          // Verify payment
          const verifyRes = await fetch('/api/wallet/add-money/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount
            })
          });

          const verifyData = await verifyRes.json();
          if (verifyData.ok) {
            walletBalance = verifyData.new_balance;
            walletBalanceRupees = verifyData.new_balance_rupees;
            updateWalletDisplay();
            modalOverlay.remove();
            showToast(`₹${Math.round(amount / 100)} added to wallet successfully!`, 'success');
          } else {
            showToast(verifyData.error, 'info');
            btn.disabled = false;
            btn.querySelector('.payment-btn-text').textContent = `Add ₹${Math.round(amount / 100)} to Wallet`;
          }
        },
        modal: {
          ondismiss: () => {
            btn.disabled = false;
            btn.querySelector('.payment-btn-text').textContent = `Add ₹${Math.round(amount / 100)} to Wallet`;
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error('Wallet deposit error:', err);
      showToast('Failed to process deposit', 'info');
      const btn = modalOverlay.querySelector('.wallet-add-btn');
      btn.disabled = false;
      btn.querySelector('.payment-btn-text').textContent = `Add ₹${Math.round(amount / 100)} to Wallet`;
    }
  }

  // Open Purchase Options Modal
  function openPurchaseOptionsModal(videoId) {
    const videoData = videoDataMap[videoId];
    if (!videoData) return;

    const videoPrice = videoData.price;
    const videoPriceRupees = videoData.price_rupees;
    const hasSufficientBalance = walletBalance >= videoPrice;
    const remainingBalance = walletBalance - videoPrice;

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay purchase-options-overlay';

    overlay.innerHTML = `
      <div class="auth-modal purchase-options-modal" style="max-width: 500px; animation: slideUp 0.3s ease;">
        <button class="auth-close" aria-label="Close">&times;</button>

        <h2 style="margin: 0 0 20px; font-size: 22px; text-align: center;">Choose Payment Method</h2>

        <div class="video-preview" style="display: flex; gap: 15px; margin-bottom: 20px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
          <img src="${videoData.thumbnail_url}" style="width: 120px; height: 68px; object-fit: cover; border-radius: 6px;">
          <div style="flex: 1;">
            <h3 style="margin: 0 0 5px; font-size: 16px; line-height: 1.3;">${videoData.title}</h3>
            <div style="font-size: 13px; color: rgba(255,255,255,0.5);">${videoData.category}</div>
            <div style="margin-top: 8px; font-size: 20px; font-weight: 700; color: var(--accent);">₹${videoPriceRupees}</div>
          </div>
        </div>

        <div class="payment-methods" style="display: flex; flex-direction: column; gap: 12px;">
          <button class="pay-method wallet-pay"
                  ${!hasSufficientBalance ? 'disabled' : ''}
                  style="padding: 16px; background: ${hasSufficientBalance ? 'linear-gradient(135deg, var(--accent), #6aad2d)' : 'rgba(255,255,255,0.05)'};
                         color: ${hasSufficientBalance ? '#111' : 'rgba(255,255,255,0.3)'}; border: none; border-radius: 10px;
                         cursor: ${hasSufficientBalance ? 'pointer' : 'not-allowed'}; text-align: left; transition: all 0.2s;">
            <div class="method-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 16px; font-weight: 700;">💰 Pay from Wallet</span>
              <span class="method-badge" style="padding: 4px 8px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 11px; font-weight: 600;">INSTANT</span>
            </div>
            <div class="method-balance" style="font-size: 13px; opacity: 0.8;">Current Balance: ₹${walletBalanceRupees}</div>
            ${hasSufficientBalance
              ? `<div class="method-remaining" style="font-size: 13px; opacity: 0.8;">After purchase: ₹${Math.round(remainingBalance / 100)}</div>`
              : `<div style="font-size: 13px; color: #ff4444; font-weight: 600; margin-top: 4px;">Insufficient balance</div>`
            }
          </button>

          <button class="pay-method direct-pay"
                  style="padding: 16px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);
                         border-radius: 10px; cursor: pointer; text-align: left; transition: all 0.2s;">
            <div class="method-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 16px; font-weight: 700;">💳 Pay Directly</span>
            </div>
            <div class="method-options" style="font-size: 13px; opacity: 0.7;">UPI • Cards • Net Banking • Wallets</div>
          </button>
        </div>

        ${!hasSufficientBalance
          ? `<a href="#" class="add-money-link" style="display: block; text-align: center; margin-top: 15px; color: var(--accent);
                 font-size: 14px; text-decoration: none; font-weight: 600;">
               Don't have enough balance? Add money to wallet →
             </a>`
          : ''
        }
      </div>
    `;

    document.body.appendChild(overlay);

    // Wallet payment button
    const walletPayBtn = overlay.querySelector('.wallet-pay');
    if (hasSufficientBalance) {
      walletPayBtn.addEventListener('click', async () => {
        overlay.remove();
        await purchaseWithWallet(videoId);
      });
    }

    // Direct payment button
    overlay.querySelector('.direct-pay').addEventListener('click', () => {
      overlay.remove();
      openVideoPaymentModal(videoId); // Use existing Razorpay flow
    });

    // Add money link
    if (!hasSufficientBalance) {
      overlay.querySelector('.add-money-link').addEventListener('click', (e) => {
        e.preventDefault();
        overlay.remove();
        openAddMoneyModal();
      });
    }

    // Close handlers
    const closeOverlay = () => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
    };
    overlay.querySelector('.auth-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  // Purchase video with wallet
  async function purchaseWithWallet(videoId) {
    try {
      const res = await fetch('/api/wallet/purchase-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ video_id: videoId })
      });

      const data = await res.json();

      if (data.ok) {
        // Update wallet balance
        walletBalance = data.remaining_balance;
        walletBalanceRupees = data.remaining_balance_rupees;
        updateWalletDisplay();

        // Update video data
        userPurchasedIds.add(videoId);
        if (videoDataMap[videoId]) {
          videoDataMap[videoId].purchased = true;
        }
        updateVideoCards();

        // Show success toast and open video
        showToast('Video purchased successfully! Opening video...', 'success');
        setTimeout(() => openVideoPlayer(videoId), 500);
      } else {
        showToast(data.error, 'info');
      }
    } catch (err) {
      console.error('Wallet purchase error:', err);
      showToast('Failed to complete purchase', 'info');
    }
  }

  // Open Video Player Modal
  function getYouTubeId(url) {
    if (!url) return null;
    // Match youtube.com/watch?v=ID
    let match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    // Match youtu.be/ID
    match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    // Match youtube.com/embed/ID
    match = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    return null;
  }

  function openVideoPlayer(videoId) {
    const video = videoDataMap[videoId];
    if (!video) {
      showToast('Video not found', 'info');
      return;
    }

    if (!video.video_url) {
      showToast('Video URL not available', 'info');
      return;
    }

    // Determine player type based on source_type
    const isR2 = video.source_type === 'r2';
    let playerHtml;

    if (isR2) {
      // Self-hosted video — use HTML5 video tag
      playerHtml = `
        <video id="main-video-player" controls autoplay
          style="width: 100%; height: 100%; background: #000;"
          src="${video.video_url}">
          Your browser does not support the video tag.
        </video>`;
    } else {
      // YouTube video — use iframe embed
      const ytId = getYouTubeId(video.video_url);
      let embedUrl;
      if (ytId) {
        embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`;
      } else if (video.video_url.includes('youtube.com/results')) {
        const searchParams = new URL(video.video_url).searchParams;
        const query = searchParams.get('search_query') || video.title;
        embedUrl = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=1`;
      } else {
        window.open(video.video_url, '_blank');
        return;
      }
      playerHtml = `
        <iframe id="main-video-player" src="${embedUrl}"
          style="width: 100%; height: 100%; border: none;"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen></iframe>`;
    }

    const categoryLabel = video.category || '';

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay video-player-overlay';
    overlay.style.background = 'rgba(0, 0, 0, 0.95)';
    overlay.style.zIndex = '999';

    overlay.innerHTML = `
      <div class="video-player-modal" style="width: 90%; max-width: 1200px; margin: 0 auto; position: relative; animation: slideUp 0.3s ease;">
        <button class="video-player-close" style="position: absolute; top: -50px; right: 0; background: rgba(255,255,255,0.1); border: none; width: 40px; height: 40px; border-radius: 50%; color: #fff; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;">
          &times;
        </button>

        <div class="video-player-container" style="position: relative; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5); aspect-ratio: 16/9;">
          ${playerHtml}
        </div>

        <div class="video-info-section" style="margin-top: 20px; padding: 16px 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;">
          <div style="display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 0;">
              <h2 style="margin: 0 0 6px; font-size: 20px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${video.title}</h2>
              <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <span style="padding: 3px 10px; background: rgba(133,199,66,0.15); border: 1px solid rgba(133,199,66,0.3); border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">${categoryLabel}</span>
                ${video.duration && video.duration !== '0:00' ? `<span style="color: rgba(255,255,255,0.5); font-size: 13px;">${video.duration}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('.video-player-close');

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.2)';
      closeBtn.style.transform = 'scale(1.1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.1)';
      closeBtn.style.transform = 'scale(1)';
    });

    const closePlayer = () => {
      // Stop playback
      const iframe = overlay.querySelector('iframe');
      if (iframe) iframe.src = '';
      const videoEl = overlay.querySelector('video');
      if (videoEl) { videoEl.pause(); videoEl.src = ''; }
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 300);
    };

    closeBtn.addEventListener('click', closePlayer);

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closePlayer();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePlayer();
    });

    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  // Open Profile Page Modal
  async function openProfilePage() {
    if (!currentUser) {
      openAuthModal('signin');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay profile-modal-overlay';

    overlay.innerHTML = `
      <div class="auth-modal profile-modal" style="max-width: 850px; max-height: 85vh; display: flex; flex-direction: column; animation: slideUp 0.3s ease;">
        <button class="auth-close" aria-label="Close">&times;</button>

        <!-- Profile Header -->
        <div class="profile-header" style="display: flex; gap: 20px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
          <div class="profile-avatar" id="profile-avatar-display" style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--accent), #6aad2d); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 700; color: #111; flex-shrink: 0;">
            ${currentUser.username.charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1;">
            <h2 id="profile-username-display" style="margin: 0 0 8px; font-size: 28px;">${currentUser.username}</h2>
            <p id="profile-email-display" style="margin: 0 0 8px; color: rgba(255,255,255,0.6); font-size: 14px;">${currentUser.email}</p>
            <span style="padding: 4px 12px; background: rgba(255,255,255,0.05); border-radius: 12px; font-size: 12px; color: rgba(255,255,255,0.5);">
              Wallet: ₹${walletBalanceRupees}
            </span>
          </div>
        </div>

        <!-- Profile Tabs -->
        <div style="display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
          <button class="profile-tab active" data-profile-tab="details" style="padding: 10px 20px; background: none; border: none; border-bottom: 2px solid var(--accent); color: var(--accent); font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s;">Account Details</button>
          <button class="profile-tab" data-profile-tab="videos" style="padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent; color: rgba(255,255,255,0.5); font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s;">My Videos</button>
          <button class="profile-tab" data-profile-tab="password" style="padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent; color: rgba(255,255,255,0.5); font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s;">Change Password</button>
        </div>

        <!-- Tab Content: Account Details -->
        <div class="profile-tab-content" data-profile-content="details" style="flex: 1; overflow-y: auto;">
          <form id="profile-details-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="auth-field">
              <label class="auth-label" style="margin-bottom: 6px; display: block; font-size: 13px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px;">Username</label>
              <input type="text" class="auth-input" name="username" value="${currentUser.username}" style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 15px; outline: none; transition: border-color 0.2s;">
            </div>
            <div class="auth-field">
              <label class="auth-label" style="margin-bottom: 6px; display: block; font-size: 13px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px;">Email</label>
              <input type="email" class="auth-input" name="email" value="${currentUser.email}" style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 15px; outline: none; transition: border-color 0.2s;">
            </div>
            <div class="auth-field">
              <label class="auth-label" style="margin-bottom: 6px; display: block; font-size: 13px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px;">Member Since</label>
              <input type="text" class="auth-input" value="${new Date(currentUser.created_at || Date.now()).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}" disabled style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; color: rgba(255,255,255,0.4); font-size: 15px; cursor: not-allowed;">
            </div>
            <div class="profile-save-msg" style="display:none; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;"></div>
            <button type="submit" class="auth-submit-btn" style="padding: 14px; background: linear-gradient(135deg, var(--accent), #6aad2d); color: #111; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.2s;">Save Changes</button>
          </form>
        </div>

        <!-- Tab Content: My Videos -->
        <div class="profile-tab-content" data-profile-content="videos" style="flex: 1; overflow-y: auto; display: none;">
          <div class="purchased-videos-list" style="min-height: 200px;">
            <div style="text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.5);">
              <div style="margin-bottom: 12px; font-size: 14px;">Loading your videos...</div>
            </div>
          </div>
        </div>

        <!-- Tab Content: Change Password -->
        <div class="profile-tab-content" data-profile-content="password" style="flex: 1; overflow-y: auto; display: none;">
          <form id="profile-password-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="auth-field">
              <label class="auth-label" style="margin-bottom: 6px; display: block; font-size: 13px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px;">Current Password</label>
              <input type="password" class="auth-input" name="currentPassword" placeholder="Enter current password" required style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 15px; outline: none;">
            </div>
            <div class="auth-field">
              <label class="auth-label" style="margin-bottom: 6px; display: block; font-size: 13px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px;">New Password</label>
              <input type="password" class="auth-input" name="newPassword" placeholder="Enter new password (min 6 chars)" required minlength="6" style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 15px; outline: none;">
            </div>
            <div class="auth-field">
              <label class="auth-label" style="margin-bottom: 6px; display: block; font-size: 13px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.5px;">Confirm New Password</label>
              <input type="password" class="auth-input" name="confirmPassword" placeholder="Confirm new password" required minlength="6" style="width: 100%; padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 15px; outline: none;">
            </div>
            <div class="password-save-msg" style="display:none; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;"></div>
            <button type="submit" class="auth-submit-btn" style="padding: 14px; background: linear-gradient(135deg, var(--accent), #6aad2d); color: #111; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.2s;">Update Password</button>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Tab switching
    overlay.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        overlay.querySelectorAll('.profile-tab').forEach(t => {
          t.classList.remove('active');
          t.style.borderBottomColor = 'transparent';
          t.style.color = 'rgba(255,255,255,0.5)';
        });
        tab.classList.add('active');
        tab.style.borderBottomColor = 'var(--accent)';
        tab.style.color = 'var(--accent)';
        const target = tab.dataset.profileTab;
        overlay.querySelectorAll('.profile-tab-content').forEach(c => c.style.display = 'none');
        overlay.querySelector(`[data-profile-content="${target}"]`).style.display = '';
        if (target === 'videos') loadPurchasedVideos();
      });
    });

    // Account details form submit
    overlay.querySelector('#profile-details-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('.auth-submit-btn');
      const msgEl = form.querySelector('.profile-save-msg');
      const newUsername = form.username.value.trim();
      const newEmail = form.email.value.trim();

      btn.disabled = true;
      btn.textContent = 'Saving...';
      msgEl.style.display = 'none';

      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: newUsername, email: newEmail })
        });
        const data = await res.json();

        if (data.ok) {
          msgEl.textContent = data.message || 'Profile updated successfully!';
          msgEl.style.display = 'block';
          msgEl.style.background = 'rgba(133,199,66,0.15)';
          msgEl.style.color = 'var(--accent)';
          if (data.user) {
            currentUser.username = data.user.username;
            currentUser.email = data.user.email;
            overlay.querySelector('#profile-username-display').textContent = data.user.username;
            overlay.querySelector('#profile-email-display').textContent = data.user.email;
            overlay.querySelector('#profile-avatar-display').textContent = data.user.username.charAt(0).toUpperCase();
            updateHeaderForAuth();
          }
        } else {
          msgEl.textContent = data.error || 'Failed to update';
          msgEl.style.display = 'block';
          msgEl.style.background = 'rgba(255,107,107,0.15)';
          msgEl.style.color = '#ff6b6b';
        }
      } catch (err) {
        msgEl.textContent = 'Connection error. Please try again.';
        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(255,107,107,0.15)';
        msgEl.style.color = '#ff6b6b';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    });

    // Password form submit
    overlay.querySelector('#profile-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('.auth-submit-btn');
      const msgEl = form.querySelector('.password-save-msg');
      const currentPassword = form.currentPassword.value;
      const newPassword = form.newPassword.value;
      const confirmPassword = form.confirmPassword.value;

      if (newPassword !== confirmPassword) {
        msgEl.textContent = 'New passwords do not match';
        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(255,107,107,0.15)';
        msgEl.style.color = '#ff6b6b';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Updating...';
      msgEl.style.display = 'none';

      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();

        if (data.ok) {
          msgEl.textContent = 'Password updated successfully!';
          msgEl.style.display = 'block';
          msgEl.style.background = 'rgba(133,199,66,0.15)';
          msgEl.style.color = 'var(--accent)';
          form.reset();
        } else {
          msgEl.textContent = data.error || 'Failed to update password';
          msgEl.style.display = 'block';
          msgEl.style.background = 'rgba(255,107,107,0.15)';
          msgEl.style.color = '#ff6b6b';
        }
      } catch (err) {
        msgEl.textContent = 'Connection error. Please try again.';
        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(255,107,107,0.15)';
        msgEl.style.color = '#ff6b6b';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Update Password';
      }
    });

    const purchasedVideosList = overlay.querySelector('.purchased-videos-list');

    // Fetch purchased videos
    async function loadPurchasedVideos() {
      try {
        const res = await fetch('/api/purchases', { credentials: 'include' });
        const data = await res.json();

        if (data.ok) {
          const purchases = data.purchases;

          if (purchases.length === 0) {
            purchasedVideosList.innerHTML = `
              <div style="text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.5);">
                <div style="font-size: 48px; margin-bottom: 16px;">🎥</div>
                <div style="font-size: 16px; margin-bottom: 8px;">No videos purchased yet</div>
                <div style="font-size: 13px; color: rgba(255,255,255,0.3);">Browse our collection and start watching!</div>
              </div>
            `;
          } else {
            purchasedVideosList.innerHTML = purchases.map(purchase => {
              const purchaseDate = new Date(purchase.purchased_at);
              const formattedDate = purchaseDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
              const paymentMethod = purchase.payment_method === 'wallet' ? 'Wallet' : 'Direct';

              return `
                <div class="purchased-video-item" style="display: flex; gap: 16px; padding: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 10px; transition: all 0.2s; cursor: pointer;" data-video-id="${purchase.video_id}">
                  <img src="${purchase.thumbnail_url}" style="width: 140px; height: 80px; object-fit: cover; border-radius: 8px; flex-shrink: 0;">
                  <div style="flex: 1; min-width: 0;">
                    <h4 style="margin: 0 0 6px; font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${purchase.title}</h4>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.5);">
                      <span style="color: var(--accent);">${purchase.category}</span>
                      ${purchase.duration ? ` · ${purchase.duration}` : ''}
                      · ${paymentMethod} · ${formattedDate}
                    </div>
                  </div>
                </div>
              `;
            }).join('');

            purchasedVideosList.querySelectorAll('.purchased-video-item').forEach(item => {
              item.addEventListener('click', () => {
                const videoId = parseInt(item.dataset.videoId);
                overlay.remove();
                setTimeout(() => openVideoPlayer(videoId), 200);
              });
              item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.06)'; item.style.borderColor = 'rgba(133,199,66,0.2)'; });
              item.addEventListener('mouseleave', () => { item.style.background = 'rgba(255,255,255,0.03)'; item.style.borderColor = 'rgba(255,255,255,0.05)'; });
            });
          }
        } else {
          purchasedVideosList.innerHTML = `<div style="text-align:center;padding:40px;color:#ff6b6b;">Failed to load videos</div>`;
        }
      } catch (err) {
        console.error('Error loading purchases:', err);
        purchasedVideosList.innerHTML = `<div style="text-align:center;padding:40px;color:#ff6b6b;">Error loading videos</div>`;
      }
    }

    // Close handlers
    const closeOverlay = () => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
    };
    overlay.querySelector('.auth-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  // Open Transaction History Modal
  async function openTransactionHistory() {
    if (!currentUser) {
      openAuthModal('signin');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay history-modal-overlay';

    overlay.innerHTML = `
      <div class="auth-modal history-modal" style="max-width: 650px; max-height: 80vh; display: flex; flex-direction: column; animation: slideUp 0.3s ease;">
        <button class="auth-close" aria-label="Close">&times;</button>

        <div style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px; margin-bottom: 15px;">
          <h2 style="margin: 0; font-size: 24px;">📜 Transaction History</h2>
        </div>

        <div class="history-tabs" style="display: flex; gap: 10px; padding: 0 0 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <button class="tab active" data-filter="all" style="padding: 8px 16px; background: var(--accent); color: #111; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;">All</button>
          <button class="tab" data-filter="DEPOSIT" style="padding: 8px 16px; background: rgba(255,255,255,0.05); color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;">Deposits</button>
          <button class="tab" data-filter="PURCHASE" style="padding: 8px 16px; background: rgba(255,255,255,0.05); color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;">Purchases</button>
        </div>

        <div class="history-list" style="flex: 1; overflow-y: auto; padding: 20px 0;">
          <div class="loading-spinner" style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">
            Loading transactions...
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const historyList = overlay.querySelector('.history-list');
    let currentFilter = 'all';

    // Fetch transactions
    async function loadTransactions(filter = 'all') {
      try {
        const url = filter === 'all'
          ? '/api/wallet/transactions?limit=50'
          : `/api/wallet/transactions?limit=50&type=${filter}`;

        const res = await fetch(url, { credentials: 'include' });
        const data = await res.json();

        if (data.ok) {
          renderTransactions(data.transactions);
        } else {
          historyList.innerHTML = `<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">Failed to load transactions</div>`;
        }
      } catch (err) {
        console.error('Error loading transactions:', err);
        historyList.innerHTML = `<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">Error loading transactions</div>`;
      }
    }

    function renderTransactions(transactions) {
      if (transactions.length === 0) {
        historyList.innerHTML = `<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.5);">No transactions yet</div>`;
        return;
      }

      historyList.innerHTML = transactions.map(tx => {
        const isDeposit = tx.type === 'DEPOSIT';
        const icon = isDeposit ? '↓' : '🎥';
        const amountColor = isDeposit ? '#4caf50' : '#ff6b6b';
        const amountPrefix = isDeposit ? '+' : '';
        const date = new Date(tx.created_at);
        const formattedDate = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        const formattedTime = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        return `
          <div class="transaction-item ${tx.type.toLowerCase()}" style="display: flex; gap: 15px; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05); transition: all 0.2s;">
            <div class="tx-icon" style="width: 40px; height: 40px; background: ${isDeposit ? 'rgba(76,175,80,0.15)' : 'rgba(255,107,107,0.15)'};
                                         border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
              ${icon}
            </div>
            <div class="tx-details" style="flex: 1; min-width: 0;">
              <div class="tx-title" style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">${tx.description}</div>
              <div class="tx-meta" style="font-size: 12px; color: rgba(255,255,255,0.5);">${formattedDate} • ${formattedTime}</div>
            </div>
            <div class="tx-amount" style="font-size: 18px; font-weight: 700; color: ${amountColor}; flex-shrink: 0;">
              ${amountPrefix}₹${Math.abs(tx.amount_rupees)}
            </div>
          </div>
        `;
      }).join('');
    }

    // Tab switching
    overlay.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.dataset.filter;
        currentFilter = filter;

        overlay.querySelectorAll('.tab').forEach(t => {
          t.classList.remove('active');
          t.style.background = 'rgba(255,255,255,0.05)';
          t.style.color = '#fff';
        });
        tab.classList.add('active');
        tab.style.background = 'var(--accent)';
        tab.style.color = '#111';

        loadTransactions(filter);
      });
    });

    // Close handlers
    const closeOverlay = () => {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => overlay.remove());
    };
    overlay.querySelector('.auth-close').addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Initial load
    loadTransactions('all');
  }


  // ══════════════════════════════════════════
  //  HERO BUTTONS → AUTH
  // ══════════════════════════════════════════
  document.querySelectorAll('.btn-watch, .btn-schedule').forEach(btn => {
    btn.removeAttribute('onclick');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      showPremiumOrPlay();
    });
  });


  // ══════════════════════════════════════════
  //  SEARCH ENGINE
  // ══════════════════════════════════════════
  const searchInput = document.querySelector('.search-bar input');
  let currentSearch = '';

  function performSearch(query) {
    query = query.trim().toLowerCase();
    currentSearch = query;

    // Remove old search results banner
    const oldBanner = document.getElementById('search-results-banner');
    if (oldBanner) oldBanner.remove();

    // If empty query, reset everything
    if (!query) {
      clearSearch();
      return;
    }

    const allSections = document.querySelectorAll('.section[data-sport]');
    const allCards = document.querySelectorAll('.video-card');
    let totalMatches = 0;
    let matchedSections = new Set();

    // Search each card
    allCards.forEach(card => {
      const title = (card.querySelector('.video-title')?.textContent || '').toLowerCase();
      const category = (card.querySelector('.video-category')?.textContent || '').toLowerCase();
      const channel = (card.querySelector('.channel-name')?.textContent || '').toLowerCase();
      const searchText = `${title} ${category} ${channel}`;

      if (searchText.includes(query)) {
        card.style.display = '';
        card.classList.add('search-match');
        card.classList.remove('search-hidden');
        totalMatches++;
        // Find parent section
        const section = card.closest('.section[data-sport]');
        if (section) matchedSections.add(section);
      } else {
        card.style.display = 'none';
        card.classList.add('search-hidden');
        card.classList.remove('search-match');
      }
    });

    // Show only sections that have matches
    allSections.forEach(section => {
      if (matchedSections.has(section)) {
        section.style.display = '';
      } else {
        section.style.display = 'none';
      }
    });

    // Also search the schedule table
    const scheduleSection = document.querySelector('.section[data-sport="all"]');
    const scheduleRows = document.querySelectorAll('.schedule-table tbody tr');
    let scheduleMatches = 0;
    scheduleRows.forEach(row => {
      const text = row.textContent.toLowerCase();
      if (text.includes(query)) {
        row.style.display = '';
        scheduleMatches++;
      } else {
        row.style.display = 'none';
      }
    });
    if (scheduleMatches > 0 && scheduleSection) {
      scheduleSection.style.display = '';
      totalMatches += scheduleMatches;
    }

    // Also search ticker cards
    document.querySelectorAll('.ticker-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      if (text.includes(query)) {
        card.style.opacity = '1';
        card.style.transform = 'scale(1)';
      } else {
        card.style.opacity = '0.3';
        card.style.transform = 'scale(0.95)';
      }
    });

    // Show search results banner
    showSearchBanner(query, totalMatches);
    showToast(`Found ${totalMatches} result${totalMatches !== 1 ? 's' : ''} for "${query}"`, totalMatches > 0 ? 'success' : 'error');
  }

  function showSearchBanner(query, count) {
    const banner = document.createElement('div');
    banner.id = 'search-results-banner';
    banner.innerHTML = `
      <div class="search-banner-inner">
        <span class="search-banner-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
        <span>Showing <strong>${count}</strong> result${count !== 1 ? 's' : ''} for "<strong>${query}</strong>"</span>
        <button class="search-banner-clear" onclick="document.getElementById('search-results-banner').remove()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Clear Search
        </button>
      </div>
    `;
    // Insert before the first section in main
    const main = document.querySelector('.main');
    const hero = document.querySelector('.hero');
    if (main && hero) {
      hero.insertAdjacentElement('afterend', banner);
    }

    // Wire up the clear button properly
    banner.querySelector('.search-banner-clear').addEventListener('click', (e) => {
      e.preventDefault();
      clearSearch();
    });
  }

  function clearSearch() {
    currentSearch = '';
    if (searchInput) searchInput.value = '';

    // Remove banner
    const banner = document.getElementById('search-results-banner');
    if (banner) banner.remove();

    // Show all cards
    document.querySelectorAll('.video-card').forEach(card => {
      card.style.display = '';
      card.classList.remove('search-match', 'search-hidden');
    });

    // Clear any active tags
    document.querySelectorAll('.sidebar-tag').forEach(t => {
      t.classList.remove('active');
      t.style.background = '';
      t.style.borderColor = '';
      t.style.color = '';
    });

    // Reset sections to match sidebar filter
    const activeFilter = document.querySelector('.sidebar-item.active');
    const filter = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
    filterBySport(filter);

    // Reset ticker
    document.querySelectorAll('.ticker-card').forEach(card => {
      card.style.opacity = '';
      card.style.transform = '';
    });

    // Reset schedule rows
    document.querySelectorAll('.schedule-table tbody tr').forEach(row => {
      row.style.display = '';
    });
  }

  // Make clearSearch available globally for the banner button
  window.clearSearch = clearSearch;

  if (searchInput) {
    console.log('Search input found, attaching event listeners');

    // Search on Enter
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        console.log('Search Enter pressed, query:', query);
        if (query) {
          performSearch(query);
        } else {
          clearSearch();
        }
      }
      if (e.key === 'Escape') {
        if (currentSearch) clearSearch();
        searchInput.blur();
      }
    });

    // Live search as you type (debounced)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = searchInput.value.trim();
      console.log('Search input event, query:', query);
      searchTimeout = setTimeout(() => {
        if (query.length >= 2) {
          performSearch(query);
        } else if (query.length === 0) {
          clearSearch();
        }
      }, 300);
    });

    // Click event for better mobile support
    searchInput.addEventListener('click', (e) => {
      console.log('Search input clicked');
      searchInput.focus();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        console.log('Search focused via / shortcut');
      }
    });
  } else {
    console.error('Search input not found! Selector: .search-bar input');
  }


  // ── Schedule Remind Me Buttons ──
  document.querySelectorAll('.schedule-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isLoggedIn()) { openAuthModal('signup'); return; }
      if (btn.textContent === 'Remind Me') {
        btn.textContent = '✓ Set';
        btn.classList.add('active');
        showToast('Reminder set!', 'success');
      } else {
        btn.textContent = 'Remind Me';
        btn.classList.remove('active');
        showToast('Reminder removed');
      }
    });
  });


  // ── Live Ticker ──
  const ticker = document.querySelector('.live-ticker');
  if (ticker) {
    ticker.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); ticker.scrollLeft += e.deltaY; }
    }, { passive: false });
  }
  document.querySelectorAll('.ticker-card').forEach(card => {
    card.addEventListener('click', () => showPremiumOrPlay(null));
  });


  // ══════════════════════════════════════════════════════════
  //  DYNAMIC LIVE ENGINE — keeps the site feeling alive
  // ══════════════════════════════════════════════════════════

  // ── Ticker Score Simulation ──
  const tickerData = [
    { sport: 'IPL', status: 'live', label: '● Live', home: 'Chennai', away: 'Mumbai', homeCode: 'CSK', awayCode: 'MI', homeScore: 182, awayScore: 156, maxScore: 220 },
    { sport: 'PKL', status: 'live', label: '● 2nd Half', home: 'Patna', away: 'Jaipur', homeCode: 'PAT', awayCode: 'JAI', homeScore: 28, awayScore: 24, maxScore: 50 },
    { sport: 'ISL', status: 'live', label: '● 72\'', home: 'Kerala', away: 'Goa', homeCode: 'KER', awayCode: 'GOA', homeScore: 2, awayScore: 1, maxScore: 5 },
    { sport: 'Hockey', status: 'finished', label: 'Final', home: 'India', away: 'Korea', homeCode: 'IND', awayCode: 'KOR', homeScore: 4, awayScore: 1, maxScore: 0 },
    { sport: 'NBA', status: 'live', label: '● Q4', home: 'Lakers', away: 'Warriors', homeCode: 'LAL', awayCode: 'GSW', homeScore: 112, awayScore: 108, maxScore: 140 },
    { sport: 'Badminton', status: 'upcoming', label: '16:00 IST', home: 'Sindhu', away: 'Tai Tzu', homeCode: 'SIN', awayCode: 'TAI', homeScore: 0, awayScore: 0, maxScore: 0 },
    { sport: 'Olympics', status: 'live', label: '● Live', home: "Men's Downhill", away: '', homeCode: '', awayCode: '', homeScore: 0, awayScore: 0, maxScore: 0, special: 'Run 2' }
  ];

  // Hero state
  let heroState = {
    homeScore: 3, awayScore: 3, period: 3, clock: '14:20',
    clockSeconds: 860, viewers: 12400
  };

  // Live badge count
  let liveCount = 0;

  function countLiveEvents() {
    let count = tickerData.filter(t => t.status === 'live').length;
    if (heroState.period <= 3) count++; // hero match is live
    // Add some simulated off-screen events
    count += 4 + Math.floor(Math.random() * 3);
    return count;
  }

  function updateLiveBadge() {
    const badge = document.querySelector('.live-badge');
    if (!badge) return;
    liveCount = countLiveEvents();
    badge.innerHTML = `<div class="live-dot"></div> ${liveCount} Live`;
  }

  function formatViewers(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return n.toString();
  }

  function updateHero() {
    // Advance clock
    heroState.clockSeconds -= Math.floor(Math.random() * 25) + 5;
    if (heroState.clockSeconds <= 0) {
      heroState.period++;
      if (heroState.period > 3 && heroState.homeScore === heroState.awayScore) {
        heroState.period = 4; // OT
        heroState.clockSeconds = 300;
      } else if (heroState.period > 4) {
        heroState.period = 4; // stay in OT
        heroState.clockSeconds = 0;
      } else {
        heroState.clockSeconds = 1200;
      }
    }

    // Occasional score (low probability per tick)
    if (heroState.period <= 4 && heroState.clockSeconds > 0 && Math.random() < 0.15) {
      if (Math.random() < 0.5) heroState.homeScore++; else heroState.awayScore++;
    }

    // Fluctuate viewers
    heroState.viewers += Math.floor((Math.random() - 0.45) * 300);
    heroState.viewers = Math.max(8000, Math.min(25000, heroState.viewers));

    // Format clock
    const mins = Math.floor(Math.abs(heroState.clockSeconds) / 60);
    const secs = Math.abs(heroState.clockSeconds) % 60;
    const clockStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    let periodLabel;
    if (heroState.period <= 3) periodLabel = ['1st', '2nd', '3rd'][heroState.period - 1] + ' Period';
    else periodLabel = 'Overtime';

    // Update DOM
    const metaItems = document.querySelectorAll('.hero-meta-item');
    if (metaItems[0]) metaItems[0].innerHTML = metaItems[0].querySelector('svg').outerHTML + ` ${periodLabel} • ${clockStr}`;
    if (metaItems[1]) metaItems[1].innerHTML = metaItems[1].querySelector('svg').outerHTML + ` ${formatViewers(heroState.viewers)} watching`;

    const scoreDisplay = document.querySelector('.score-display');
    if (scoreDisplay) {
      const newScore = `${heroState.homeScore} <span class="separator">–</span> ${heroState.awayScore}`;
      if (scoreDisplay.innerHTML !== newScore) {
        scoreDisplay.innerHTML = newScore;
        scoreDisplay.classList.add('score-flash');
        setTimeout(() => scoreDisplay.classList.remove('score-flash'), 800);
      }
    }
  }

  function updateTicker() {
    const cards = document.querySelectorAll('.ticker-card');
    tickerData.forEach((match, i) => {
      if (!cards[i]) return;

      // Only update live matches
      if (match.status === 'live' && !match.special) {
        // Small chance of score change — different increments per sport
        if (Math.random() < 0.12) {
          let inc = 1;
          if (match.sport === 'NBA') inc = Math.floor(Math.random()*3)+1;
          else if (match.sport === 'IPL') inc = Math.floor(Math.random()*6)+1;
          else if (match.sport === 'PKL') inc = Math.floor(Math.random()*2)+1;

          if (Math.random() < 0.5) match.homeScore = Math.min(match.maxScore, match.homeScore + inc);
          else match.awayScore = Math.min(match.maxScore, match.awayScore + inc);
        }

        const scoreEl = cards[i].querySelector('.ticker-score');
        if (scoreEl) {
          const newText = `${match.homeScore} – ${match.awayScore}`;
          if (scoreEl.textContent.trim() !== newText) {
            scoreEl.textContent = newText;
            scoreEl.classList.add('score-flash');
            setTimeout(() => scoreEl.classList.remove('score-flash'), 800);
          }
        }
      }

      // Occasionally end a live match
      if (match.status === 'live' && !match.special && Math.random() < 0.02) {
        match.status = 'finished';
        const statusEl = cards[i].querySelector('.ticker-status');
        if (statusEl) {
          statusEl.textContent = 'Final';
          statusEl.className = 'ticker-status finished';
        }
        cards[i].className = 'ticker-card finished';
      }
    });
  }

  // ── Last Updated Indicator ──
  function updateTimestamp() {
    let el = document.getElementById('last-updated');
    if (!el) {
      el = document.createElement('div');
      el.id = 'last-updated';
      el.style.cssText = 'position:fixed;bottom:16px;right:16px;background:rgba(22,25,28,0.9);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.5);padding:6px 12px;border-radius:8px;font-size:11px;z-index:90;backdrop-filter:blur(8px);display:flex;align-items:center;gap:6px;';
      document.body.appendChild(el);
    }
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.innerHTML = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#85c742;animation:pulse-live 2s infinite;"></span> Live · Updated ${time}`;
  }

  // ── Master tick — runs every 15 seconds ──
  function liveTick() {
    updateHero();
    updateTicker();
    updateLiveBadge();
    updateTimestamp();
  }

  // Initial run
  updateLiveBadge();
  updateTimestamp();

  // Start the engine
  setInterval(liveTick, 15000);


  // ── Init: check session and load videos on page load ──
  fetchSession().then(() => fetchVideos());

});
