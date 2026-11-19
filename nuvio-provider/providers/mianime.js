/** mianime - Nuvio provider */
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// nuvio-provider/src/mianime/extractors.js
var require_extractors = __commonJS({
  "nuvio-provider/src/mianime/extractors.js"(exports2, module2) {
    var SOURCES = [
      { name: "Latanime", base: "https://latanime.org" },
      { name: "AnimeAV1", base: "https://animeav1.com" },
      { name: "TodoAnime", base: "https://todoanime.org" }
    ];
    function absoluteUrl(value, base) {
      if (!value)
        return null;
      try {
        return new URL(value, base).toString();
      } catch (_) {
        return value;
      }
    }
    function firstLink(html, base) {
      const patterns = [
        /<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*(?:episodio|episode)[^<]*<\/a>/i,
        /<a[^>]+href=["']([^"']+)["']/i
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match)
          return absoluteUrl(match[1], base);
      }
      return null;
    }
    function extractVideoUrls(html, base) {
      const urls = [];
      const patterns = [
        /<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/gi,
        /data-(?:url|src|video)=["']([^"']+)["']/gi,
        /["'](https?:\/\/[^"']+\.(?:m3u8|mp4|mkv)(?:\?[^"']*)?)["']/gi
      ];
      patterns.forEach((pattern) => {
        let match;
        while (match = pattern.exec(html)) {
          const url = absoluteUrl(match[1], base);
          if (url && !/ads|banner|comment|disqus/i.test(url) && urls.indexOf(url) === -1)
            urls.push(url);
        }
      });
      return urls;
    }
    function fetchText(url) {
      return fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 NuvioProvider/1.0",
          "Accept": "text/html,application/xhtml+xml"
        }
      }).then((response) => {
        if (!response.ok)
          throw new Error(`HTTP ${response.status}`);
        return response.text();
      });
    }
    function extractFromSource(source, tmdbId, episode) {
      const query = encodeURIComponent(String(tmdbId || ""));
      const searchUrl = `${source.base}/?s=${query}`;
      return fetchText(searchUrl).then((searchHtml) => {
        const pageUrl = firstLink(searchHtml, source.base);
        if (!pageUrl)
          return [];
        return fetchText(pageUrl).then((pageHtml) => {
          const episodeUrl = episode ? firstLink(pageHtml, source.base) : pageUrl;
          if (!episodeUrl)
            return [];
          return fetchText(episodeUrl).then((episodeHtml) => extractVideoUrls(episodeHtml, source.base).map((url, index) => ({
            name: `${source.name} - Servidor ${index + 1}`,
            title: episode ? `Episodio ${episode}` : "Stream",
            url,
            quality: /m3u8|1080/i.test(url) ? "1080p" : "HD",
            headers: { Referer: source.base + "/" }
          })));
        });
      });
    }
    function getStreamsFromLatanime2(tmdbId, mediaType, season, episode) {
      return extractFromSource(SOURCES[0], tmdbId, episode);
    }
    function getStreamsFromAnimeAV12(tmdbId, mediaType, season, episode) {
      return extractFromSource(SOURCES[1], tmdbId, episode);
    }
    function getStreamsFromTodoAnime2(tmdbId, mediaType, season, episode) {
      return extractFromSource(SOURCES[2], tmdbId, episode);
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
function getStreams(tmdbId, mediaType, season, episode) {
  const jobs = [
    safe("Latanime", () => getStreamsFromLatanime(tmdbId, mediaType, season, episode)),
    safe("AnimeAV1", () => getStreamsFromAnimeAV1(tmdbId, mediaType, season, episode)),
    safe("TodoAnime", () => getStreamsFromTodoAnime(tmdbId, mediaType, season, episode))
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
