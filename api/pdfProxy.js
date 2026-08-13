// api/pdfProxy.js
// ResearchVault Backend PDF Proxy Endpoint (Vercel Serverless Function)
// Bypasses browser CORS restrictions, follows HTTP redirects server-side, validates binary %PDF- magic bytes, and enforces anti-SSRF protections.

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

function isIpPrivate(ip) {
  if (!ip) return false;
  return (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('0.') ||
    ip === '::1' ||
    ip === 'localhost' ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.')
  );
}

function fetchPdfWithRedirects(targetUrlStr, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrlStr);
    } catch (e) {
      return reject(new Error('Invalid URL format'));
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return reject(new Error('Only HTTP/HTTPS allowed'));
    }

    if (isIpPrivate(parsedUrl.hostname)) {
      return reject(new Error('Access to internal network addresses forbidden'));
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const req = transport.get(
      parsedUrl.href,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 15000
      },
      (res) => {
        // Handle HTTP redirects (301, 302, 303, 307, 308) server-side internally!
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, parsedUrl.href).href;
          req.destroy();
          return fetchPdfWithRedirects(redirectUrl, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
        }

        if (res.statusCode !== 200) {
          req.destroy();
          return reject(new Error(`Remote server responded with HTTP ${res.statusCode}`));
        }

        const chunks = [];
        let totalLength = 0;
        let headerValidated = false;

        res.on('data', (chunk) => {
          chunks.push(chunk);
          totalLength += chunk.length;

          if (!headerValidated && totalLength >= 5) {
            const buffer = Buffer.concat(chunks);
            if (!buffer.subarray(0, 5).equals(PDF_MAGIC)) {
              req.destroy();
              return reject(new Error('Remote URL returned non-PDF payload'));
            }
            headerValidated = true;
          }

          if (totalLength > 50 * 1024 * 1024) {
            req.destroy();
            return reject(new Error('PDF size exceeds limit (50MB)'));
          }
        });

        res.on('end', () => {
          if (!headerValidated) {
            return reject(new Error('Incomplete or non-PDF payload received'));
          }
          const fullBuffer = Buffer.concat(chunks);
          resolve({ buffer: fullBuffer, contentType: res.headers['content-type'] || 'application/pdf' });
        });
      }
    );

    req.on('error', (err) => reject(new Error(`Proxy request failed: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request to remote PDF server timed out'));
    });
  });
}

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type, Date');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrlStr = req.query?.url || (req.url && req.url.includes('url=') ? req.url.split('url=')[1] : null);

  if (!targetUrlStr) {
    return res.status(400).json({ error: 'Missing required parameter: url' });
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrlStr);
    const { buffer } = await fetchPdfWithRedirects(decodedUrl);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (err) {
    console.warn('[pdfProxy Error]:', err.message);
    return res.status(502).json({ error: err.message });
  }
};
