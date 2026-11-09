const GITHUB_OWNER = 'senterprisehub';
const TARGET_TOPICS = ['android-app', 'webapp'];

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

// Fallback light-theme vector icon generator
function createSvgPlaceholder(name) {
  const initial = (name || 'A').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <rect width="60" height="60" rx="14" fill="#eff6ff"/>
    <text x="50%" y="54%" font-family="system-ui, sans-serif" font-weight="700" font-size="28" fill="#2563eb" dominant-baseline="middle" text-anchor="middle">${escapeHtml(initial)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}


// Format repo names into readable titles (e.g., "Mock-GPS-Pro" -> "Mock GPS Pro")
function formatTitle(repoName) {
  return repoName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

// 1. Discover all repos under senterprisehub that have 'android-app' OR 'webapp' in their topics
async function fetchTaggedRepositories() {
  // Using /users/:owner/repos returns up to 100 public repos including their topics array in 1 single API call
  const url = `https://api.github.com/users/${GITHUB_OWNER}/repos?per_page=100&sort=updated`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github+json' }
  });

  if (!res.ok) throw new Error(`GitHub API returned status ${res.status}`);
  const repos = await res.json();

  return (repos || []).filter(repo => {
    const topics = (repo.topics || []).map(t => t.toLowerCase());
    return TARGET_TOPICS.some(target => topics.includes(target));
  });
}

// 2. Fetch the latest release and APK asset for Android-tagged repos
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

// 3. Load optional static overrides from apps.json/apps-data.json
async function loadCachedManifest() {
  for (const file of ['./apps-data.json', './apps.json']) {
    try {
      const res = await fetch(file, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (_) {}
  }
  return [];
}

function renderCards(apps, isSearchActive = false) {
  const grid = document.getElementById('app-grid');
  grid.innerHTML = '';

  if (apps.length === 0) {
    const emptyMsg = isSearchActive
      ? 'No applications match your search criteria.'
      : `No repositories tagged with "android-app" or "webapp" found.`;
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

    // Badge & Meta display based on topic ('android-app' vs 'webapp')
    const badgeLabel = isWebOnly
      ? 'Web App'
      : escapeHtml(app.release?.version || (isHybrid ? 'APK + Web' : 'Latest'));

    const typeLabel = isHybrid
      ? 'Android + Web'
      : (isWebOnly ? 'Web Application' : 'Android APK');

    const sizeOrStatusLabel = isWebOnly
      ? 'Status: <strong>Online</strong>'
      : `Size: <strong>${app.release?.sizeMb ? `${escapeHtml(app.release.sizeMb)} MB` : 'Auto'}</strong>`;

    // Action buttons tailored to 'android-app' vs 'webapp'
    let actionsHtml = '';
    if (isWebOnly) {
      actionsHtml = `
        <a 
          href="${escapeHtml(app.pageUrl)}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="btn btn-download">
          Launch Web App
        </a>
        <a 
          href="${escapeHtml(app.repoUrl)}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="btn btn-page">
          Source Repo
        </a>
      `;
    } else {
      const downloadLabel = hasApk ? 'Download APK' : 'APK Pending';
      const pageLabel = isHybrid ? 'Launch Web App' : (app.hasPages ? 'App Page' : 'No Web Page');
      actionsHtml = `
        <a 
          ${hasApk ? `href="${escapeHtml(app.release.downloadUrl)}" download` : 'role="button" aria-disabled="true" tabindex="-1"'}
          class="btn btn-download ${!hasApk ? 'disabled' : ''}">
          ${downloadLabel}
        </a>
        <a 
          ${app.hasPages ? `href="${escapeHtml(app.pageUrl)}" target="_blank" rel="noopener noreferrer"` : 'role="button" aria-disabled="true" tabindex="-1"'}
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
    // Load cached manifest first so we have custom names/icons and release cache ready
    const cachedList = await loadCachedManifest();
    const cacheMap = new Map(
      cachedList.map(item => [(item.repo || '').toLowerCase(), item])
    );

    let repos = [];
    try {
      // Live GitHub topic discovery ('android-app' and 'webapp')
      repos = await fetchTaggedRepositories();
    } catch (apiErr) {
      console.warn('Live GitHub API rate-limited or unreachable, using cached manifest:', apiErr);
    }

    if (repos.length > 0) {
      appCatalog = await Promise.all(repos.map(async (repo) => {
        const cached = cacheMap.get(repo.full_name.toLowerCase()) || {};
        const topics = (repo.topics || []).map(t => t.toLowerCase());
        const isAndroid = topics.includes('android-app');
        const isWeb = topics.includes('webapp');

        // Use cached release info if available, otherwise fetch live for Android apps
        let release = cached.release || { version: null, downloadUrl: null, sizeMb: null };
        if (isAndroid && (!release || !release.downloadUrl)) {
          release = await resolveReleaseData(repo.full_name);
        }

        return {
          id: repo.name.toLowerCase(),
          name: cached.name || formatTitle(repo.name),
          description: repo.description || cached.fallbackDesc || 'Application developed by SEnterpriseHub.',
          repoFullName: repo.full_name,
          repoUrl: repo.html_url,
          appType: isAndroid && isWeb ? 'hybrid' : (isWeb ? 'webapp' : 'android'),
          topics,
          pageUrl: cached.pageUrl || repo.homepage || `https://${GITHUB_OWNER}.github.io/${repo.name}/`,
          hasPages: Boolean(cached.pageUrl || repo.homepage || repo.has_pages || isWeb),
          iconUrl: cached.defaultIcon || `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch || 'main'}/icon.png`,
          release
        };
      }));
    } else if (cachedList.length > 0) {
      // Fallback if visitor is rate-limited by GitHub API
      appCatalog = cachedList.map(item => ({
        id: (item.id || item.name || '').toLowerCase(),
        name: item.name,
        description: item.fallbackDesc || 'Application developed by SEnterpriseHub.',
        repoFullName: item.repo,
        repoUrl: item.repoUrl || `https://github.com/${item.repo}`,
        appType: item.appType || 'android',
        topics: item.topics || ['android-app'],
        pageUrl: item.pageUrl,
        hasPages: true,
        iconUrl: item.defaultIcon,
        release: item.release || { version: null, downloadUrl: null, sizeMb: null }
      }));
    }

    statusContainer.style.display = 'none';
    appGrid.style.display = 'grid';
    renderCards(appCatalog, false);

    // Real-time search across name, description, ID, or topic ('android-app' / 'webapp')
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
    statusContainer.innerHTML = `<p style="color: #ef4444;">Failed to discover applications: ${escapeHtml(err.message)}</p>`;
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
