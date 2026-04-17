const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ============================================================
//  CONFIGURACIÓN DEL ADDON
// ============================================================
const BASE_URL = 'https://ww3.animeonline.ninja';

const ADDON_CONFIG = {
  id: 'org.animeonlineninja.stremio',
  version: '1.0.0',
  name: '🥷 AnimeOnline Ninja',
  description: 'Catálogo completo de AnimeOnline.Ninja — Sub Español HD sin censura',
  logo: 'https://ww3.animeonline.ninja/favicon.ico',
  background: 'https://i.imgur.com/7VWBND1.jpg',
  catalogs: [
    {
      type: 'series',
      id: 'aon-recientes',
      name: '⚡ Episodios Recientes',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      type: 'series',
      id: 'aon-en-emision',
      name: '📡 En Emisión',
      extra: [{ name: 'skip', isRequired: false }]
    },
    {
      type: 'series',
      id: 'aon-buscar',
      name: '🔍 Buscar Anime',
      extra: [
        { name: 'search', isRequired: true }
      ]
    }
  ],
  resources: ['catalog', 'meta', 'stream'],
  types: ['series'],
  idPrefixes: ['aon:']
};

// ============================================================
//  HTTP FETCH — con User-Agent de navegador real
// ============================================================
function fetchPage(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try { parsedUrl = new URL(targetUrl); } catch (e) { return reject(e); }

    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': BASE_URL + '/',
        ...(options.headers || {})
      },
      timeout: options.timeout || 12000
    };

    const req = lib.request(reqOptions, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsedUrl.protocol}//${parsedUrl.hostname}${res.headers.location}`;
        return fetchPage(next, options).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ html: data, statusCode: res.statusCode }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ============================================================
//  PARSERS ESPECÍFICOS PARA ANIMEONLINE.NINJA
//  La web usa WordPress + plugin de anime — estructura conocida
// ============================================================

/**
 * Extrae los episodios recientes de la home / página de episodios
 * Estructura: <article class="..."> con enlace y thumbnail
 */
function parseEpisodios(html) {
  const items = [];
  // Artículos de episodio: tienen clase "TPost" o "EpNew" o similar en themes de anime WP
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const block = match[1];

    // Título
    const titleMatch = block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (!titleMatch) continue;
    const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (!title) continue;

    // Enlace de la página del episodio
    const linkMatch = block.match(/<a[^>]+href=["'](https?:\/\/[^"']+)["']/i);
    if (!linkMatch) continue;
    const link = linkMatch[1];

    // Imagen de portada
    const imgMatch = block.match(/data-src=["']([^"']+)["']/)
      || block.match(/<img[^>]+src=["']([^"']+)["']/i);
    const poster = imgMatch ? imgMatch[1] : null;

    // Número de episodio si está en el título
    const epNum = title.match(/\d+/)?.[0] || null;

    // ID único basado en el slug de la URL
    const slug = link.replace(/\/$/, '').split('/').pop();
    const id = `aon:ep:${slug}`;

    // Nombre del anime (quitar "Episodio X" del final)
    const animeName = title.replace(/[–-]?\s*[Ee]pisodio\s*\d+.*$/, '').trim() || title;

    items.push({
      id,
      type: 'series',
      name: animeName,
      poster,
      description: title,
      _episodeUrl: link,
      _epNum: epNum
    });
  }

  return items;
}

/**
 * Extrae el catálogo de animes (serie completa)
 */
function parseAnimes(html) {
  const items = [];
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const block = match[1];

    const titleMatch = block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (!titleMatch) continue;
    const name = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (!name) continue;

    const linkMatch = block.match(/<a[^>]+href=["'](https?:\/\/[^"']+)["']/i);
    if (!linkMatch) continue;
    const link = linkMatch[1];

    const imgMatch = block.match(/data-src=["']([^"']+)["']/)
      || block.match(/<img[^>]+src=["']([^"']+)["']/i);
    const poster = imgMatch ? imgMatch[1] : null;

    const slug = link.replace(/\/$/, '').split('/').pop();

    items.push({
      id: `aon:serie:${slug}`,
      type: 'series',
      name,
      poster,
      _serieUrl: link
    });
  }

  return items;
}

/**
 * Extrae los iframes/fuentes de video de la página de un episodio
 */
function extractVideoSources(html) {
  const sources = [];

  // Iframes embebidos
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = iframeRegex.exec(html)) !== null) {
    if (!/ads|banner|comment|disqus/i.test(m[1])) {
      sources.push({ type: 'iframe', url: m[1] });
    }
  }

  // data-src en iframes (lazy load)
  const lazyRegex = /<iframe[^>]+data-src=["']([^"']+)["']/gi;
  while ((m = lazyRegex.exec(html)) !== null) {
    if (!/ads|banner|comment|disqus/i.test(m[1])) {
      sources.push({ type: 'iframe', url: m[1] });
    }
  }

  // URLs directas de video
  const videoRegex = /["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv)[^"']*?)["']/gi;
  while ((m = videoRegex.exec(html)) !== null) {
    sources.push({ type: 'direct', url: m[1] });
  }

  // Botones de servidor con data-url
  const serverRegex = /data-(?:url|src|video)=["']([^"']+)["']/gi;
  while ((m = serverRegex.exec(html)) !== null) {
    if (m[1].startsWith('http') && !/jpg|png|gif|svg/i.test(m[1])) {
      sources.push({ type: 'server', url: m[1] });
    }
  }

  // Deduplicar
  const seen = new Set();
  return sources.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

/**
 * Detecta el servidor de video y genera título amigable
 */
function labelSource(url) {
  if (/youtube|youtu\.be/i.test(url))    return '▶ YouTube';
  if (/streamtape/i.test(url))           return '▶ Streamtape';
  if (/mp4upload/i.test(url))            return '▶ Mp4Upload';
  if (/doodstream|dood\./i.test(url))    return '▶ DoodStream';
  if (/filemoon/i.test(url))             return '▶ FileMoon';
  if (/okru|ok\.ru/i.test(url))          return '▶ OK.ru';
  if (/fembed|femax/i.test(url))         return '▶ Fembed';
  if (/uqload/i.test(url))               return '▶ UQload';
  if (/vidhide|streamhide/i.test(url))   return '▶ VidHide';
  if (/\.m3u8/i.test(url))              return '▶ HLS Directo';
  if (/\.mp4/i.test(url))               return '▶ MP4 Directo';
  return '▶ Servidor';
}

// ============================================================
//  CACHÉ EN MEMORIA (TTL: 10 min para catálogo, 30 min meta)
// ============================================================
const cache = new Map();

async function cached(key, ttlMs, fn) {
  const now = Date.now();
  if (cache.has(key)) {
    const { data, ts } = cache.get(key);
    if (now - ts < ttlMs) return data;
  }
  const data = await fn();
  cache.set(key, { data, ts: now });
  return data;
}

// ============================================================
//  ADDON BUILDER
// ============================================================
const builder = new addonBuilder(ADDON_CONFIG);

// ────────────────────────────────────────────────
//  CATÁLOGO
// ────────────────────────────────────────────────
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  console.log(`[CATALOG] ${id}`, extra);

  try {
    // BÚSQUEDA
    if (id === 'aon-buscar' && extra && extra.search) {
      const query = encodeURIComponent(extra.search);
      const url = `${BASE_URL}/?s=${query}`;
      const { html } = await fetchPage(url);
      const results = parseAnimes(html);
      return { metas: results.map(({ _serieUrl, _episodeUrl, _epNum, ...m }) => m) };
    }

    // EPISODIOS RECIENTES
    if (id === 'aon-recientes') {
      const skip = parseInt(extra?.skip || '0', 10);
      const page = Math.floor(skip / 20) + 1;
      const url = page > 1
        ? `${BASE_URL}/episodio/page/${page}/`
        : `${BASE_URL}/episodio/`;

      const metas = await cached(`recientes:${page}`, 10 * 60 * 1000, async () => {
        const { html } = await fetchPage(url);
        const items = parseEpisodios(html);
        return items.map(({ _episodeUrl, _epNum, ...m }) => m);
      });

      return { metas };
    }

    // EN EMISIÓN
    if (id === 'aon-en-emision') {
      const skip = parseInt(extra?.skip || '0', 10);
      const page = Math.floor(skip / 20) + 1;
      const url = page > 1
        ? `${BASE_URL}/en-emision/page/${page}/`
        : `${BASE_URL}/en-emision/`;

      const metas = await cached(`emision:${page}`, 15 * 60 * 1000, async () => {
        const { html } = await fetchPage(url);
        const items = parseAnimes(html);
        return items.map(({ _serieUrl, _episodeUrl, _epNum, ...m }) => m);
      });

      return { metas };
    }

    return { metas: [] };
  } catch (err) {
    console.error('[CATALOG ERROR]', err.message);
    return { metas: [] };
  }
});

// ────────────────────────────────────────────────
//  META (detalles de la serie/episodio)
// ────────────────────────────────────────────────
builder.defineMetaHandler(async ({ type, id }) => {
  console.log(`[META] ${id}`);

  try {
    // Reconstruir URL desde el ID
    // id formato: aon:ep:slug o aon:serie:slug
    const parts = id.split(':');
    const kind = parts[1]; // 'ep' o 'serie'
    const slug = parts.slice(2).join(':');

    let pageUrl;
    if (kind === 'ep') {
      pageUrl = `${BASE_URL}/episodio/${slug}/`;
    } else {
      pageUrl = `${BASE_URL}/anime/${slug}/`;
    }

    const meta = await cached(`meta:${id}`, 30 * 60 * 1000, async () => {
      const { html } = await fetchPage(pageUrl);

      // Título
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      const name = (ogTitle?.[1] || titleMatch?.[1] || slug)
        .replace(/\s*[|–-]\s*.*$/, '').trim();

      // Imagen
      const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const poster = ogImg?.[1] || null;

      // Descripción
      const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
      const descTag = html.match(/<div[^>]*class=["'][^"']*descripcion[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      const description = ogDesc?.[1]
        || (descTag ? descTag[1].replace(/<[^>]+>/g, ' ').trim().slice(0, 400) : '')
        || '';

      // Géneros
      const genreMatches = [...html.matchAll(/<a[^>]+rel=["']tag["'][^>]*>([\s\S]*?)<\/a>/gi)];
      const genres = genreMatches.map(m => m[1].trim()).filter(Boolean);

      return {
        id,
        type: 'series',
        name,
        poster,
        background: poster,
        description,
        genres: genres.length ? genres : ['Anime'],
        _pageUrl: pageUrl
      };
    });

    return { meta };
  } catch (err) {
    console.error('[META ERROR]', err.message);
    return { meta: null };
  }
});

// ────────────────────────────────────────────────
//  STREAMS
// ────────────────────────────────────────────────
builder.defineStreamHandler(async ({ type, id }) => {
  console.log(`[STREAM] ${id}`);

  try {
    const parts = id.split(':');
    const kind = parts[1];
    const slug = parts.slice(2).join(':');

    // Solo episodios tienen streams directos
    const pageUrl = kind === 'ep'
      ? `${BASE_URL}/episodio/${slug}/`
      : `${BASE_URL}/anime/${slug}/`;

    const { html } = await fetchPage(pageUrl);
    const sources = extractVideoSources(html);

    if (sources.length === 0) {
      // Ofrecer link externo si no se encontraron fuentes
      return {
        streams: [{
          name: '🥷 AnimeOnline',
          title: '🌐 Abrir en navegador',
          externalUrl: pageUrl
        }]
      };
    }

    const streams = sources.map((src, i) => ({
      name: '🥷 AnimeOnline',
      title: `${labelSource(src.url)} ${sources.length > 1 ? `(${i + 1}/${sources.length})` : ''}`,
      url: src.url,
      ...(src.type === 'iframe' ? { behaviorHints: { notWebReady: true } } : {})
    }));

    return { streams };
  } catch (err) {
    console.error('[STREAM ERROR]', err.message);
    return { streams: [] };
  }
});

// ============================================================
//  INICIAR SERVIDOR
// ============================================================
const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });

console.log(`
╔═══════════════════════════════════════════════════════╗
║         🥷 AnimeOnline.Ninja Addon para Stremio       ║
╠═══════════════════════════════════════════════════════╣
║  Servidor: http://127.0.0.1:${PORT}                     ║
║                                                       ║
║  Instalar en Stremio:                                 ║
║  → Configuración > Addons > Addon de la comunidad     ║
║  → Pega: http://127.0.0.1:${PORT}/manifest.json         ║
╚═══════════════════════════════════════════════════════╝

  Catálogos disponibles:
  ⚡ Episodios Recientes
  📡 En Emisión
  🔍 Buscar Anime
`);
