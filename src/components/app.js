/* ═══════════════════════════════════════════
   APP.JS — Arena Sports Interactivity
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
      } else {
        currentUser = null;
      }
    } catch {
      currentUser = null;
    }
    updateHeaderForAuth();
    return currentUser;
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
        <div class="dropdown-divider"></div>
        ${session.payment_status !== 'paid' ? `
        <a class="dropdown-item dropdown-upgrade" data-action="upgrade">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Upgrade to Premium — ₹99
        </a>
        <div class="dropdown-divider"></div>
        ` : ''}
        <a class="dropdown-item" data-action="profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          My Profile
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
          // Refresh session to get latest payment_status
          await fetchSession();
          if (!isPaid()) {
            showToast(`Welcome back, ${getSession().username}! Complete payment for premium.`, 'success');
            setTimeout(() => openPaymentModal(), 400);
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
          showToast(`Account created! Complete payment to unlock premium.`, 'success');
          // Open payment modal after successful signup
          setTimeout(() => openPaymentModal(), 400);
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
          <h2 class="payment-title">Unlock Arena Sports Premium</h2>
          <p class="payment-subtitle">Get unlimited access to all live streams, highlights, and exclusive content</p>
        </div>

        <div class="payment-plan">
          <div class="plan-badge">BEST VALUE</div>
          <div class="plan-price">
            <span class="plan-currency">₹</span>
            <span class="plan-amount">99</span>
            <span class="plan-period">/ one-time</span>
          </div>
          <ul class="plan-features">
            <li>✓ All live cricket, kabaddi, football & more</li>
            <li>✓ HD quality streaming</li>
            <li>✓ No ads on premium content</li>
            <li>✓ Access on all devices</li>
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
          name: 'Arena Sports',
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
                // Update local user state
                currentUser.payment_status = 'paid';
                updateHeaderForAuth();

                // Close payment modal with success
                overlay.classList.remove('show');
                overlay.addEventListener('transitionend', () => overlay.remove());

                showToast('🎉 Payment successful! Welcome to Arena Sports Premium!', 'success');
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
  //  PREMIUM MODAL (for non-logged-in users)
  // ══════════════════════════════════════════
  function showPremiumOrPlay() {
    if (!isLoggedIn()) {
      openAuthModal('signup');
    } else if (!isPaid()) {
      openPaymentModal();
    } else {
      showToast('Loading stream...', 'success');
      // Could open the video here in future
    }
  }


  // ══════════════════════════════════════════
  //  VIDEO CARD CLICK → AUTH/PREMIUM
  // ══════════════════════════════════════════
  document.querySelectorAll('.video-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      showPremiumOrPlay();
    });
  });


  // ══════════════════════════════════════════
  //  SIDEBAR SPORT FILTERING
  // ══════════════════════════════════════════
  const sidebarItems = document.querySelectorAll('.sidebar-item[data-filter]');
  const sportSections = document.querySelectorAll('.section[data-sport]');

  function filterBySport(sport) {
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

  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const filter = item.getAttribute('data-filter');
      filterBySport(filter);
      const label = item.textContent.trim().split('\n')[0].trim();
      showToast(filter === 'all' ? 'Showing all sports' : `Showing ${label}`);
    });
  });


  // ── Sidebar Tags ──
  document.querySelectorAll('.sidebar-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const wasActive = tag.classList.contains('active');
      document.querySelectorAll('.sidebar-tag').forEach(t => {
        t.classList.remove('active');
        t.style.background = '';
        t.style.borderColor = '';
        t.style.color = '';
      });
      if (!wasActive) {
        tag.classList.add('active');
        tag.style.background = 'rgba(133,199,66,0.15)';
        tag.style.borderColor = 'rgba(133,199,66,0.3)';
        tag.style.color = '#85c742';
        showToast(`Tag: ${tag.textContent.trim()}`);
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
        filterBySport('all');
        sidebarItems.forEach(i => i.classList.remove('active'));
        const allItem = document.querySelector('.sidebar-item[data-filter="all"]');
        if (allItem) allItem.classList.add('active');
      }
      if (text === 'Browse') {
        const firstSection = document.querySelector('.section[data-sport]');
        if (firstSection) firstSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    // Search on Enter
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
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
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      const query = searchInput.value.trim();
      searchTimeout = setTimeout(() => {
        if (query.length >= 2) {
          performSearch(query);
        } else if (query.length === 0) {
          clearSearch();
        }
      }, 300);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) { e.preventDefault(); searchInput.focus(); }
    });
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
    card.addEventListener('click', () => showPremiumOrPlay());
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


  // ── Init: check session on load ──
  fetchSession();

});
