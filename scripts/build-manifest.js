// scripts/build-manifest.js
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const MANIFEST_INPUT = path.join(__dirname, '../apps.json');
const MANIFEST_OUTPUT = path.join(__dirname, '../apps-data.json');

async function fetchLatestRelease(repo) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'App-Directory-Builder'
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
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
      asset.name.toLowerCase().endsWith('.apk')
    );

    return {
      version: data.tag_name || 'N/A',
      publishedAt: data.published_at,
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

  const rawConfig = fs.readFileSync(MANIFEST_INPUT, 'utf-8');
  const appList = JSON.parse(rawConfig);
  const compiledData = [];

  for (const app of appList) {
    console.log(`Processing: ${app.name} (${app.repo})...`);
    const releaseInfo = await fetchLatestRelease(app.repo);

    compiledData.push({
      ...app,
      release: releaseInfo || {
        version: null,
        downloadUrl: null,
        sizeMb: null
      }
    });
  }

  fs.writeFileSync(MANIFEST_OUTPUT, JSON.stringify(compiledData, null, 2), 'utf-8');
  console.log(`Successfully generated: ${MANIFEST_OUTPUT}`);
}

run();
