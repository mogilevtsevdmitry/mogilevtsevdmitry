import { mkdir, writeFile } from 'node:fs/promises';

const owner = process.env.GITHUB_REPOSITORY_OWNER || 'mogilevtsevdmitry';
const token = process.env.GITHUB_TOKEN || '';
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

function escapeXml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function shortNumber(value) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

const palette = ['#7c3aed', '#06b6d4', '#22c55e', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#fb7185'];

async function loadData() {
  const [profile, repos] = await Promise.all([github(`/users/${owner}`), github(`/users/${owner}/repos?per_page=100&sort=updated`)]);
  const publicRepos = repos.filter((repo) => !repo.fork && repo.name !== owner && !repo.archived);
  const languageResults = await Promise.all(publicRepos.map(async (repo) => {
    try { return { languages: await github(`/repos/${owner}/${repo.name}/languages`) }; } catch { return { languages: {} }; }
  }));
  const languages = {};
  for (const { languages: repoLanguages } of languageResults) for (const [language, bytes] of Object.entries(repoLanguages)) languages[language] = (languages[language] || 0) + bytes;
  const topLanguages = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topRepos = [...publicRepos].sort((a, b) => (b.stargazers_count - a.stargazers_count) || (b.forks_count - a.forks_count) || (new Date(b.pushed_at) - new Date(a.pushed_at))).slice(0, 8);
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  return { profile, topRepos, topLanguages, totals: { repos: publicRepos.length, stars: publicRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0), forks: publicRepos.reduce((sum, repo) => sum + repo.forks_count, 0), active: publicRepos.filter((repo) => new Date(repo.pushed_at).getTime() >= cutoff).length } };
}

function card(x, width, label, value, accent) {
  return `<rect x="${x}" y="116" width="${width}" height="92" rx="16" fill="#111827" stroke="#26324a"/><rect x="${x}" y="116" width="5" height="92" rx="2.5" fill="${accent}"/><text x="${x + 22}" y="147" fill="#94a3b8" font-size="13" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${escapeXml(label)}</text><text x="${x + 22}" y="185" fill="#f8fafc" font-size="29" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${escapeXml(value)}</text>`;
}

function renderProfileStats(data) {
  const languageTotal = data.topLanguages.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
  const languageRows = data.topLanguages.map(([language, bytes], index) => {
    const y = 382 + index * 31; const ratio = bytes / languageTotal;
    return `<text x="62" y="${y}" fill="#e2e8f0" font-size="13" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${escapeXml(language)}</text><rect x="180" y="${y - 13}" width="500" height="10" rx="5" fill="#1e293b"/><rect x="180" y="${y - 13}" width="${Math.max(8, 500 * ratio)}" height="10" rx="5" fill="${palette[index % palette.length]}"/><text x="700" y="${y}" fill="#94a3b8" font-size="12" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${(ratio * 100).toFixed(1)}%</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700" role="img" aria-label="GitHub profile statistics"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0b1020"/><stop offset="1" stop-color="#17113a"/></linearGradient></defs><rect width="900" height="700" rx="24" fill="url(#bg)"/><circle cx="820" cy="70" r="130" fill="#7c3aed" opacity=".11"/><circle cx="70" cy="650" r="170" fill="#06b6d4" opacity=".08"/><text x="52" y="60" fill="#f8fafc" font-size="27" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">GitHub activity</text><text x="52" y="87" fill="#94a3b8" font-size="13" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${escapeXml(data.profile.login)} · данные из GitHub API</text>${card(52, 190, 'ACTIVE PROJECTS', shortNumber(data.totals.repos), '#8b5cf6')}${card(258, 190, 'TOTAL STARS', shortNumber(data.totals.stars), '#f59e0b')}${card(464, 190, 'FORKS', shortNumber(data.totals.forks), '#06b6d4')}${card(670, 178, 'ACTIVE / 365D', shortNumber(data.totals.active), '#22c55e')}<text x="52" y="274" fill="#f8fafc" font-size="19" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Языки в проектах</text><text x="52" y="298" fill="#94a3b8" font-size="12" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">по объёму исходного кода активных репозиториев, без форков</text>${languageRows || '<text x="52" y="360" fill="#94a3b8" font-size="13" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Данные появятся после первого запуска workflow</text>'}<line x1="52" y1="638" x2="848" y2="638" stroke="#26324a"/><text x="52" y="665" fill="#64748b" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Обновляется ежедневно · архивные репозитории не учитываются</text></svg>`;
}

function renderProjectStats(data) {
  const rows = data.topRepos.map((repo, index) => {
    const y = 156 + index * 77; const description = (repo.description || 'Проект без описания').replace(/\s+/g, ' ').slice(0, 74);
    return `<a href="${escapeXml(repo.html_url)}"><rect x="52" y="${y - 27}" width="1096" height="62" rx="14" fill="${index % 2 ? '#111827' : '#0f172a'}" stroke="#25314a"/><circle cx="83" cy="${y + 4}" r="17" fill="${palette[index % palette.length]}" opacity=".18"/><text x="83" y="${y + 9}" text-anchor="middle" fill="${palette[index % palette.length]}" font-size="15" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${index + 1}</text><text x="116" y="${y - 1}" fill="#f8fafc" font-size="15" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${escapeXml(repo.name)}</text><text x="116" y="${y + 20}" fill="#94a3b8" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${escapeXml(description)}</text><text x="832" y="${y + 4}" fill="#cbd5e1" font-size="12" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${escapeXml(repo.language || '—')}</text><text x="954" y="${y + 4}" fill="#fbbf24" font-size="12" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">★ ${repo.stargazers_count}</text><text x="1040" y="${y + 4}" fill="#a5b4fc" font-size="12" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">⑂ ${repo.forks_count}</text></a>`;
  }).join('');
  const height = Math.max(280, 205 + data.topRepos.length * 77);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-label="Most popular GitHub projects"><defs><linearGradient id="projectBg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#0b1020"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="1200" height="${height}" rx="24" fill="url(#projectBg)"/><text x="52" y="58" fill="#f8fafc" font-size="27" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Проекты, которыми стоит поделиться</text><text x="52" y="86" fill="#94a3b8" font-size="13" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Топ публичных репозиториев по звёздам, форкам и свежести</text><text x="116" y="124" fill="#64748b" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">РЕПОЗИТОРИЙ</text><text x="832" y="124" fill="#64748b" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">ЯЗЫК</text><text x="954" y="124" fill="#64748b" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">STARS</text><text x="1040" y="124" fill="#64748b" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">FORKS</text>${rows}<text x="52" y="${height - 30}" fill="#64748b" font-size="11" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">Клик по строке открывает репозиторий · обновляется ежедневно</text></svg>`;
}

const data = await loadData();
await mkdir('assets', { recursive: true });
await writeFile('assets/profile-stats.svg', renderProfileStats(data));
await writeFile('assets/project-stats.svg', renderProjectStats(data));
console.log(JSON.stringify({ owner, repos: data.totals.repos, stars: data.totals.stars, languages: data.topLanguages.length, topProjects: data.topRepos.length }));
