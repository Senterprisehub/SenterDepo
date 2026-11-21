let appCatalog = [];
let activeFilter = 'all';
let activeSort = 'default';
let searchTerm = '';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createSvgPlaceholder(name) {
  const initial = (name || 'S').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <rect width="60" height="60" rx="14" fill="#eff6ff"/>
    <text x="50%" y="54%" font-family="Inter, system-ui, sans-serif" font-weight="700" font-size="26" fill="#2563eb" dominant-baseline="middle" text-anchor="middle">${escapeHtml(initial)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ---------------- Interactive Tech Motion Canvas ---------------- */
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let nodes = [];
  const pointer = { x: null, y: null };

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(Math.floor((width * height) / 17000), 56);
    nodes = Array.from({ length: Math.max(count, 18) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      r: Math.random() * 2 + 1.5
    }));
  }

  function drawFrame() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (!prefersReduced) {
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > width) a.vx *= -1;
        if (a.y < 0 || a.y > height) a.vy *= -1;
      }

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 145) {
          const alpha = (1 - dist / 145) * 0.16;
          ctx.strokeStyle = `rgba(37, 99, 235, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      if (pointer.x !== null && pointer.y !== null) {
        const pd = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (pd < 160) {
          const alpha = (1 - pd / 160) * 0.28;
          ctx.strokeStyle = `rgba(2, 132, 199, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = 'rgba(37, 99, 235, 0.32)';
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!prefersReduced) {
      requestAnimationFrame(drawFrame);
    }
  }

  window.addEventListener('resize', resize);
  canvas.parentElement.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  });
  canvas.parentElement.addEventListener('mouseleave', () => {
    pointer.x = null;
    pointer.y = null;
  });

  resize();
  drawFrame();
}

/* ---------------- Scroll & Navbar Effects ---------------- */
function initScrollEffects() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }
}

/* ---------------- Animated Stat Counter ---------------- */
function animateCounter(el, target) {
  if (!el) return;
  const duration = 650;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateHeroStats(catalog) {
  const total = catalog.length;
  const androidCount = catalog.filter(a => a.appType === 'android' || a.appType === 'hybrid').length;
  const webCount = catalog.filter(a => a.appType === 'webapp' || a.appType === 'hybrid' || a.hasPages).length;

  animateCounter(document.getElementById('stat-total'), total);
  animateCounter(document.getElementById('stat-android'), androidCount);
  animateCounter(document.getElementById('stat-web'), webCount);
}

/* ---------------- Catalog Fetching ---------------- */
async function loadStaticOverrides() {
  try {
    const res = await fetch('./apps.json');
    if (res.ok) return await res.json();
  } catch (_) {}
  return [];
}

async function fetchCatalogData() {
  const staticList = await loadStaticOverrides();
  const overrideMap = new Map(
    staticList.map(item => [(item.repo || '').toLowerCase(), item])
  );

  try {
    const res = await fetch('/api/catalog');
    if (res.ok) {
      const liveCatalog = await res.json();
      if (Array.isArray(liveCatalog) && liveCatalog.length > 0) {
        return liveCatalog.map(app => {
          const override = overrideMap.get((app.repoFullName || '').toLowerCase()) || {};
          return {
            ...app,
            name: override.name || app.name,
            description: app.description || override.fallbackDesc || 'Utility application published on SenterDepo.',
            pageUrl: override.pageUrl || app.pageUrl,
            iconUrl: override.defaultIcon || app.iconUrl
          };
        });
      }
    }
  } catch (err) {
    console.warn('Edge catalog unreachable, using fallback:', err);
  }

  return staticList.map(item => ({
    id: (item.id || item.name || '').toLowerCase(),
    name: item.name,
    description: item.fallbackDesc || 'Utility application published on SenterDepo.',
    repoFullName: item.repo,
    repoUrl: `https://github.com/${item.repo}`,
    appType: item.appType || 'android',
    topics: item.topics || ['android-app'],
    pageUrl: item.pageUrl,
    hasPages: Boolean(item.pageUrl),
    iconUrl: item.defaultIcon,
    release: item.release || { version: null, downloadUrl: null, sizeMb: null }
  }));
}

/* ---------------- Modal Inspector ---------------- */
function openAppModal(app) {
  const modal = document.getElementById('app-modal');
  const body = document.getElementById('modal-body');
  if (!modal || !body) return;

  const isWebOnly = app.appType === 'webapp';
  const hasApk = Boolean(app.release && app.release.downloadUrl);
  const fallback = createSvgPlaceholder(app.name);
  const typeLabel = app.appType === 'hybrid'
    ? 'Android + Web'
    : (isWebOnly ? 'Web Utility' : 'Android APK');

  body.innerHTML = `
    <div class="modal-header">
      <img class="app-logo" src="${escapeHtml(app.iconUrl)}" alt="${escapeHtml(app.name)} icon" onerror="this.onerror=null; this.src='${fallback}';" />
      <div>
        <h3 id="modal-title" style="font-size: 1.25rem; font-weight: 800;">${escapeHtml(app.name)}</h3>
        <span class="version-pill">${escapeHtml(isWebOnly ? 'Web App' : (app.release?.version || 'Latest Release'))}</span>
      </div>
    </div>
    <p class="modal-desc">${escapeHtml(app.description)}</p>
    <div class="modal-meta-grid">
      <div class="modal-meta-box">
        <span>Platform</span>
        <strong>${typeLabel}</strong>
      </div>
      <div class="modal-meta-box">
        <span>Package Size</span>
        <strong>${isWebOnly ? 'Instant Browser' : (app.release?.sizeMb ? `${escapeHtml(app.release.sizeMb)} MB` : 'Direct Release')}</strong>
      </div>
      <div class="modal-meta-box">
        <span>Distribution</span>
        <strong>Official Build</strong>
      </div>
      <div class="modal-meta-box">
        <span>Access</span>
        <strong>Free · No Sign-In</strong>
      </div>
    </div>
    <div class="actions-group">
      ${!isWebOnly ? `
        <a ${hasApk ? `href="${escapeHtml(app.release.downloadUrl)}" download` : 'role="button" aria-disabled="true" tabindex="-1"'}
          class="btn btn-primary ${!hasApk ? 'disabled' : ''}">
          ${hasApk ? 'Download APK' : 'APK Pending'}
        </a>
      ` : ''}
      ${app.hasPages ? `
        <a href="${escapeHtml(app.pageUrl)}" target="_blank" rel="noopener noreferrer" class="btn ${isWebOnly ? 'btn-primary' : 'btn-subtle'}">
          Launch Web App
        </a>
      ` : ''}
      ${isWebOnly && app.repoUrl ? `
        <a href="${escapeHtml(app.repoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-subtle">
          View Source
        </a>
      ` : ''}
    </div>
  `;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeAppModal() {
  const modal = document.getElementById('app-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

/* ---------------- Filter, Sort & Render ---------------- */
function applyFiltersAndRender() {
  let list = [...appCatalog];

  if (activeFilter !== 'all') {
    list = list.filter(app => {
      if (activeFilter === 'android') return app.appType === 'android' || app.appType === 'hybrid';
      if (activeFilter === 'webapp') return app.appType === 'webapp' || app.appType === 'hybrid';
      if (activeFilter === 'hybrid') return app.appType === 'hybrid';
      return true;
    });
  }

  if (searchTerm) {
    list = list.filter(item =>
      item.name.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm) ||
      item.id.includes(searchTerm) ||
      (item.topics || []).some(t => t.includes(searchTerm))
    );
  }

  if (activeSort === 'az') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (activeSort === 'za') {
    list.sort((a, b) => b.name.localeCompare(a.name));
  }

  const meta = document.getElementById('results-meta');
  if (meta) {
    meta.style.display = 'block';
    meta.textContent = `Showing ${list.length} of ${appCatalog.length} applications`;
  }

  renderCards(list);
}

function renderCards(apps) {
  const grid = document.getElementById('app-grid');
  grid.innerHTML = '';

  if (apps.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem 1rem; background: var(--bg-surface); border: 1px dashed var(--border-strong); border-radius: 16px;">
        No applications match your current search or filter selection.
      </div>
    `;
    return;
  }

  apps.forEach((app, idx) => {
    const card = document.createElement('article');
    card.className = 'app-card';
    card.style.animationDelay = `${Math.min(idx * 35, 320)}ms`;

    const isWebOnly = app.appType === 'webapp';
    const isHybrid = app.appType === 'hybrid';
    const hasApk = Boolean(app.release && app.release.downloadUrl);

    const fallback = createSvgPlaceholder(app.name);
    const safeName = escapeHtml(app.name);
    const safeDesc = escapeHtml(app.description);

    const badgeLabel = isWebOnly
      ? 'Web App'
      : escapeHtml(app.release?.version || (isHybrid ? 'APK + Web' : 'Latest'));

    const typeLabel = isHybrid
      ? 'Android + Web'
      : (isWebOnly ? 'Web Utility' : 'Android APK');

    const sizeOrStatusLabel = isWebOnly
      ? 'Status: <strong>Online</strong>'
      : `Size: <strong>${app.release?.sizeMb ? `${escapeHtml(app.release.sizeMb)} MB` : 'Auto'}</strong>`;

    const downloadIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    const externalIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

    let actionsHtml = '';
    if (isWebOnly) {
      actionsHtml = `
        <a href="${escapeHtml(app.pageUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          <span>Launch App</span>${externalIcon}
        </a>
        <a href="${escapeHtml(app.repoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-subtle">
          <span>Source</span>
        </a>
      `;
    } else {
      const downloadLabel = hasApk ? 'Download APK' : 'APK Pending';
      const pageLabel = isHybrid ? 'Web App' : (app.hasPages ? 'App Page' : 'No Page');
      actionsHtml = `
        <a ${hasApk ? `href="${escapeHtml(app.release.downloadUrl)}" download` : 'role="button" aria-disabled="true" tabindex="-1"'}
          class="btn btn-primary ${!hasApk ? 'disabled' : ''}">
          ${hasApk ? downloadIcon : ''}<span>${downloadLabel}</span>
        </a>
        <a ${app.hasPages ? `href="${escapeHtml(app.pageUrl)}" target="_blank" rel="noopener noreferrer"` : 'role="button" aria-disabled="true" tabindex="-1"'}
          class="btn btn-subtle ${!app.hasPages ? 'disabled' : ''}">
          <span>${pageLabel}</span>${app.hasPages ? externalIcon : ''}
        </a>
      `;
    }

    card.innerHTML = `
      <div class="card-top">
        <div class="card-identity">
          <img
            class="app-logo"
            src="${escapeHtml(app.iconUrl)}"
            alt="${safeName} icon"
            loading="lazy"
            onerror="this.onerror=null; this.src='${fallback}';"
          />
          <div class="card-title-group">
            <h3 class="app-title" title="${safeName}">${safeName}</h3>
            <span class="version-pill">${badgeLabel}</span>
          </div>
        </div>
        <button type="button" class="info-btn" aria-label="View details for ${safeName}" title="App details">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      </div>
      <p class="app-desc">${safeDesc}</p>
      <div class="meta-stats">
        <span>Type: <strong>${typeLabel}</strong></span>
        <span>${sizeOrStatusLabel}</span>
      </div>
      <div class="actions-group">
        ${actionsHtml}
      </div>
    `;

    const infoBtn = card.querySelector('.info-btn');
    if (infoBtn) {
      infoBtn.addEventListener('click', () => openAppModal(app));
    }

    grid.appendChild(card);
  });
}

async function init() {
  initHeroCanvas();
  initScrollEffects();

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const statusContainer = document.getElementById('status-container');
  const appGrid = document.getElementById('app-grid');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const filterPills = document.querySelectorAll('.filter-pill');
  const modal = document.getElementById('app-modal');
  const modalClose = document.getElementById('modal-close');

  if (modalClose) modalClose.addEventListener('click', closeAppModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAppModal();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAppModal();
  });

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');
      activeFilter = pill.dataset.filter || 'all';
      applyFiltersAndRender();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      activeSort = e.target.value;
      applyFiltersAndRender();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase().trim();
      applyFiltersAndRender();
    });
  }

  try {
    appCatalog = await fetchCatalogData();
    statusContainer.style.display = 'none';
    appGrid.style.display = 'grid';
    updateHeroStats(appCatalog);
    applyFiltersAndRender();
  } catch (err) {
    statusContainer.innerHTML = `<p style="color: #dc2626;">Unable to load catalog: ${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
