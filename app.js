const MANIFEST_URL = './apps.json';

async function fetchLatestRelease(repo) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    const apkAsset = (data.assets || []).find(a => a.name.toLowerCase().endsWith('.apk'));

    return {
      version: data.tag_name,
      downloadUrl: apkAsset ? apkAsset.browser_download_url : null,
      sizeMb: apkAsset ? (apkAsset.size / (1024 * 1024)).toFixed(1) : null
    };
  } catch (err) {
    console.error(`Error resolving ${repo}:`, err);
    return null;
  }
}

async function initDirectory() {
  const grid = document.getElementById('app-grid');
  const loader = document.getElementById('loader');

  try {
    const res = await fetch(MANIFEST_URL);
    const apps = await res.json();

    grid.innerHTML = '';

    const cards = await Promise.all(
      apps.map(async (app) => {
        const release = await fetchLatestRelease(app.repo);
        return createCard(app, release);
      })
    );

    cards.forEach(card => grid.appendChild(card));
  } catch (err) {
    grid.innerHTML = `<p style="color: #ef4444;">Failed to load apps directory.</p>`;
    console.error(err);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function createCard(app, release) {
  const card = document.createElement('div');
  card.className = 'app-card';

  const downloadText = release?.downloadUrl 
    ? `Download APK ${release.sizeMb ? `(${release.sizeMb} MB)` : ''}`
    : 'No APK Found';

  card.innerHTML = `
    <img class="app-logo" src="${app.icon}" alt="${app.name} icon" onerror="this.src='https://placehold.co/72x72/334155/ffffff?text=App'" />
    <h3 class="app-title">${app.name}</h3>
    <span class="version-badge">${release?.version || 'Latest'}</span>
    <p class="app-desc">${app.description}</p>
    <div class="button-group">
      <a href="${release?.downloadUrl || '#'}" class="btn btn-primary ${!release?.downloadUrl ? 'disabled' : ''}" ${release?.downloadUrl ? 'download' : ''}>
        ${downloadText}
      </a>
      ${app.pageUrl ? `<a href="${app.pageUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Visit Web Page</a>` : ''}
    </div>
  `;

  return card;
}

document.addEventListener('DOMContentLoaded', initDirectory);
