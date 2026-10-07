const https = require('https');
const zlib = require('zlib');

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15000;

function normalize(input) {
  input = String(input || '').trim();
  if (!input) return '';

  try {
    const url = new URL(
      /^https?:\/\//i.test(input)
        ? input
        : 'https://www.facebook.com/' + input.replace(/^@/, '')
    );

    if (url.hostname && !/(^|\.)facebook\.com$/i.test(url.hostname)) {
      return '';
    }

    if (url.pathname === '/profile.php' && url.searchParams.get('id')) {
      return url.searchParams.get('id');
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length) return '';

    if (['people', 'pages', 'groups'].includes(parts[0]) && parts[1]) {
      return parts[1].replace(/^@/, '');
    }

    return parts[0].replace(/^@/, '');
  } catch (_) {
    return input
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.|m\.)?facebook\.com\//i, '')
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

function getHeaderId(html, name) {
  const patterns = [
    new RegExp(`(?:["']${name}["']|${name})\\s*[:=]\\s*["']?(\\d{5,})`, 'i'),
    new RegExp(`\\b${name}\\b[^\\d]{0,80}(\\d{5,})`, 'i')
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return match[1];
  }
  return '';
}

function extractId(html) {
  const patterns = [
    /fb:\/\/(?:profile|page|group|user)\/(\d+)/i,
    /"entity_id"\s*:\s*"?(\d{5,})/i,
    /"profile_id"\s*:\s*"?(\d{5,})/i,
    /"profileID"\s*:\s*"?(\d{5,})/i,
    /"userID"\s*:\s*"?(\d{5,})/i,
    /"user_id"\s*:\s*"?(\d{5,})/i,
    /"page_id"\s*:\s*"?(\d{5,})/i,
    /"pageID"\s*:\s*"?(\d{5,})/i,
    /"group_id"\s*:\s*"?(\d{5,})/i,
    /"groupID"\s*:\s*"?(\d{5,})/i,
    /"owner_id"\s*:\s*"?(\d{5,})/i,
    /"actor_id"\s*:\s*"?(\d{5,})/i,
    /profile_id[^\d]{0,80}(\d{5,})/i,
    /user(?:_|)id[^\d]{0,80}(\d{5,})/i,
    /page(?:_|)id[^\d]{0,80}(\d{5,})/i,
    /group(?:_|)id[^\d]{0,80}(\d{5,})/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  const appLinks = [
    getMeta(html, 'al:android:url'),
    getMeta(html, 'al:ios:url'),
    getMeta(html, 'al:web:url')
  ];

  for (const value of appLinks) {
    const match = value.match(/(?:profile|page|group|user)[/:](\d{5,})/i) || value.match(/\/(\d{5,})(?:$|[/?])/);
    if (match) return match[1];
  }

  return '';
}

function decodeBody(buffer, encoding) {
  if (!encoding) return buffer.toString('utf8');

  try {
    if (encoding.includes('br')) return zlib.brotliDecompressSync(buffer).toString('utf8');
    if (encoding.includes('gzip')) return zlib.gunzipSync(buffer).toString('utf8');
    if (encoding.includes('deflate')) return zlib.inflateSync(buffer).toString('utf8');
  } catch (_) {
    // Fall back to plain UTF-8 below. Some proxies send a wrong encoding header.
  }

  return buffer.toString('utf8');
}

function fetchPage(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.facebook.com/'
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
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          status: response.statusCode || 0,
          body: decodeBody(buffer, response.headers['content-encoding'] || ''),
          url,
          contentType: response.headers['content-type'] || ''
        });
      });
    });

    request.setTimeout(TIMEOUT_MS, () => {
      request.destroy(new Error('Timeout saat mengakses Facebook.'));
    });
    request.on('error', reject);
  });
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
  if (req.method && req.method !== 'GET') {
    return send(res, 405, { success: false, error: 'Method tidak didukung. Gunakan GET.' });
  }

  const input = req.query && req.query.input;
  if (!input) {
    return send(res, 400, { success: false, error: 'Parameter input wajib diisi.' });
  }

  const username = normalize(input);
  if (!username) {
    return send(res, 400, { success: false, error: 'URL/username Facebook tidak valid.' });
  }

  if (/^\d+$/.test(username)) {
    return send(res, 200, {
      success: true,
      data: { username: '', fbid: username, title: '', type: 'user' }
    });
  }

  try {
    const target = `https://www.facebook.com/${encodeURIComponent(username)}/`;
    const page = await fetchPage(target);

    if (page.status === 404) {
      return send(res, 404, { success: false, error: 'Profil Facebook tidak ditemukan (HTTP 404).' });
    }

    if (page.status === 403 || page.status === 429) {
      return send(res, 502, {
        success: false,
        error: `Facebook menolak request otomatis (HTTP ${page.status}). Coba lagi nanti atau gunakan URL profil publik yang dapat diakses tanpa login.`
      });
    }

    if (page.status < 200 || page.status >= 400) {
      return send(res, 502, { success: false, error: `Facebook mengembalikan HTTP ${page.status}.` });
    }

    const fbid = extractId(page.body);
    const title = getMeta(page.body, 'og:title') || getMeta(page.body, 'twitter:title') || username;
    const image = getMeta(page.body, 'og:image') || '';

    if (!fbid) {
      const loginPage = /login|log in|checkpoint|security check|temporarily blocked/i.test(page.body);
      return send(res, 404, {
        success: false,
        error: loginPage
          ? 'Facebook mengarahkan request ke login/checkpoint, sehingga ID numerik tidak dapat dibaca tanpa autentikasi.'
          : 'Profil dapat diakses, tetapi ID numerik tidak ditemukan pada metadata publik yang dikirim Facebook. Facebook mungkin membatasi akses otomatis untuk profil ini.'
      });
    }

    return send(res, 200, {
      success: true,
      data: {
        username,
        fbid,
        title: title.replace(/\s*[|•-]\s*Facebook$/i, ''),
        type: 'user',
        avatar: image
      }
    });
  } catch (error) {
    console.error('Facebook lookup error:', error);
    return send(res, 502, {
      success: false,
      error: error instanceof Error
        ? `Server gagal mengakses Facebook: ${error.message}`
        : `Server gagal mengakses Facebook: ${JSON.stringify(error)}`
    });
  }
};
