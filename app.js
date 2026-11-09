const GITHUB_OWNER = 'senterprisehub';
const APP_TOPIC = 'android-app';

let appCatalog = [];

// Sanitize strings to prevent XSS or broken HTML attributes
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Fallback high-contrast vector icon generator
function createSvgPlaceholder(name) {
  const initial = (name || 'A').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <rect width="60" height="60" rx="14" fill="#1e293b"/>
    <text x="50%" y="54%" font-family="system-ui, sans-serif" font-weight="700" font-size="28" fill="#38bdf8" dominant-baseline="middle" text-anchor="middle">${escapeHtml(initial)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Normalize entries from apps-data.json or apps.json into a unified schema
function normalizeManifestApp(item) {
  return {
    id: (item.id || item.name || '').toLowerCase(),
    name: item.name || 'Unnamed App',
    description: item.fallbackDesc || item.description || 'Android application developed by SEnterpriseHub.',
    repoFullName: item.repo,
    pageUrl: item.pageUrl || `https://${GITHUB_OWNER}.github.io/${(item.repo || '').split('/')[1] || ''}/`,
    hasPages: Boolean(item.pageUrl),
    iconUrl: item.defaultIcon || `https://raw.githubusercontent.com/${item.repo}/main/icon.png`,
    release: item.release || { version: null, downloadUrl: null, sizeMb: null }
  };
}

// Live fallback: resolve latest release for a single repo if apps-data.json is missing
async function resolveReleaseData(repoFullName) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) return { version: null, downloadUrl: null, sizeMb: null };
    const data = await res.json();

    const apkAsset = (data.assets || []).find(asset =>
      asset.name && asset.name.toLowerCase().endsWith('.apk')
    );

    return {
      version: data.tag_name || 'v1.0.0',
      downloadUrl: apkAsset ? apkAsset.browser_download_url : null,
      sizeMb: apkAsset ? (apkAsset.size / (1024 * 1024)).toFixed(1) : null
    };
  } catch (err) {
    console.warn(`Could not fetch releases for ${repoFullName}:`, err);
    return { version: null, downloadUrl: null, sizeMb: null };
  }
}

// Tiered loader: 1. Pre-built apps-data.json -> 2. Static apps.json -> 3. Live GitHub Search
async function loadCatalog() {
  // Tier 1: Try pre-compiled apps-data.json (built by GitHub Action, zero rate-limit)
  try {
    const res = await fetch('./apps-data.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(normalizeManifestApp);
      }
    }
  } catch (e) {
    console.info('Pre-built apps-data.json not available yet, falling back to apps.json...');
  }

  // Tier 2: Try static apps.json and resolve releases client-side
  try {
    const res = await fetch('./apps.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return await Promise.all(
          data.map(async (item) => {
            const normalized = normalizeManifestApp(item);
            normalized.release = await resolveReleaseData(item.repo);
            return normalized;
          })
        );
      }
    }
  } catch (e) {
    console.warn('Fallback to apps.json failed:', e);
  }

  throw new Error('Unable to load application catalog manifest.');
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

    const hasApk = Boolean(app.release && app.release.downloadUrl);
    const downloadLabel = hasApk ? 'Download APK' : 'APK Pending';
    const fallback = createSvgPlaceholder(app.name);
    const safeName = escapeHtml(app.name);
    const safeDesc = escapeHtml(app.description);
    const safeVersion = escapeHtml(app.release?.version || 'Latest');
    const safeSize = app.release?.sizeMb ? `${escapeHtml(app.release.sizeMb)} MB` : 'Auto';

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
          <span class="version-pill">${safeVersion}</span>
        </div>
      </div>
      
      <p class="app-desc">${safeDesc}</p>
      
      <div class="meta-stats">
        <span>Type: <strong>Android APK</strong></span>
        <span>Size: <strong>${safeSize}</strong></span>
      </div>

      <div class="actions-group">
        <a 
          ${hasApk ? `href="${escapeHtml(app.release.downloadUrl)}" download` : 'role="button" aria-disabled="true" tabindex="-1"'}
          class="btn btn-download ${!hasApk ? 'disabled' : ''}">
          ${downloadLabel}
        </a>
        <a 
          ${app.hasPages ? `href="${escapeHtml(app.pageUrl)}" target="_blank" rel="noopener noreferrer"` : 'role="button" aria-disabled="true" tabindex="-1"'}
          class="btn btn-page ${!app.hasPages ? 'disabled' : ''}">
          ${app.hasPages ? 'App Page' : 'No Web Page'}
        </a>
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
    appCatalog = await loadCatalog();

    statusContainer.style.display = 'none';
    appGrid.style.display = 'grid';
    renderCards(appCatalog, false);

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = appCatalog.filter(item =>
          item.name.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.id.includes(term)
        );
        renderCards(filtered, term.length > 0);
      });
    }
  } catch (err) {
    statusContainer.innerHTML = `<p style="color: #ef4444;">Failed to load applications: ${escapeHtml(err.message)}</p>`;
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
