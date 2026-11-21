const GITHUB_OWNER = 'senterprisehub';
const TARGET_TOPICS = ['android-app', 'webapp'];

let appCatalog = [];

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createSvgPlaceholder(name) {
  const initial = (name || 'A').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <rect width="60" height="60" rx="14" fill="#eff6ff"/>
    <text x="50%" y="54%" font-family="system-ui, sans-serif" font-weight="700" font-size="28" fill="#2563eb" dominant-baseline="middle" text-anchor="middle">${escapeHtml(initial)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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

  // 1. Primary: Fetch from Vercel Edge-Cached Serverless Function (/api/catalog)
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
            description: app.description || override.fallbackDesc || 'Application developed by SEnterpriseHub.',
            pageUrl: override.pageUrl || app.pageUrl,
            iconUrl: override.defaultIcon || app.iconUrl
          };
        });
      }
    }
  } catch (err) {
    console.warn('Edge catalog unreachable, using fallback:', err);
  }

  // 2. Fallback: Use static apps.json (if GitHub account is temporarily offline)
  return staticList.map(item => ({
    id: (item.id || item.name || '').toLowerCase(),
    name: item.name,
    description: item.fallbackDesc || 'Application developed by SEnterpriseHub.',
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

function renderCards(apps, isSearchActive = false) {
  const grid = document.getElementById('app-grid');
  grid.innerHTML = '';

  if (apps.length === 0) {
    const emptyMsg = isSearchActive
      ? 'No applications match your search criteria.'
      : 'No applications found in the catalog.';
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 2rem;">${emptyMsg}</div>`;
    return;
  }

  apps.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card';

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
      : (isWebOnly ? 'Web Application' : 'Android APK');

    const sizeOrStatusLabel = isWebOnly
      ? 'Status: <strong>Online</strong>'
      : `Size: <strong>${app.release?.sizeMb ? `${escapeHtml(app.release.sizeMb)} MB` : 'Auto'}</strong>`;

    let actionsHtml = '';
    if (isWebOnly) {
      actionsHtml = `
        <a href="${escapeHtml(app.pageUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-download">
          Launch Web App
        </a>
        <a href="${escapeHtml(app.repoUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-page">
          Source Repo
        </a>
      `;
    } else {
      const downloadLabel = hasApk ? 'Download APK' : 'APK Pending';
      const pageLabel = isHybrid ? 'Launch Web App' : (app.hasPages ? 'App Page' : 'No Web Page');
      actionsHtml = `
        <a ${hasApk ? `href="${escapeHtml(app.release.downloadUrl)}" download` : 'role="button" aria-disabled="true" tabindex="-1"'}
          class="btn btn-download ${!hasApk ? 'disabled' : ''}">
          ${downloadLabel}
        </a>
        <a ${app.hasPages ? `href="${escapeHtml(app.pageUrl)}" target="_blank" rel="noopener noreferrer"` : 'role="button" aria-disabled="true" tabindex="-1"'}
          class="btn btn-page ${!app.hasPages ? 'disabled' : ''}">
          ${pageLabel}
        </a>
      `;
    }

    card.innerHTML = `
      <div class="card-header">
        <img 
          class="app-logo" 
          src="${escapeHtml(app.iconUrl)}" 
          alt="${safeName} icon" 
          loading="lazy"
          onerror="this.onerror=null; this.src='${fallback}';" 
        />
        <div class="card-title-group">
          <div class="app-title" title="${safeName}">${safeName}</div>
          <span class="version-pill">${badgeLabel}</span>
        </div>
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

    grid.appendChild(card);
  });
}

async function init() {
  const statusContainer = document.getElementById('status-container');
  const appGrid = document.getElementById('app-grid');
  const searchInput = document.getElementById('search-input');

  try {
    appCatalog = await fetchCatalogData();

    statusContainer.style.display = 'none';
    appGrid.style.display = 'grid';
    renderCards(appCatalog, false);

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = appCatalog.filter(item =>
          item.name.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.id.includes(term) ||
          (item.topics || []).some(t => t.includes(term))
        );
        renderCards(filtered, term.length > 0);
      });
    }
  } catch (err) {
    statusContainer.innerHTML = `<p style="color: #ef4444;">Failed to load applications: ${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', init);
