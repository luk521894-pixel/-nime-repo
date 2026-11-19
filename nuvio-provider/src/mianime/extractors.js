const TMDB_API_KEY = '1865f43a0549ca50d341dd9ab8b29f49';
const LATANIME = 'https://latanime.org';
const ALLOWED_EMBED_HOSTS = /(?:filemoon|dsvplay|mega\.nz|uqload|luluv|mxdrop|listeamed|voe\.sx|mp4upload)/i;

function absoluteUrl(value, base) {
  if (!value) return null;
  try { return new URL(value, base).toString(); } catch (_) { return value; }
}

function fetchText(url) {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (NuvioProvider/1.1)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  });
}

function fetchJson(url) {
  return fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (NuvioProvider/1.1)' } })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
}

function decodeBase64(value) {
  try { return atob(value); } catch (_) { return null; }
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleFromArgument(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.title || value.name || value.originalTitle || '';
  return '';
}

function resolveTitle(tmdbId, mediaType, suppliedTitle) {
  const direct = titleFromArgument(suppliedTitle);
  if (direct) return Promise.resolve(direct);
  const kind = mediaType === 'tv' ? 'tv' : 'movie';
  return fetchJson(`https://api.themoviedb.org/3/${kind}/${encodeURIComponent(tmdbId)}?api_key=${TMDB_API_KEY}&language=es-ES`)
    .then((data) => data.title || data.name || data.original_title || data.original_name || '');
}

function findAnimePage(html, title) {
  const wanted = normalize(title);
  const links = [];
  const regex = /<a[^>]+href=["']([^"']*\/anime\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const text = normalize(match[2].replace(/<[^>]+>/g, ' '));
    const url = absoluteUrl(match[1], LATANIME);
    if (!url || links.some((item) => item.url === url)) continue;
    links.push({ url, text, score: text.includes(wanted) ? 3 : wanted.split(' ').filter((word) => word.length > 2 && text.includes(word)).length });
  }
  links.sort((a, b) => b.score - a.score);
  return links.length && links[0].score > 0 ? links[0].url : null;
}

function findEpisodePage(html, episode, season) {
  const wanted = String(Number(episode || 1));
  const seasonText = season ? `s${Number(season)}` : '';
  const regex = /<a[^>]+href=["']([^"']*\/ver\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(html))) {
    const text = normalize(match[2].replace(/<[^>]+>/g, ' '));
    const href = match[1];
    const slug = normalize(href);
    const hasEpisode = new RegExp(`(?:episodio|capitulo|episode)[ -_]*0*${wanted}(?:[^0-9]|$)`, 'i').test(`${text} ${slug}`);
    const hasSeason = !seasonText || Number(season) === 1 || slug.includes(seasonText) || text.includes(seasonText);
    if (hasEpisode && hasSeason) matches.push(absoluteUrl(href, LATANIME));
  }
  return matches[0] || null;
}

function extractLatanimePlayers(html) {
  const players = [];
  const regex = /<a[^>]+class=["'][^"']*play-video[^"']*["'][^>]+data-player=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const name = match[2].replace(/<[^>]+>/g, '').trim();
    const embed = decodeBase64(match[1]);
    if (!embed || !ALLOWED_EMBED_HOSTS.test(embed)) continue;
    const url = `https://latanime.org/reproductor?url=${encodeURIComponent(embed)}`;
    if (!players.some((item) => item.url === url)) players.push({ name, url });
  }
  return players;
}

function getStreamsFromLatanime(tmdbId, mediaType, season, episode, suppliedTitle) {
  return resolveTitle(tmdbId, mediaType, suppliedTitle).then((title) => {
    if (!title) return [];
    return fetchText(`${LATANIME}/?s=${encodeURIComponent(title)}`).then((searchHtml) => {
      const animeUrl = findAnimePage(searchHtml, title);
      if (!animeUrl) return [];
      return fetchText(animeUrl).then((animeHtml) => {
        const episodeUrl = findEpisodePage(animeHtml, episode, season);
        if (!episodeUrl) return [];
        return fetchText(episodeUrl).then((episodeHtml) => extractLatanimePlayers(episodeHtml).map((player, index) => ({
          name: `Latanime - ${player.name || `Servidor ${index + 1}`}`,
          title: episode ? `Episodio ${episode}` : title,
          url: player.url,
          quality: 'HD',
          headers: { Referer: `${LATANIME}/` }
        })));
      });
    });
  });
}

function getStreamsFromAnimeAV1() {
  return Promise.resolve([]);
}

function getStreamsFromTodoAnime() {
  return Promise.resolve([]);
}

module.exports = { getStreamsFromLatanime, getStreamsFromAnimeAV1, getStreamsFromTodoAnime };
