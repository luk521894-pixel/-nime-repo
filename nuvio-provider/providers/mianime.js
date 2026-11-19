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
    var ALLOWED_EMBED_HOSTS = /(?:filemoon|dsvplay|mega\.nz|uqload|luluv|mxdrop|listeamed|voe\.sx|mp4upload)/i;
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
        headers: __spreadValues({
          "User-Agent": "Mozilla/5.0 (NuvioProvider/1.1)",
          "Accept": "text/html,application/xhtml+xml"
        }, extraHeaders || {})
      }).then((response) => {
        if (!response.ok)
          throw new Error(`HTTP ${response.status}`);
        return response.text();
      });
    }
    function fetchJson(url) {
      return fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (NuvioProvider/1.1)" } }).then((response) => {
        if (!response.ok)
          throw new Error(`HTTP ${response.status}`);
        return response.json();
      });
    }
    function decodeBase64(value) {
      try {
        return atob(value);
      } catch (_) {
        return null;
      }
    }
    function normalize(value) {
      return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    }
    function titleFromArgument(value) {
      if (!value)
        return "";
      if (typeof value === "string")
        return value;
      if (typeof value === "object")
        return value.title || value.name || value.originalTitle || "";
      return "";
    }
    function resolveTitle(tmdbId, mediaType, suppliedTitle) {
      const direct = titleFromArgument(suppliedTitle);
      if (direct)
        return Promise.resolve(direct);
      const kind = mediaType === "movie" ? "movie" : "tv";
      const cleanId = String(tmdbId || "").replace(/^tmdb:/i, "").split(":")[0];
      return fetchJson(`https://api.themoviedb.org/3/${kind}/${encodeURIComponent(cleanId)}?api_key=${TMDB_API_KEY}&language=es-ES`).then((data) => data.title || data.name || data.original_title || data.original_name || "");
    }
    function findAnimePage(html, title) {
      const wanted = normalize(title);
      const links = [];
      const regex = /<a[^>]+href=["']([^"']*\/anime\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while (match = regex.exec(html)) {
        const text = normalize(match[2].replace(/<[^>]+>/g, " "));
        const url = absoluteUrl(match[1], LATANIME);
        if (!url || links.some((item) => item.url === url))
          continue;
        links.push({ url, text, score: text.includes(wanted) ? 3 : wanted.split(" ").filter((word) => word.length > 2 && text.includes(word)).length });
      }
      links.sort((a, b) => b.score - a.score);
      return links.length && links[0].score > 0 ? links[0].url : null;
    }
    function findEpisodePage(html, episode, season) {
      const wanted = String(Number(episode || 1));
      const seasonText = season ? `s${Number(season)}` : "";
      const regex = /<a[^>]+href=["']([^"']*\/ver\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      const matches = [];
      let match;
      while (match = regex.exec(html)) {
        const text = normalize(match[2].replace(/<[^>]+>/g, " "));
        const href = match[1];
        const slug = normalize(href);
        const hasEpisode = new RegExp(`(?:episodio|capitulo|episode)[ -_]*0*${wanted}(?:[^0-9]|$)`, "i").test(`${text} ${slug}`);
        const hasSeason = !seasonText || Number(season) === 1 || slug.includes(seasonText) || text.includes(seasonText);
        if (hasEpisode && hasSeason)
          matches.push(absoluteUrl(href, LATANIME));
      }
      return matches[0] || null;
    }
    function extractLatanimePlayers(html) {
      const players = [];
      const regex = /<a[^>]+class=["'][^"']*play-video[^"']*["'][^>]+data-player=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while (match = regex.exec(html)) {
        const name = match[2].replace(/<[^>]+>/g, "").trim();
        const embed = decodeBase64(match[1]);
        if (!embed || !ALLOWED_EMBED_HOSTS.test(embed))
          continue;
        if (!players.some((item) => item.embed === embed))
          players.push({ name, embed });
      }
      return players;
    }
    function resolveDirectPlayer(player) {
      const embed = player.embed;
      if (/mp4upload/i.test(embed)) {
        return fetchText(embed, { Referer: `${LATANIME}/` }).then((html) => {
          const match = html.match(/(?:src|file)\s*:\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8)(?:\?[^"']*)?)["']/i);
          if (!match)
            return null;
          return { url: match[1], name: player.name, referer: embed };
        });
      }
      if (/uqload/i.test(embed)) {
        return fetchText(embed, { Referer: `${LATANIME}/` }).then((html) => {
          const match = html.match(/(?:file|src)\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8)(?:\?[^"']*)?)["']/i);
          if (!match)
            return null;
          return { url: match[1], name: player.name, referer: embed };
        });
      }
      return Promise.resolve(null);
    }
    function getStreamsFromLatanime2(tmdbId, mediaType, season, episode, suppliedTitle) {
      return resolveTitle(tmdbId, mediaType, suppliedTitle).then((title) => {
        if (!title)
          return [];
        return fetchText(`${LATANIME}/?s=${encodeURIComponent(title)}`).then((searchHtml) => {
          const animeUrl = findAnimePage(searchHtml, title);
          if (!animeUrl)
            return [];
          return fetchText(animeUrl).then((animeHtml) => {
            const episodeUrl = findEpisodePage(animeHtml, episode, season);
            if (!episodeUrl)
              return [];
            return fetchText(episodeUrl).then((episodeHtml) => Promise.all(
              extractLatanimePlayers(episodeHtml).map((player) => resolveDirectPlayer(player))
            ).then((resolved) => resolved.filter(Boolean).map((player) => ({
              name: `Latanime - ${player.name}`,
              title: episode ? `Episodio ${episode}` : title,
              url: player.url,
              quality: /m3u8/i.test(player.url) ? "1080p" : "HD",
              headers: { Referer: player.referer, "User-Agent": "Mozilla/5.0" }
            }))));
          });
        });
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
      if (stream && stream.url && !seen[stream.url]) {
        seen[stream.url] = true;
        streams.push(stream);
      }
    }));
    return streams;
  });
}
module.exports = { getStreams };
