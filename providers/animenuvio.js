/*
 * AnimeAV provider for Nuvio
 * Flow: Nuvio TMDB ID -> TMDB external_ids (IMDb) -> AnimeAV1 Resolver API
 *       -> AnimeAV1 episode __data.json -> HLS-Zilla / Voe
 *
 * Runtime: Nuvio-provided fetch. No npm dependencies.
 */

var PROVIDER_NAME = 'AnimeAV';
var TMDB_API_KEY = 'YOUR_TMDB_API_KEY';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var RESOLVER_BASE = 'https://5ckvjqa72l.apps.bot-hosting.cloud';
var ANIMEAV1_BASE = 'https://animeav1.com';

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var TMDB_CACHE_TTL_MS = 10 * 60 * 1000;
var tmdbCache = Object.create(null);

function log(message) {
  console.log('[AnimeNuvio] ' + message);
}

function safeUrl(value) {
  try {
    var match = String(value || '').match(/^(https?:\/\/[^/]+)(\/[^?#]*)?/i);
    return match ? match[1] + (match[2] || '') : String(value || '');
  } catch (_) {
    return String(value || '');
  }
}

function requestText(url, headers) {
  return fetch(url, {
    method: 'GET',
    headers: Object.assign({
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
    }, headers || {})
  }).then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' en ' + safeUrl(url));
    return response.text();
  });
}

function requestJson(url, headers) {
  return fetch(url, {
    method: 'GET',
    headers: Object.assign({
      'User-Agent': UA,
      'Accept': 'application/json'
    }, headers || {})
  }).then(function (response) {
    return response.text().then(function (body) {
      var data;
      try { data = JSON.parse(body); } catch (_) { data = {}; }
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + (data.status_message ? ': ' + data.status_message : ''));
      }
      return data;
    });
  });
}

/* Nuvio supplies TMDB IDs. The existing resolver API expects IMDb IDs. */
function getImdbId(tmdbId, mediaType) {
  var type = mediaType === 'movie' ? 'movie' : 'tv';
  var key = type + ':' + String(tmdbId);
  var now = Date.now();
  var cached = tmdbCache[key];

  if (cached && cached.expiresAt > now) return cached.promise;
  if (cached) delete tmdbCache[key];

  var entry = { expiresAt: now + TMDB_CACHE_TTL_MS, promise: null };
  entry.promise = requestJson(
    TMDB_BASE + '/' + type + '/' + encodeURIComponent(String(tmdbId)) +
    '/external_ids?api_key=' + encodeURIComponent(TMDB_API_KEY)
  ).then(function (data) {
    var imdbId = data && data.imdb_id;
    if (!imdbId || !/^tt\d{5,12}$/i.test(imdbId)) {
      throw new Error('TMDB no devolvió un IMDb ID válido para ' + type + ' ' + tmdbId);
    }
    return imdbId;
  }).catch(function (error) {
    if (tmdbCache[key] === entry) delete tmdbCache[key];
    throw error;
  });

  tmdbCache[key] = entry;
  return entry.promise;
}

function resolveAnime(imdbId, mediaType, season) {
  var params = [
    'imdb=' + encodeURIComponent(imdbId),
    'type=' + encodeURIComponent(mediaType)
  ];
  if (mediaType === 'tv') params.push('season=' + encodeURIComponent(String(season)));
  var url = RESOLVER_BASE + '/resolve?' + params.join('&');

  log('Resolver: ' + safeUrl(url));
  return requestJson(url).then(function (data) {
    if (!data || data.ok !== true || !data.result || !data.result.slug) {
      throw new Error((data && data.error) || 'El resolver no encontró AnimeAV1');
    }
    log('Match: ' + (data.result.animeav1Title || data.result.title || data.result.slug) +
      ' | score=' + (data.result.score == null ? '?' : data.result.score));
    return data.result;
  });
}

function resolveField(value, dataArray) {
  if (typeof value === 'number' && dataArray[value] !== undefined) {
    var resolved = dataArray[value];
    return typeof resolved === 'string' ? resolved : null;
  }
  return typeof value === 'string' ? value : null;
}

function resolveServer(entry, dataArray) {
  if (typeof entry === 'number') entry = dataArray[entry];
  if (!entry || typeof entry !== 'object') return null;

  var name = resolveField(entry.server, dataArray);
  var url = resolveField(entry.url, dataArray);
  if (!name || !url || !/^https?:\/\//i.test(url)) return null;

  return { name: name, url: url };
}

function isSupportedSource(name) {
  var value = String(name || '').toLowerCase();
  return value === 'hls' ||
    value.indexOf('voe') !== -1 ||
    value.indexOf('playerzilla') !== -1 ||
    value.indexOf('player zilla') !== -1 ||
    value.indexOf('hls-zilla') !== -1 ||
    value.indexOf('hls zilla') !== -1;
}

/* Reads AnimeAV1's SvelteKit data payload and returns only SUB/DUB Voe and Zilla. */
function getEpisodeServers(slug, episode) {
  var pageUrl = ANIMEAV1_BASE + '/media/' + encodeURIComponent(slug) + '/' + encodeURIComponent(String(episode));
  var jsonUrl = pageUrl + '/__data.json';

  log('Episodio: ' + safeUrl(pageUrl));
  return requestJson(jsonUrl, { 'Referer': ANIMEAV1_BASE + '/' }).then(function (root) {
    var nodes = root && root.nodes;
    if (!Array.isArray(nodes)) throw new Error('AnimeAV1 no devolvió nodes en __data.json');

    var dataArray = null;
    for (var i = 0; i < nodes.length; i++) {
      var nodeData = nodes[i] && nodes[i].data;
      if (Array.isArray(nodeData) && nodeData.some(function (item) {
        return item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'embeds');
      })) {
        dataArray = nodeData;
        break;
      }
    }
    if (!dataArray) throw new Error('No se encontró el bloque embeds de AnimeAV1');

    var episodeObject = dataArray.find(function (item) {
      return item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'embeds');
    });
    var embeds = episodeObject && dataArray[episodeObject.embeds];
    if (!embeds || typeof embeds !== 'object') throw new Error('No se encontró el objeto embeds');

    var servers = [];
    function collect(listOrIndex, dub) {
      var list = typeof listOrIndex === 'number' ? dataArray[listOrIndex] : listOrIndex;
      if (!Array.isArray(list)) return;

      list.forEach(function (entry) {
        var server = resolveServer(entry, dataArray);
        if (!server || !isSupportedSource(server.name)) return;
        servers.push({ name: server.name, url: server.url, dub: !!dub });
      });
    }

    collect(embeds.SUB !== undefined ? embeds.SUB : embeds.sub, false);
    collect(embeds.DUB !== undefined ? embeds.DUB : embeds.dub, true);

    /* Some AnimeAV1 entries expose playable sources under downloads as well. */
    if (episodeObject.downloads !== undefined) {
      var downloads = dataArray[episodeObject.downloads];
      if (downloads && typeof downloads === 'object') {
        collect(downloads.SUB !== undefined ? downloads.SUB : downloads.sub, false);
        collect(downloads.DUB !== undefined ? downloads.DUB : downloads.dub, true);
      }
    }

    var seen = Object.create(null);
    servers = servers.filter(function (server) {
      var key = server.name + '|' + server.url + '|' + server.dub;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    /* Main source first (HLS-Zilla), then Voe; SUB before DUB within each source. */
    servers.sort(function (a, b) {
      var aVoe = /voe/i.test(a.name) ? 1 : 0;
      var bVoe = /voe/i.test(b.name) ? 1 : 0;
      if (aVoe !== bVoe) return aVoe - bVoe;
      return (a.dub ? 1 : 0) - (b.dub ? 1 : 0);
    });

    log('Fuentes compatibles: ' + servers.length + ' (HLS-Zilla/Voe)');
    log('Distribución: SUB=' + servers.filter(function (s) { return !s.dub; }).length +
      ' | DUB=' + servers.filter(function (s) { return s.dub; }).length);
    return servers;
  });
}

function extractPlayerZilla(playUrl) {
  var directUrl = String(playUrl || '').replace('/play/', '/m3u8/');
  if (directUrl === playUrl || !/^https?:\/\/player\.zilla-networks\.com\//i.test(directUrl)) {
    throw new Error('URL PlayerZilla no reconocida');
  }
  return Promise.resolve({
    url: directUrl,
    headers: {
      'Referer': 'https://player.zilla-networks.com/',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'User-Agent': UA
    },
    type: 'hls'
  });
}

var VOE_MARKERS = ['@$', '^^', '~@', '%?', '*~', '!!', '#&'];

/* ROT13, marker replacement, base64, byte shift, reverse, base64 JSON. */
function decodeVoePayload(rawValue) {
  var value = String(rawValue || '').replace(/[a-zA-Z]/g, function (char) {
    var code = char.charCodeAt(0);
    var base = code <= 90 ? 65 : 97;
    return String.fromCharCode((code - base + 13) % 26 + base);
  });
  VOE_MARKERS.forEach(function (marker) {
    value = value.split(marker).join('_');
  });
  value = value.split('_').join('');
  value = atob(value);
  value = Array.from(value).map(function (char) {
    return String.fromCharCode((char.charCodeAt(0) - 3 + 256) % 256);
  }).join('');
  value = value.split('').reverse().join('');
  return JSON.parse(atob(value));
}

function extractVoe(embedUrl) {
  /* Keep the original AnimeAV1 Voe request headers unchanged: UA only. */
  return fetch(embedUrl, { headers: { 'User-Agent': UA } }).then(function (response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' en Voe');
    return response.text();
  }).then(function (html) {
    var redirect = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
    if (!redirect) return html;
    log('Voe redirección JS detectada');
    /* The original extractor also sends only User-Agent on the JS redirect. */
    return fetch(redirect[1], { headers: { 'User-Agent': UA } }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' en redirección Voe');
      return response.text();
    });
  }).then(function (html) {
    var script = html.match(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!script) throw new Error('Voe: no se encontró application/json');

    var jsonText = script[1].trim()
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"').replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    var payload;
    try { payload = JSON.parse(jsonText); }
    catch (_) { throw new Error('Voe: JSON del embed inválido'); }
    if (!Array.isArray(payload) || !payload[0]) throw new Error('Voe: payload vacío');

    var decoded = decodeVoePayload(payload[0]);
    if (!decoded || !decoded.source || !/^https?:\/\//i.test(decoded.source)) {
      throw new Error('Voe: el payload no contiene source HLS');
    }

    var origin;
    try { origin = new URL(embedUrl).origin; } catch (_) { origin = null; }
    /* Exact HLS headers from the original working AnimeAV1 extractor. */
    return {
      url: decoded.source,
      headers: {
        'Referer': origin ? origin + '/' : embedUrl,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'User-Agent': UA
      },
      type: 'hls'
    };
  });
}

function languageLabel(dub) {
  return dub ? '🇲🇽 LATINO' : '🇯🇵 JAPONÉS · SUB';
}

function makeStream(source, resolved, mediaType) {
  var provider = /voe/i.test(source.name) ? 'Voe' : 'PlayerZilla';
  var quality = provider === 'Voe' ? '720p' : '1080p';
  return {
    name: PROVIDER_NAME,
    title: '',
    url: resolved.url,
    quality: '\n' + quality + ' | WEB-DL | ' +
      (mediaType === 'tv' ? 'Serie' : 'Película') + '\n' + languageLabel(source.dub),
    headers: resolved.headers || {},
    type: 'hls'
  };
}

function extractSource(source) {
  return /voe/i.test(source.name)
    ? extractVoe(source.url)
    : extractPlayerZilla(source.url);
}

function resolveEpisode(slug, episode, mediaType) {
  return getEpisodeServers(slug, episode).then(function (servers) {
    if (!servers.length) return [];

    return Promise.all(servers.map(function (source) {
      return extractSource(source).then(function (resolved) {
        return makeStream(source, resolved, mediaType);
      }).catch(function (error) {
        log(source.name + ' falló: ' + error.message);
        return null;
      });
    })).then(function (streams) {
      var seen = Object.create(null);
      return streams.filter(function (stream) {
        if (!stream || !stream.url || seen[stream.url]) return false;
        seen[stream.url] = true;
        return true;
      });
    });
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  var type = String(mediaType || '').toLowerCase();
  if (!tmdbId || (type !== 'movie' && type !== 'tv')) return Promise.resolve([]);

  var seasonNumber = type === 'tv' ? Number(season) : 1;
  var episodeNumber = type === 'tv' ? Number(episode) : 1;

  if (type === 'tv' && (!Number.isInteger(seasonNumber) || seasonNumber < 0 ||
      !Number.isInteger(episodeNumber) || episodeNumber < 1)) {
    log('Temporada o episodio inválido; se omiten las consultas.');
    return Promise.resolve([]);
  }
  if (!TMDB_API_KEY || TMDB_API_KEY === 'PON_AQUI_TU_TMDB_API_KEY_V3') {
    log('Configura TMDB_API_KEY con tu API Key v3.');
    return Promise.resolve([]);
  }

  log('Solicitud Nuvio: TMDB ' + type + ' ' + tmdbId +
    (type === 'tv' ? ' S' + seasonNumber + 'E' + episodeNumber : ''));

  return getImdbId(tmdbId, type).then(function (imdbId) {
    log('IMDb: ' + imdbId);
    return resolveAnime(imdbId, type, seasonNumber);
  }).then(function (resolved) {
    var targetEpisode = type === 'movie' ? 1 : episodeNumber;
    return resolveEpisode(resolved.slug, targetEpisode, type).then(function (streams) {
      if (streams.length || type !== 'movie') return streams;
      log('Película sin fuentes en episodio 1; probando episodio 0.');
      return resolveEpisode(resolved.slug, 0, type);
    });
  }).then(function (streams) {
    log('Streams HLS devueltos: ' + streams.length);
    return streams;
  }).catch(function (error) {
    console.error('[AnimeNuvio] ' + (error && error.message ? error.message : String(error)));
    return [];
  });
}

module.exports = { getStreams: getStreams };
