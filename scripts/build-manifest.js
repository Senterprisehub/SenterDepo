// scripts/build-manifest.js
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Auto-resolve root directory whether script is in /scripts or root
const ROOT_DIR = fs.existsSync(path.join(__dirname, 'apps.json'))
  ? __dirname
  : path.join(__dirname, '..');

const MANIFEST_INPUT = path.join(ROOT_DIR, 'apps.json');
const MANIFEST_OUTPUT = path.join(ROOT_DIR, 'apps-data.json');

async function fetchLatestRelease(repo) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SEnterpriseHub-Manifest-Builder'
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });

    if (res.status === 404) {
      console.warn(`[WARN] No releases found for ${repo}`);
      return null;
    }

    if (!res.ok) {
      console.error(`[ERROR] Failed to fetch ${repo}: ${res.status} ${res.statusText}`);
      return null;
    }

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
    console.error(`[ERROR] Network issue on ${repo}:`, err.message);
    return null;
  }
}

async function run() {
  if (!fs.existsSync(MANIFEST_INPUT)) {
    console.error(`[FATAL] Input file not found: ${MANIFEST_INPUT}`);
    process.exit(1);
  }

  let appList;
  try {
    const rawConfig = fs.readFileSync(MANIFEST_INPUT, 'utf-8');
    appList = JSON.parse(rawConfig);
  } catch (err) {
    console.error(`[FATAL] Invalid JSON in ${MANIFEST_INPUT}:`, err.message);
    process.exit(1);
  }

  console.log(`Fetching release metadata for ${appList.length} apps...`);

  // Fetch concurrently for faster CI execution
  const compiledData = await Promise.all(
    appList.map(async (app) => {
      const releaseInfo = await fetchLatestRelease(app.repo);
      return {
        ...app,
        release: releaseInfo || {
          version: null,
          publishedAt: null,
          downloadUrl: null,
          fileName: null,
          sizeMb: null
        }
      };
    })
  );

  fs.writeFileSync(MANIFEST_OUTPUT, JSON.stringify(compiledData, null, 2), 'utf-8');
  console.log(`Successfully generated: ${MANIFEST_OUTPUT}`);
}

run();
