// scripts/build-manifest.js
const fs = require('fs');
const path = require('path');

const GITHUB_OWNER = 'senterprisehub';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const ROOT_DIR = fs.existsSync(path.join(__dirname, 'apps.json'))
  ? __dirname
  : path.join(__dirname, '..');

const MANIFEST_INPUT = path.join(ROOT_DIR, 'apps.json');
const MANIFEST_OUTPUT = path.join(ROOT_DIR, 'apps-data.json');

function getHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SEnterpriseHub-Manifest-Builder'
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`; } return headers; }  function formatTitle(repoName) { return repoName .replace(/[-_]/g, ' ') .replace(/\b\w/g, char => char.toUpperCase()); }  // Fetch all user repos and filter by topic: 'android-app' or 'webapp' async function fetchTopicRepositories() { const url = `https://api.github.com/users/${GITHUB_OWNER}/repos?per_page=100&sort=updated`;
  const res = await fetch(url, { headers: getHeaders() });

  if (!res.ok) {
    throw new Error(`Failed to fetch user repos: ${res.status} ${res.statusText}`); }  const repos = await res.json(); return repos.filter(repo => { const topics = (repo.topics \vert{}\vert{} []).map(t => t.toLowerCase()); return topics.includes('android-app') \vert{}\vert{} topics.includes('webapp'); }); }  async function fetchLatestRelease(repoFullName) { try { const res = await fetch(`https://api.github.com/repos/${repoFullName}/releases/latest`, {
      headers: getHeaders()
    });

    if (!res.ok) return null;

    const data = await res.json();
    const apkAsset = (data.assets || []).find(asset =>
      asset.name && asset.name.toLowerCase().endsWith('.apk')
    );

    return {
      version: data.tag_name || 'v1.0.0',
      publishedAt: data.published_at || null,
      downloadUrl: apkAsset ? apkAsset.browser_download_url : null,
      fileName: apkAsset ? apkAsset.name : null,
      sizeMb: apkAsset ? (apkAsset.size / (1024 * 1024)).toFixed(1) : null
    };
  } catch (err) {
    console.warn(`[WARN] Failed release fetch for ${repoFullName}:`, err.message);
    return null;
  }
}

async function run() {
  // Load optional static overrides from apps.json if present
  let staticOverrides = [];
  if (fs.existsSync(MANIFEST_INPUT)) {
    try {
      staticOverrides = JSON.parse(fs.readFileSync(MANIFEST_INPUT, 'utf-8'));
    } catch (e) {
      console.warn('[WARN] Could not parse apps.json, continuing with live topic discovery.');
    }
  }

  const overrideMap = new Map(
    staticOverrides.map(item => [item.repo.toLowerCase(), item])
  );

  console.log(`Discovering repositories tagged with 'android-app' or 'webapp'...`);
  const discoveredRepos = await fetchTopicRepositories();
  console.log(`Found ${discoveredRepos.length} topic-tagged repositories.`);

  const compiledData = await Promise.all(
    discoveredRepos.map(async (repo) => {
      const override = overrideMap.get(repo.full_name.toLowerCase()) || {};
      const topics = (repo.topics || []).map(t => t.toLowerCase());
      const isAndroid = topics.includes('android-app');
      const isWeb = topics.includes('webapp');

      // Only query GitHub Releases API if it's an Android app
      const releaseInfo = isAndroid ? await fetchLatestRelease(repo.full_name) : null;

      return {
        id: override.id || repo.name.toLowerCase(),
        name: override.name || formatTitle(repo.name),
        repo: repo.full_name,
        repoUrl: repo.html_url,
        appType: isAndroid && isWeb ? 'hybrid' : (isWeb ? 'webapp' : 'android'),
        topics,
        pageUrl: override.pageUrl || repo.homepage || `https://${GITHUB_OWNER}.github.io/${repo.name}/`,
        hasPages: Boolean(override.pageUrl || repo.homepage || repo.has_pages || isWeb),
        defaultIcon: override.defaultIcon || `https://raw.githubusercontent.com/${repo.full_name}/${repo.default_branch || 'main'}/icon.png`,
        fallbackDesc: repo.description || override.fallbackDesc || 'Application developed by SEnterpriseHub.',
        release: releaseInfo || {
          version: isWeb && !isAndroid ? 'Web App' : null,
          publishedAt: null,
          downloadUrl: null,
          fileName: null,
          sizeMb: null
        }
      };
    })
  );

  fs.writeFileSync(MANIFEST_OUTPUT, JSON.stringify(compiledData, null, 2), 'utf-8');
  console.log(`Successfully generated ${MANIFEST_OUTPUT} with${compiledData.length} apps.`);
}

run().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
