const {
  getStreamsFromLatanime,
  getStreamsFromAnimeAV1,
  getStreamsFromTodoAnime
} = require('./extractors.js');

function safe(label, fn) {
  return Promise.resolve().then(fn).catch((error) => {
    console.error(`[MiAnime] ${label}: ${error.message}`);
    return [];
  });
}

function getStreams(tmdbId, mediaType, season, episode, suppliedTitle) {
  const jobs = [
    safe('Latanime', () => getStreamsFromLatanime(tmdbId, mediaType, season, episode, suppliedTitle)),
    safe('AnimeAV1', () => getStreamsFromAnimeAV1(tmdbId, mediaType, season, episode, suppliedTitle)),
    safe('TodoAnime', () => getStreamsFromTodoAnime(tmdbId, mediaType, season, episode, suppliedTitle))
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
