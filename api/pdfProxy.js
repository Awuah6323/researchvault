// api/pdfProxy.js
// ResearchVault Backend PDF Proxy Endpoint (Vercel Serverless Function & Express Route compatible)
// Bypasses browser CORS restrictions, validates binary %PDF- magic bytes, and enforces anti-SSRF protections.

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

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type, Date');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrlStr = req.query?.url || req.url?.split('url=')[1];

  if (!targetUrlStr) {
    return res.status(400).json({ error: 'Missing required parameter: url' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(decodeURIComponent(targetUrlStr));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // SSRF Protection Rule 1: Protocol restriction
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only HTTP/HTTPS protocols allowed' });
  }

  // SSRF Protection Rule 2: Hostname & IP check
  if (isIpPrivate(parsedUrl.hostname)) {
    return res.status(403).json({ error: 'Access to internal network addresses forbidden' });
  }

  const transport = parsedUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const clientReq = transport.get(
      parsedUrl.href,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ResearchVault-PDFResolver/1.0',
          'Accept': 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8'
        },
        timeout: 15000
      },
      (remoteRes) => {
        // Follow redirects up to HTTP 308
        if ([301, 302, 303, 307, 308].includes(remoteRes.statusCode) && remoteRes.headers.location) {
          const redirectUrl = new URL(remoteRes.headers.location, parsedUrl.href);
          if (isIpPrivate(redirectUrl.hostname)) {
            res.status(403).json({ error: 'Redirect to internal address blocked' });
            return resolve();
          }
          return res.redirect(`/api/pdfProxy?url=${encodeURIComponent(redirectUrl.href)}`);
        }

        if (remoteRes.statusCode !== 200) {
          res.status(remoteRes.statusCode).json({ error: `Remote server responded with ${remoteRes.statusCode}` });
          return resolve();
        }

        const chunks = [];
        let totalLength = 0;
        let headerValidated = false;

        remoteRes.on('data', (chunk) => {
          chunks.push(chunk);
          totalLength += chunk.length;

          // Early binary validation check on the first chunk
          if (!headerValidated && totalLength >= 5) {
            const buffer = Buffer.concat(chunks);
            if (!buffer.subarray(0, 5).equals(PDF_MAGIC)) {
              clientReq.destroy();
              res.status(422).json({ error: 'Remote URL returned non-PDF payload' });
              return resolve();
            }
            headerValidated = true;
          }

          // Limit size to 50MB
          if (totalLength > 50 * 1024 * 1024) {
            clientReq.destroy();
            res.status(413).json({ error: 'PDF file size exceeds maximum limit (50MB)' });
            return resolve();
          }
        });

        remoteRes.on('end', () => {
          if (!headerValidated) {
            res.status(422).json({ error: 'Incomplete or non-PDF payload received' });
            return resolve();
          }
          const fullBuffer = Buffer.concat(chunks);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Length', fullBuffer.length);
          res.send(fullBuffer);
          resolve();
        });
      }
    );

    clientReq.on('error', (err) => {
      res.status(502).json({ error: `Proxy request failed: ${err.message}` });
      resolve();
    });

    clientReq.on('timeout', () => {
      clientReq.destroy();
      res.status(540).json({ error: 'Request to remote PDF server timed out' });
      resolve();
    });
  });
};
