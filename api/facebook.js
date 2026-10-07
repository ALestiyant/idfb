const https = require('https');
const zlib = require('zlib');

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15000;
const HOSTS = ['www.facebook.com', 'm.facebook.com', 'mbasic.facebook.com'];

function normalize(input) {
  input = String(input || '').trim();
  if (!input) return '';

  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : 'https://www.facebook.com/' + input.replace(/^@/, ''));
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '').replace(/^mbasic\./, '');
    if (host !== 'facebook.com') return '';

    if (url.pathname.toLowerCase() === '/profile.php' && url.searchParams.get('id')) {
      return url.searchParams.get('id').trim();
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length) return '';

    if (['people', 'pages', 'groups'].includes(parts[0].toLowerCase()) && parts[1]) {
      // Legacy /people/Name/123 and /groups/123 forms may already contain an ID.
      if (/^\d+$/.test(parts[2] || '')) return parts[2];
      if (parts[0].toLowerCase() === 'groups' && /^\d+$/.test(parts[1])) return parts[1];
      return parts[1].replace(/^@/, '');
    }

    return parts[0].replace(/^@/, '');
  } catch (_) {
    return input
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.|m\.|mbasic\.)?facebook\.com\//i, '')
      .replace(/^@/, '')
      .split('/')[0]
      .split('?')[0]
      .trim();
  }
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\\\//g, '/');
}

function getMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i')
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return decodeHtml(match[1]);
  }
  return '';
}

function extractId(html) {
  const patterns = [
    /fb:\/\/(?:profile|page|group|user)\/(\d+)/i,
    /["'](?:entity_id|profile_id|profileID|userID|user_id|page_id|pageID|group_id|groupID|owner_id|actor_id)["']\s*[:=]\s*["']?(\d{5,})/i,
    /(?:profile_id|profileID|user_id|userID|page_id|pageID|group_id|groupID)[^\d]{0,100}(\d{5,})/i,
    /(?:"|')id(?:"|')\s*:\s*"(\d{10,})"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  const links = [getMeta(html, 'al:android:url'), getMeta(html, 'al:ios:url'), getMeta(html, 'al:web:url')];
  for (const value of links) {
    const match = value.match(/(?:profile|page|group|user)[/:](\d{5,})/i) || value.match(/\/(\d{5,})(?:$|[/?])/);
    if (match) return match[1];
  }

  return '';
}

function decodeBody(buffer, encoding) {
  try {
    if (encoding && encoding.includes('br')) return zlib.brotliDecompressSync(buffer).toString('utf8');
    if (encoding && encoding.includes('gzip')) return zlib.gunzipSync(buffer).toString('utf8');
    if (encoding && encoding.includes('deflate')) return zlib.inflateSync(buffer).toString('utf8');
  } catch (_) {}
  return buffer.toString('utf8');
}

function fetchPage(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (redirects >= MAX_REDIRECTS) {
          response.resume();
          return reject(new Error('Terlalu banyak redirect dari Facebook.'));
        }
        const nextUrl = new URL(response.headers.location, url).toString();
        response.resume();
        return resolve(fetchPage(nextUrl, redirects + 1));
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: decodeBody(Buffer.concat(chunks), response.headers['content-encoding'] || ''),
        url,
        contentType: response.headers['content-type'] || ''
      }));
    });

    request.setTimeout(TIMEOUT_MS, () => request.destroy(new Error('Timeout saat mengakses Facebook.')));
    request.on('error', reject);
  });
}

async function tryFacebook(username) {
  const results = [];
  for (const host of HOSTS) {
    const target = `https://${host}/${encodeURIComponent(username)}/`;
    try {
      const page = await fetchPage(target);
      results.push({ host, page });

      // Do not stop on 400/403/429: Facebook can serve different responses on
      // www/m/mbasic. A later public endpoint may still expose the metadata.
      if (page.status >= 200 && page.status < 300) {
        const fbid = extractId(page.body);
        if (fbid) return { page, fbid, results };
      }
    } catch (error) {
      results.push({ host, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { page: null, fbid: '', results };
}

function send(res, status, payload) {
  return res.status(status).json(payload);
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method && req.method !== 'GET') return send(res, 405, { success: false, error: 'Method tidak didukung. Gunakan GET.' });

  const input = req.query && req.query.input;
  if (!input) return send(res, 400, { success: false, error: 'Parameter input wajib diisi.' });

  const username = normalize(input);
  if (!username) return send(res, 400, { success: false, error: 'URL/username Facebook tidak valid.' });

  // If the numeric ID is already present, no Facebook request is needed.
  if (/^\d+$/.test(username)) {
    return send(res, 200, { success: true, data: { username: '', fbid: username, title: '', type: 'user', source: 'url' } });
  }

  try {
    const result = await tryFacebook(username);

    if (result.fbid && result.page) {
      const title = getMeta(result.page.body, 'og:title') || getMeta(result.page.body, 'twitter:title') || username;
      const image = getMeta(result.page.body, 'og:image') || '';
      return send(res, 200, {
        success: true,
        data: {
          username,
          fbid: result.fbid,
          title: title.replace(/\s*[|•-]\s*Facebook$/i, ''),
          type: 'user',
          avatar: image,
          source: new URL(result.page.url).hostname
        }
      });
    }

    const statuses = result.results.map(x => x.page ? `${x.host}:${x.page.status}` : `${x.host}:network-error`).join(', ');
    const bodies = result.results.filter(x => x.page).map(x => x.page.body).join('\n');
    const blocked = /login|log in|checkpoint|security check|temporarily blocked|you must log in/i.test(bodies);

    return send(res, 404, {
      success: false,
      error: blocked
        ? 'Facebook mengarahkan request otomatis ke login/checkpoint. ID numerik tidak dapat dibaca tanpa autentikasi.'
        : `Facebook tidak memberikan ID numerik dari endpoint publik yang dicoba (${statuses}). Username-only lookup memang tidak selalu dapat dilakukan tanpa akses resmi/login.`
    });
  } catch (error) {
    console.error('Facebook lookup error:', error);
    return send(res, 502, {
      success: false,
      error: error instanceof Error ? `Server gagal mengakses Facebook: ${error.message}` : `Server gagal mengakses Facebook: ${String(error)}`
    });
  }
};
