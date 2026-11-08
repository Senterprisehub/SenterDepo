const GITHUB_OWNER = 'senterprisehub';
const APP_TOPIC = 'android-app'; // The topic you will tag your app repos with

let appCatalog = [];

// Fallback high-contrast vector icon generator
function createSvgPlaceholder(name) {
  const initial = (name || 'A').charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
    <rect width="60" height="60" rx="14" fill="#1e293b"/>
    <text x="50%" y="54%" font-family="system-ui, sans-serif" font-weight="700" font-size="28" fill="#38bdf8" dominant-baseline="middle" text-anchor="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Format repo names into readable titles (e.g., "Mock-GPS-Pro" -> "Mock GPS Pro")
function formatTitle(repoName) {
  return repoName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

// 1. Discover all repos under the account with the target topic
async function fetchTaggedRepositories() {
  const query = `user:${GITHUB_OWNER} topic:${APP_TOPIC} fork:true`;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=100`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });

  if (!res.ok) throw new Error(`GitHub Search API returned status ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

// 2. Fetch the latest release and APK asset for each discovered repo
async function resolveReleaseData(repoFullName) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
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

function renderCards(apps) {
  const grid = document.getElementById('app-grid');
  grid.innerHTML = '';

  if (apps.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 2rem;">No repositories tagged with "${APP_TOPIC}" found.</div>`;
    return;
  }

  apps.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card';

    const hasApk = Boolean(app.release && app.release.downloadUrl);
    const downloadLabel = hasApk ? 'Download APK' : 'APK Pending';
    const fallback = createSvgPlaceholder(app.name);

    card.innerHTML = `
      <div class="card-header">
        <img 
          class="app-logo" 
          src="${app.iconUrl}" 
          alt="${app.name} icon" 
          onerror="this.onerror=null; this.src='${fallback}';" 
        />
        <div class="card-title-group">
          <div class="app-title" title="${app.name}">${app.name}</div>
          <span class="version-pill">${app.release?.version || 'Latest'}</span>
        </div>
      </div>
      
      <p class="app-desc">${app.description}</p>
      
      <div class="meta-stats">
        <span>Type: <strong>Android APK</strong></span>
        <span>Size: <strong>${app.release?.sizeMb ? `${app.release.sizeMb} MB` : 'Auto'}</strong></span>
      </div>

      <div class="actions-group">
        <a 
          href="${app.release?.downloadUrl || '#'}" 
          class="btn btn-download ${!hasApk ? 'disabled' : ''}" 
          ${hasApk ? 'download' : ''}>
          ${downloadLabel}
        </a>
        <a 
          href="${app.pageUrl}" 
          target="_blank" 
          rel="noopener noreferrer" 
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
    const repos = await fetchTaggedRepositories();

    // Map discovered repos and resolve release metadata concurrently
    appCatalog = await Promise.all(repos.map(async (repo) => {
      const release = await resolveReleaseData(repo.full_name);
      
      return {
        id: repo.name.toLowerCase(),
        name: formatTitle(repo.name),
        description: repo.description || 'Android application developed by SEnterpriseHub.',
        repoFullName: repo.full_name,
        // Derives GitHub Pages URL: https://senterprisehub.github.io/<repo-name>/
        pageUrl: `https://${GITHUB_OWNER}.github.io/${repo.name}/`,
        hasPages: repo.has_pages,
        // Assumes root icon.png in default branch
        iconUrl: `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch}/icon.png`,
        release
      };
    }));

    statusContainer.style.display = 'none';
    appGrid.style.display = 'grid';
    renderCards(appCatalog);

    // Filter cards in real time
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = appCatalog.filter(item => 
          item.name.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.id.includes(term)
        );
        renderCards(filtered);
      });
    }

  } catch (err) {
    statusContainer.innerHTML = `<p style="color: #ef4444;">Failed to discover applications via GitHub API: ${err.message}</p>`;
    console.error(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
