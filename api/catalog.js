// api/catalog.js
const GITHUB_OWNER = 'senterprisehub';
const TARGET_TOPICS = ['android-app', 'webapp'];

function formatTitle(repoName) {
  return String(repoName || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SenterDepo-Vercel-Catalog'
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchRelease(repoFullName) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/releases/latest`, {
      headers: getHeaders()
    });
    if (!res.ok) return { version: null, downloadUrl: null, sizeMb: null };
    const data = await res.json();
    const apkAsset = (data.assets || []).find(a => a.name && a.name.toLowerCase().endsWith('.apk'));

    return {
      version: data.tag_name || 'v1.0.0',
      downloadUrl: apkAsset ? apkAsset.browser_download_url : null,
      sizeMb: apkAsset ? (apkAsset.size / (1024 * 1024)).toFixed(1) : null
    };
  } catch (_) {
    return { version: null, downloadUrl: null, sizeMb: null };
  }
}

module.exports = async function handler(req, res) {
  try {
    const url = `https://api.github.com/users/${GITHUB_OWNER}/repos?per_page=100&sort=updated`;
    const repoRes = await fetch(url, { headers: getHeaders() });

    if (!repoRes.ok) {
      return res.status(repoRes.status).json({ error: `GitHub API returned ${repoRes.status}` });
    }

    const repos = await repoRes.json();
    const taggedRepos = (repos || []).filter(repo => {
      const topics = (repo.topics || []).map(t => t.toLowerCase());
      return TARGET_TOPICS.some(target => topics.includes(target));
    });

    const catalog = await Promise.all(
      taggedRepos.map(async (repo) => {
        const topics = (repo.topics || []).map(t => t.toLowerCase());
        const isAndroid = topics.includes('android-app');
        const isWeb = topics.includes('webapp');
        const branch = repo.default_branch || 'main';

        const release = isAndroid
          ? await fetchRelease(repo.full_name)
          : { version: 'Web App', downloadUrl: null, sizeMb: null };

        return {
          id: repo.name.toLowerCase(),
          name: formatTitle(repo.name),
          description: repo.description || 'Utility application published on SenterDepo.',
          repoFullName: repo.full_name,
          repoUrl: repo.html_url,
          appType: isAndroid && isWeb ? 'hybrid' : (isWeb ? 'webapp' : 'android'),
          topics,
          pageUrl: repo.homepage || `https://${GITHUB_OWNER}.github.io/${repo.name}/`,
          hasPages: Boolean(repo.homepage || repo.has_pages || isWeb),
          iconUrl: `https://raw.githubusercontent.com/${repo.full_name}/${branch}/icon.png`,
          release
        };
      })
    );

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json(catalog);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
