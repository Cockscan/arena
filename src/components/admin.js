(function() {
  'use strict';

  let adminToken = localStorage.getItem('pixelplex_admin_token');
  let currentPage = 'dashboard';
  let categoriesCache = [];

  // ── API Helper ──
  async function api(endpoint, options = {}) {
    const headers = { ...options.headers };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`/api/admin${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok && res.status === 401) {
      // Token expired
      localStorage.removeItem('pixelplex_admin_token');
      adminToken = null;
      showLogin();
    }
    return data;
  }

  // ══════════════════════════════════════════
  //  AUTH
  // ══════════════════════════════════════════

  function showLogin() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('admin-app').style.display = 'none';
  }

  function showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    navigateTo('dashboard');
  }

  // Login handler
  document.getElementById('admin-login-btn').addEventListener('click', async () => {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorEl = document.getElementById('login-error');

    if (!username || !password) {
      errorEl.textContent = 'Please enter username and password';
      errorEl.style.display = 'block';
      return;
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.ok) {
        adminToken = data.token;
        localStorage.setItem('pixelplex_admin_token', data.token);
        errorEl.style.display = 'none';
        showApp();
      } else {
        errorEl.textContent = data.error || 'Login failed';
        errorEl.style.display = 'block';
      }
    } catch (err) {
      errorEl.textContent = 'Connection error';
      errorEl.style.display = 'block';
    }
  });

  // Enter key on password
  document.getElementById('admin-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('admin-login-btn').click();
  });

  // Logout
  document.getElementById('admin-logout').addEventListener('click', () => {
    localStorage.removeItem('pixelplex_admin_token');
    adminToken = null;
    showLogin();
  });

  // ══════════════════════════════════════════
  //  NAVIGATION
  // ══════════════════════════════════════════

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    const content = document.getElementById('page-content');
    switch (page) {
      case 'dashboard': renderDashboard(content); break;
      case 'categories': renderCategories(content); break;
      case 'videos': renderVideos(content); break;
      case 'users': renderUsers(content); break;
      case 'transactions': renderTransactions(content); break;
    }
  }

  // ══════════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════════

  async function renderDashboard(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Dashboard</h1></div>
      <div class="stats-grid" id="stats-grid">
        <div class="stat-card"><div class="stat-icon">⏳</div><div class="stat-value">...</div><div class="stat-label">Loading</div></div>
      </div>
    `;

    const data = await api('/stats');
    if (!data.ok) return;

    const s = data.stats;
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">🎬</div>
        <div class="stat-value">${s.total_videos}</div>
        <div class="stat-label">Total Videos</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-value">${s.total_categories}</div>
        <div class="stat-label">Categories</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👤</div>
        <div class="stat-value">${s.total_users}</div>
        <div class="stat-label">Registered Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💾</div>
        <div class="stat-value">${s.total_storage_mb} MB</div>
        <div class="stat-label">R2 Storage Used</div>
      </div>
    `;
  }

  // ══════════════════════════════════════════
  //  CATEGORIES
  // ══════════════════════════════════════════

  async function renderCategories(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Categories</h1>
        <button class="btn btn-primary" id="add-category-btn">+ Add Category</button>
      </div>
      <div class="data-table">
        <div class="table-body" id="categories-list">
          <div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">Loading...</div></div>
        </div>
      </div>
    `;

    document.getElementById('add-category-btn').addEventListener('click', () => openCategoryModal());
    await loadCategories();
  }

  async function loadCategories() {
    const data = await api('/categories');
    if (!data.ok) return;

    categoriesCache = data.categories;
    const list = document.getElementById('categories-list');

    if (data.categories.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📁</div><div class="empty-text">No categories yet</div><div class="empty-hint">Click "Add Category" to create one</div></div>`;
      return;
    }

    list.innerHTML = data.categories.map(cat => `
      <div class="table-row">
        <div class="row-icon">${cat.icon || '📁'}</div>
        <div class="row-info">
          <div class="row-title">${escHtml(cat.name)}</div>
          <div class="row-subtitle">${cat.video_count} video${cat.video_count !== 1 ? 's' : ''} • /${cat.slug}</div>
        </div>
        <span class="row-badge ${cat.is_active ? 'badge-active' : 'badge-inactive'}">${cat.is_active ? 'Active' : 'Inactive'}</span>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm" onclick="window._editCategory(${cat.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="window._deleteCategory(${cat.id}, '${escHtml(cat.name)}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  function openCategoryModal(editCat = null) {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-modal">
        <div class="modal-header">
          <h3>${editCat ? 'Edit Category' : 'New Category'}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Category Name</label>
            <input type="text" id="cat-name" value="${editCat ? escHtml(editCat.name) : ''}" placeholder="e.g. Basketball">
          </div>
          <div class="form-group">
            <label>Icon (emoji)</label>
            <input type="text" id="cat-icon" value="${editCat ? editCat.icon || '' : ''}" placeholder="e.g. 🏀" maxlength="4">
          </div>
          <div class="form-group">
            <label>Description (optional)</label>
            <textarea id="cat-desc" rows="3" placeholder="Short description">${editCat ? escHtml(editCat.description || '') : ''}</textarea>
          </div>
          ${editCat ? `
          <div class="form-group">
            <label>Status</label>
            <select id="cat-active">
              <option value="true" ${editCat.is_active ? 'selected' : ''}>Active</option>
              <option value="false" ${!editCat.is_active ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="cat-save">${editCat ? 'Save Changes' : 'Create Category'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#cat-save').addEventListener('click', async () => {
      const name = document.getElementById('cat-name').value.trim();
      const icon = document.getElementById('cat-icon').value.trim();
      const description = document.getElementById('cat-desc').value.trim();

      if (!name) { alert('Category name is required'); return; }

      const body = { name, icon: icon || '📁', description: description || null };
      if (editCat) {
        const isActive = document.getElementById('cat-active').value === 'true';
        body.is_active = isActive;
      }

      const data = editCat
        ? await api(`/categories/${editCat.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api('/categories', { method: 'POST', body: JSON.stringify(body) });

      if (data.ok) {
        overlay.remove();
        await loadCategories();
      } else {
        alert(data.error || 'Error saving category');
      }
    });
  }

  window._editCategory = async function(id) {
    const cat = categoriesCache.find(c => c.id === id);
    if (cat) openCategoryModal(cat);
  };

  window._deleteCategory = async function(id, name) {
    if (!confirm(`Delete category "${name}"? Videos in this category will be unlinked.`)) return;
    const data = await api(`/categories/${id}`, { method: 'DELETE' });
    if (data.ok) await loadCategories();
    else alert(data.error || 'Error deleting category');
  };

  // ══════════════════════════════════════════
  //  VIDEOS
  // ══════════════════════════════════════════

  async function renderVideos(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Videos</h1>
        <button class="btn btn-primary" id="upload-video-btn">+ Upload Video</button>
      </div>
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <select id="video-filter-cat" class="form-group" style="padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #fff; font-size: 14px;">
          <option value="">All Categories</option>
        </select>
        <input type="text" id="video-search" placeholder="Search videos..." style="flex: 1; padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #fff; font-size: 14px;">
      </div>
      <div class="video-grid" id="videos-grid">
        <div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">Loading...</div></div>
      </div>
    `;

    document.getElementById('upload-video-btn').addEventListener('click', () => openUploadModal());

    // Load categories for filter
    if (categoriesCache.length === 0) {
      const catData = await api('/categories');
      if (catData.ok) categoriesCache = catData.categories;
    }

    const filterSelect = document.getElementById('video-filter-cat');
    categoriesCache.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.name}`;
      filterSelect.appendChild(opt);
    });

    filterSelect.addEventListener('change', () => loadVideos());
    document.getElementById('video-search').addEventListener('input', debounce(() => loadVideos(), 300));

    await loadVideos();
  }

  async function loadVideos() {
    const catFilter = document.getElementById('video-filter-cat')?.value || '';
    const search = document.getElementById('video-search')?.value || '';

    let url = '/videos?';
    if (catFilter) url += `category_id=${catFilter}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    const data = await api(url);
    if (!data.ok) return;

    const grid = document.getElementById('videos-grid');

    if (data.videos.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><div class="empty-icon">🎬</div><div class="empty-text">No videos found</div><div class="empty-hint">Upload your first video!</div></div>`;
      return;
    }

    grid.innerHTML = data.videos.map(v => {
      const thumb = v.thumbnail_url || '';
      const isR2 = v.source_type === 'r2';
      return `
        <div class="video-card-admin">
          <img class="card-thumb" src="${escHtml(thumb)}" alt="${escHtml(v.title)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect fill=%22%231a1a1a%22 width=%22320%22 height=%22180%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23555%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2216%22>No Thumbnail</text></svg>'">
          <div class="card-body">
            <div class="card-title">${escHtml(v.title)}</div>
            <div class="card-meta">
              <span class="row-badge ${isR2 ? 'badge-r2' : 'badge-youtube'}">${isR2 ? 'R2' : 'YouTube'}</span>
              <span>${v.duration || ''}</span>
            </div>
            <div class="card-actions">
              <button class="btn btn-secondary btn-sm" onclick="window._editVideo(${v.id})" style="flex:1">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="window._deleteVideo(${v.id}, '${escHtml(v.title).replace(/'/g, "\\'")}')" style="flex:1">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Upload Modal ──
  function openUploadModal() {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-modal" style="max-width: 550px;">
        <div class="modal-header">
          <h3>Upload Video</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="upload-zone" id="upload-zone">
            <div class="upload-icon">📁</div>
            <div class="upload-text">Click or drag video file here</div>
            <div class="upload-hint">MP4, WebM, MOV • Max 500MB</div>
            <input type="file" id="video-file-input" accept="video/*" style="display: none;">
          </div>
          <div id="upload-file-info" style="display: none; margin-bottom: 16px; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 13px; color: rgba(255,255,255,0.7);"></div>

          <div class="form-group">
            <label>Video Title *</label>
            <input type="text" id="upload-title" placeholder="Enter video title">
          </div>
          <div class="form-group">
            <label>Category *</label>
            <select id="upload-category">
              <option value="">Select a category</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tag (optional)</label>
            <input type="text" id="upload-tag" placeholder="e.g. TRENDING, MUST WATCH">
          </div>

          <div id="upload-progress-section" style="display: none;">
            <div class="progress-bar"><div class="progress-fill" id="upload-progress-bar" style="width: 0%"></div></div>
            <div class="upload-status" id="upload-status">Uploading...</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="upload-submit">Upload Video</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Populate categories
    const catSelect = overlay.querySelector('#upload-category');
    categoriesCache.forEach(cat => {
      if (cat.is_active) {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = `${cat.icon} ${cat.name}`;
        catSelect.appendChild(opt);
      }
    });

    let selectedFile = null;
    const fileInput = overlay.querySelector('#video-file-input');
    const uploadZone = overlay.querySelector('#upload-zone');
    const fileInfo = overlay.querySelector('#upload-file-info');

    // Click to select file
    uploadZone.addEventListener('click', () => fileInput.click());

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
    });

    function handleFileSelect(file) {
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file');
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        alert('File is too large. Maximum size is 500MB.');
        return;
      }
      selectedFile = file;
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      fileInfo.textContent = `Selected: ${file.name} (${sizeMB} MB)`;
      fileInfo.style.display = 'block';
      uploadZone.querySelector('.upload-text').textContent = file.name;
      uploadZone.querySelector('.upload-icon').textContent = '✅';
    }

    // Close
    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Submit upload
    overlay.querySelector('#upload-submit').addEventListener('click', async () => {
      const title = overlay.querySelector('#upload-title').value.trim();
      const categoryId = overlay.querySelector('#upload-category').value;
      const tag = overlay.querySelector('#upload-tag').value.trim();

      if (!selectedFile) { alert('Please select a video file'); return; }
      if (!title) { alert('Please enter a video title'); return; }
      if (!categoryId) { alert('Please select a category'); return; }

      const submitBtn = overlay.querySelector('#upload-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading...';

      const progressSection = overlay.querySelector('#upload-progress-section');
      progressSection.style.display = 'block';

      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('title', title);
      formData.append('category_id', categoryId);
      if (tag) formData.append('tag', tag);

      try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            overlay.querySelector('#upload-progress-bar').style.width = pct + '%';
            overlay.querySelector('#upload-status').textContent = pct < 100 ? `Uploading... ${pct}%` : 'Processing video...';
          }
        });

        xhr.addEventListener('load', () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.ok) {
              overlay.remove();
              loadVideos();
            } else {
              alert(data.error || 'Upload failed');
              submitBtn.disabled = false;
              submitBtn.textContent = 'Upload Video';
              progressSection.style.display = 'none';
            }
          } catch {
            alert('Upload failed — invalid response');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Video';
          }
        });

        xhr.addEventListener('error', () => {
          alert('Upload failed — network error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Upload Video';
          progressSection.style.display = 'none';
        });

        xhr.open('POST', '/api/admin/videos/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${adminToken}`);
        xhr.send(formData);
      } catch (err) {
        alert('Upload error: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Upload Video';
      }
    });
  }

  // ── Edit Video ──
  window._editVideo = async function(id) {
    const data = await api(`/videos?`);
    if (!data.ok) return;
    const video = data.videos.find(v => v.id === id);
    if (!video) { alert('Video not found'); return; }

    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML = `
      <div class="admin-modal">
        <div class="modal-header">
          <h3>Edit Video</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="edit-title" value="${escHtml(video.title)}">
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="edit-category">
              <option value="">No Category</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tag</label>
            <input type="text" id="edit-tag" value="${escHtml(video.tag || '')}" placeholder="e.g. TRENDING">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="edit-save">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Populate categories
    const catSelect = overlay.querySelector('#edit-category');
    categoriesCache.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.name}`;
      if (video.category_id === cat.id) opt.selected = true;
      catSelect.appendChild(opt);
    });

    overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#edit-save').addEventListener('click', async () => {
      const title = overlay.querySelector('#edit-title').value.trim();
      const category_id = overlay.querySelector('#edit-category').value;
      const tag = overlay.querySelector('#edit-tag').value.trim();

      if (!title) { alert('Title is required'); return; }

      const result = await api(`/videos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, category_id: category_id || null, tag: tag || null }),
      });

      if (result.ok) {
        overlay.remove();
        await loadVideos();
      } else {
        alert(result.error || 'Error updating video');
      }
    });
  };

  // ── Delete Video ──
  window._deleteVideo = async function(id, title) {
    if (!confirm(`Delete "${title}"? This will also remove the video file from storage.`)) return;
    const data = await api(`/videos/${id}`, { method: 'DELETE' });
    if (data.ok) await loadVideos();
    else alert(data.error || 'Error deleting video');
  };

  // ══════════════════════════════════════════
  //  USERS
  // ══════════════════════════════════════════

  async function renderUsers(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Registered Users</h1></div>
      <div class="data-table">
        <div class="table-header-row">
          <span class="th" style="flex:2">User</span>
          <span class="th" style="flex:2">Email</span>
          <span class="th" style="flex:1">Wallet</span>
          <span class="th" style="flex:1">Purchases</span>
          <span class="th" style="flex:1">Status</span>
          <span class="th" style="flex:1.5">Joined</span>
        </div>
        <div class="table-body" id="users-list">
          <div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">Loading...</div></div>
        </div>
      </div>
    `;

    const data = await api('/users');
    if (!data.ok) return;

    const list = document.getElementById('users-list');

    if (data.users.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-text">No registered users yet</div></div>`;
      return;
    }

    list.innerHTML = data.users.map(u => {
      const joined = new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const walletBal = (parseInt(u.wallet_balance) / 100).toFixed(2);
      return `
        <div class="table-row">
          <span class="td" style="flex:2"><strong>${escHtml(u.username)}</strong></span>
          <span class="td" style="flex:2">${escHtml(u.email)}</span>
          <span class="td" style="flex:1">₹${walletBal}</span>
          <span class="td" style="flex:1">${u.total_purchases}</span>
          <span class="td" style="flex:1"><span class="row-badge ${u.payment_status === 'paid' ? 'badge-active' : 'badge-inactive'}">${u.payment_status || 'pending'}</span></span>
          <span class="td" style="flex:1.5">${joined}</span>
        </div>
      `;
    }).join('');
  }

  // ══════════════════════════════════════════
  //  TRANSACTIONS
  // ══════════════════════════════════════════

  async function renderTransactions(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Transactions</h1></div>
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <button class="btn btn-primary btn-sm tab-btn active" data-tab="purchases">Video Purchases</button>
        <button class="btn btn-secondary btn-sm tab-btn" data-tab="wallet">Wallet Transactions</button>
      </div>
      <div id="transactions-content">
        <div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">Loading...</div></div>
      </div>
    `;

    const tabs = container.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => { b.classList.remove('active'); b.className = b.className.replace('btn-primary', 'btn-secondary'); });
        btn.classList.add('active');
        btn.className = btn.className.replace('btn-secondary', 'btn-primary');
        loadTransactions(btn.dataset.tab);
      });
    });

    await loadTransactions('purchases');
  }

  async function loadTransactions(type) {
    const data = await api(`/transactions?type=${type}`);
    if (!data.ok) return;

    const content = document.getElementById('transactions-content');

    if (type === 'purchases') {
      const purchases = data.purchases;
      if (purchases.length === 0) {
        content.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-text">No purchases yet</div></div>`;
        return;
      }

      content.innerHTML = `
        <div class="data-table">
          <div class="table-header-row">
            <span class="th" style="flex:1.5">User</span>
            <span class="th" style="flex:2">Video</span>
            <span class="th" style="flex:1">Amount</span>
            <span class="th" style="flex:1">Method</span>
            <span class="th" style="flex:1">Payment ID</span>
            <span class="th" style="flex:1.5">Date</span>
          </div>
          <div class="table-body">
            ${purchases.map(p => {
              const date = new Date(p.purchased_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              const amount = (p.payment_amount / 100).toFixed(2);
              return `
                <div class="table-row">
                  <span class="td" style="flex:1.5"><strong>${escHtml(p.username)}</strong></span>
                  <span class="td" style="flex:2">${escHtml(p.video_title)}</span>
                  <span class="td" style="flex:1">₹${amount}</span>
                  <span class="td" style="flex:1"><span class="row-badge ${p.payment_method === 'wallet' ? 'badge-r2' : 'badge-active'}">${p.payment_method || 'razorpay'}</span></span>
                  <span class="td" style="flex:1" title="${escHtml(p.payment_id)}">${escHtml((p.payment_id || '').substring(0, 12))}...</span>
                  <span class="td" style="flex:1.5">${date}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      const txns = data.wallet_transactions;
      if (txns.length === 0) {
        content.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">No wallet transactions yet</div></div>`;
        return;
      }

      content.innerHTML = `
        <div class="data-table">
          <div class="table-header-row">
            <span class="th" style="flex:1.5">User</span>
            <span class="th" style="flex:1">Type</span>
            <span class="th" style="flex:1">Amount</span>
            <span class="th" style="flex:1">Balance</span>
            <span class="th" style="flex:1">Status</span>
            <span class="th" style="flex:2">Description</span>
            <span class="th" style="flex:1.5">Date</span>
          </div>
          <div class="table-body">
            ${txns.map(t => {
              const date = new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              const amount = (t.amount / 100).toFixed(2);
              const balAfter = (t.balance_after / 100).toFixed(2);
              const typeClass = t.type === 'DEPOSIT' ? 'badge-active' : t.type === 'PURCHASE' ? 'badge-youtube' : 'badge-r2';
              return `
                <div class="table-row">
                  <span class="td" style="flex:1.5"><strong>${escHtml(t.username)}</strong></span>
                  <span class="td" style="flex:1"><span class="row-badge ${typeClass}">${t.type}</span></span>
                  <span class="td" style="flex:1">${t.type === 'DEPOSIT' ? '+' : '-'}₹${amount}</span>
                  <span class="td" style="flex:1">₹${balAfter}</span>
                  <span class="td" style="flex:1"><span class="row-badge ${t.status === 'completed' ? 'badge-active' : 'badge-inactive'}">${t.status}</span></span>
                  <span class="td" style="flex:2">${escHtml(t.description || '-')}</span>
                  <span class="td" style="flex:1.5">${date}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  }

  // ══════════════════════════════════════════
  //  UTILS
  // ══════════════════════════════════════════

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ── Init ──
  if (adminToken) {
    showApp();
  } else {
    showLogin();
  }

})();
