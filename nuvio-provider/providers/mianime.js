/** mianime - Nuvio provider */
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// nuvio-provider/src/mianime/extractors.js
var require_extractors = __commonJS({
  "nuvio-provider/src/mianime/extractors.js"(exports2, module2) {
    var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
    var LATANIME = "https://latanime.org";
    var BROWSER_HEADERS = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    };
    var EMBED_HOSTS = /(?:filemoon|dsvplay|mega\.nz|uqload|luluv|mxdrop|listeamed|voe\.sx|mp4upload)/i;
    function absoluteUrl(value, base) {
      if (!value)
        return null;
      try {
        return new URL(value, base).toString();
      } catch (_) {
        return value;
      }
    }
    function fetchText(url, extraHeaders) {
      return fetch(url, {
        headers: __spreadValues(__spreadValues({}, BROWSER_HEADERS), extraHeaders || {})
      }).then((response) => {
        if (!response || !response.ok)
          throw new Error(`HTTP ${response ? response.status : 0}`);
        return response.text();
      });
    }
    function fetchJson(url) {
      return fetch(url, { headers: BROWSER_HEADERS }).then((response) => {
        if (!response || !response.ok)
          throw new Error(`HTTP ${response ? response.status : 0}`);
        return response.json();
      });
    }
    function cleanTmdbId(tmdbId) {
      return String(tmdbId || "").replace(/^tmdb:/i, "").split(":")[0].trim();
    }
    function normalize(value) {
      return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/×/g, "x").replace(/[^a-z0-9]+/g, " ").trim();
    }
    function titleFromArgument(value) {
      if (!value)
        return "";
      if (typeof value === "string")
        return value.trim();
      if (typeof value === "object")
        return String(value.title || value.name || value.originalTitle || "").trim();
      return "";
    }
    function tmdbTitles(tmdbId, mediaType, suppliedTitle) {
      const direct = titleFromArgument(suppliedTitle);
      if (direct)
        return Promise.resolve([direct]);
      const kind = mediaType === "movie" ? "movie" : "tv";
      const id = cleanTmdbId(tmdbId);
      if (!id)
        return Promise.resolve([]);
      return fetchJson(`https://api.themoviedb.org/3/${kind}/${encodeURIComponent(id)}?api_key=${TMDB_API_KEY}&language=es-ES`).then((data) => [...new Set([
        data.name,
        data.title,
        data.original_name,
        data.original_title
      ].filter(Boolean).map(String))]);
    }
    function decodeBase64(value) {
      try {
        const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
        return atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
      } catch (_) {
        return null;
      }
    }
    function scoreTitle(query, candidate) {
      const stripTags = (value) => normalize(value).replace(/\b(latino|castellano|catalan|japones|japanese)\b/g, " ").replace(/\b(?:s|season|temporada|parte|part)\s*\d+\b/g, " ").replace(/\s+/g, " ").trim();
      const q = stripTags(query);
      const c = stripTags(candidate);
      if (!q || !c)
        return 0;
      if (q === c)
        return 100;
      if (c.includes(q) || q.includes(c))
        return 70;
      return q.split(" ").filter((part) => part.length > 2 && c.includes(part)).length;
    }
    function parseSearchResults(html) {
      const results = [];
      const anchorRe = /<a\b([^>]*\/anime\/[^>]*>[\s\S]*?<\/a>)/gi;
      let match;
      while (match = anchorRe.exec(html)) {
        const block = match[1];
        const href = block.match(/href=["']([^"']*\/anime\/[^"']+)["']/i);
        if (!href)
          continue;
        const slug = href[1].match(/\/anime\/([^/?#"']+)/i);
        if (!slug)
          continue;
        const h3 = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
        const title = (h3 ? h3[1] : block.replace(/<[^>]+>/g, " ")).replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
        const label = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const item = {
          title,
          slug: slug[1],
          url: absoluteUrl(href[1], LATANIME),
          type: /pel[ií]cula|\bmovie\b|\bfilm\b/i.test(label) ? "movie" : "series"
        };
        if (item.url && !results.some((entry) => entry.url === item.url))
          results.push(item);
      }
      return results;
    }
    function searchLatanime(query) {
      const url = `${LATANIME}/buscar?q=${encodeURIComponent(query)}`;
      return fetchText(url).then((html) => {
        const results = parseSearchResults(html);
        if (results.length)
          return results;
        return fetchText(`${LATANIME}/?s=${encodeURIComponent(query)}`).then(parseSearchResults);
      });
    }
    function chooseAnime(results, query, mediaType) {
      const candidates = results.filter((item) => !mediaType || mediaType === "movie" || item.type === "series");
      const pool = candidates.length ? candidates : results;
      return pool.slice().sort((a, b) => scoreTitle(query, b.title) - scoreTitle(query, a.title))[0] || null;
    }
    function episodeNumber(href, text) {
      const value = `${href} ${text}`.match(/(?:episodio|capitulo|episode)[^0-9]{0,8}0*(\d+)/i);
      return value ? Number(value[1]) : null;
    }
    function listEpisodes(html) {
      const episodes = [];
      const re = /<a\b([^>]*href=["'][^"']*\/ver\/[^"']+["'][^>]*)>/gi;
      let match;
      while (match = re.exec(html)) {
        const block = match[1];
        const href = block.match(/href=["']([^"']*\/ver\/[^"']+)["']/i);
        if (!href)
          continue;
        const number = episodeNumber(href[1], "");
        if (!number || episodes.some((entry) => entry.number === number))
          continue;
        episodes.push({ number, url: absoluteUrl(href[1], LATANIME) });
      }
      return episodes.sort((a, b) => a.number - b.number);
    }
    function extractPlayers(html) {
      const players = [];
      const re = /<a\b([^>]*class=["'][^"']*play-video[^"'][^>]*data-player=["'][^"']+["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let match;
      while (match = re.exec(html)) {
        const attrs = match[1];
        const encoded = attrs.match(/data-player=["']([^"']+)["']/i);
        if (!encoded)
          continue;
        const embed = decodeBase64(encoded[1]);
        if (!embed || !EMBED_HOSTS.test(embed))
          continue;
        const name = match[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || "Servidor";
        if (!players.some((item) => item.embed === embed))
          players.push({ name, embed });
      }
      return players;
    }
    function normalizeVideoUrl(value) {
      return String(value || "").replace(/\\u0026/g, "&").replace(/\\\//g, "/").replace(/&amp;/g, "&").trim();
    }
    function likelyVideo(value) {
      return /\.(?:mp4|m3u8)(?:[?#].*)?$/i.test(value || "");
    }
    function unpackDeanEdwards(source) {
      const match = String(source || "").match(/eval\(function\(p,a,c,k,e(?:,d)?\)\{[\s\S]*?\}\((['"])([\s\S]*?)\2,(\d+),(\d+),\[(['"])([\s\S]*?)\6\.split\(['"]\|['"]\)(?:,0,\{\})?\)\)/);
      if (!match)
        return null;
      let payload = match[3];
      const radix = Number(match[4]);
      let count = Number(match[5]);
      const words = match[7].split("|");
      const encode = (number) => {
        if (!number)
          return "0";
        let value = "";
        while (number > 0) {
          const digit = number % radix;
          value = String.fromCharCode(digit < 36 ? digit < 10 ? 48 + digit : 87 + digit : 65 + digit - 36) + value;
          number = Math.floor(number / radix);
        }
        return value;
      };
      while (count--) {
        if (words[count])
          payload = payload.replace(new RegExp(`\\b${encode(count)}\\b`, "g"), words[count]);
      }
      return payload;
    }
    function resolvePlayer(player) {
      const embed = player.embed;
      if (/\.mp4(?:[?#]|$)|\.m3u8(?:[?#]|$)/i.test(embed)) {
        return Promise.resolve({ url: embed, name: player.name, referer: LATANIME });
      }
      return fetchText(embed, { Referer: `${LATANIME}/` }).then((html) => {
        let value = html.match(/(?:src|file)\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8)(?:\?[^"']*)?)["']/i);
        if (!value)
          value = html.match(/https?:\/\/[^"'\s]+\.(?:mp4|m3u8)(?:\?[^"'\s]*)?/i);
        if (!value && /uqload/i.test(embed)) {
          const unpacked = unpackDeanEdwards(html);
          if (unpacked)
            value = unpacked.match(/https?:\/\/[^"'\s]+\.(?:mp4|m3u8)(?:\?[^"'\s]*)?/i);
        }
        const url = normalizeVideoUrl(value && (value[1] || value[0]));
        return likelyVideo(url) ? { url, name: player.name, referer: embed } : null;
      });
    }
    function getStreamsFromLatanime2(tmdbId, mediaType, season, episode, suppliedTitle) {
      const wantedEpisode = Number(episode || 1);
      const wantedSeason = Number(season || 1);
      return tmdbTitles(tmdbId, mediaType, suppliedTitle).then((titles) => {
        function tryTitle(index) {
          if (index >= titles.length)
            return Promise.resolve([]);
          const query = wantedSeason > 1 ? `${titles[index]} ${wantedSeason}` : titles[index];
          return searchLatanime(query).then((results) => {
            const anime = chooseAnime(results, query, mediaType);
            if (!anime)
              return tryTitle(index + 1);
            return fetchText(anime.url).then((animeHtml) => {
              const episodes = listEpisodes(animeHtml);
              const selected = episodes.find((item) => item.number === wantedEpisode);
              if (!selected)
                return tryTitle(index + 1);
              return fetchText(selected.url).then((episodeHtml) => Promise.all(
                extractPlayers(episodeHtml).map((player) => resolvePlayer(player).catch(() => null))
              ).then((resolved) => resolved.filter(Boolean).map((player) => ({
                title: `${anime.title} Ep. ${selected.number}`,
                name: `Latanime - ${player.name}`,
                url: player.url,
                quality: /m3u8/i.test(player.url) ? "1080p" : "HD",
                headers: { Referer: player.referer, "User-Agent": BROWSER_HEADERS["User-Agent"] }
              }))));
            });
          }).then((streams) => streams.length ? streams : tryTitle(index + 1)).catch(() => tryTitle(index + 1));
        }
        return tryTitle(0);
      });
    }
    function getStreamsFromAnimeAV12() {
      return Promise.resolve([]);
    }
    function getStreamsFromTodoAnime2() {
      return Promise.resolve([]);
    }
    module2.exports = { getStreamsFromLatanime: getStreamsFromLatanime2, getStreamsFromAnimeAV1: getStreamsFromAnimeAV12, getStreamsFromTodoAnime: getStreamsFromTodoAnime2 };
  }
});

// nuvio-provider/src/mianime/index.js
var {
  getStreamsFromLatanime,
  getStreamsFromAnimeAV1,
  getStreamsFromTodoAnime
} = require_extractors();
function safe(label, fn) {
  return Promise.resolve().then(fn).catch((error) => {
    console.error(`[MiAnime] ${label}: ${error.message}`);
    return [];
  });
}
function getStreams(tmdbId, mediaType, season, episode, suppliedTitle) {
  const jobs = [
    safe("Latanime", () => getStreamsFromLatanime(tmdbId, mediaType, season, episode, suppliedTitle)),
    safe("AnimeAV1", () => getStreamsFromAnimeAV1(tmdbId, mediaType, season, episode, suppliedTitle)),
    safe("TodoAnime", () => getStreamsFromTodoAnime(tmdbId, mediaType, season, episode, suppliedTitle))
  ];
  return Promise.all(jobs).then((results) => {
    const streams = [];
    const seen = {};
    results.forEach((items) => items.forEach((stream) => {
      if (stream && typeof stream.title === "string" && /^https?:\/\//i.test(stream.url || "") && !seen[stream.url]) {
        seen[stream.url] = true;
        streams.push(stream);
      }
    }));
    return streams;
  });
}
module.exports = { getStreams };
