import https from 'node:https';
import { beginRequest, fail, clientIp } from './_lib/http.js';
import { enforce, LIMITS } from './_lib/rateLimit.js';
import { getUserFromRequest } from './_lib/auth.js';
import { resolveSafeUrl, isUnsafeUrlError } from './_lib/ssrf.js';

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15000;
const MAX_URL_LENGTH = 2048;

async function fetchPdf(rawUrl, redirectsLeft = MAX_REDIRECTS) {
  if (redirectsLeft <= 0) throw new Error('Too many redirects');

  const { url, address } = await resolveSafeUrl(rawUrl, { allowHttp: false });

  return new Promise((resolve, reject) => {
    const request = https.get(
      url.href,
      {
        headers: {
          'User-Agent': 'ResearchVault/1.0 (+https://github.com/researchvault; academic PDF retrieval)',
          Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8'
        },
        timeout: TIMEOUT_MS,
        lookup: (_hostname, opts, callback) => {
          const family = address.includes(':') ? 6 : 4;
          if (opts?.all) return callback(null, [{ address, family }]);
          return callback(null, address, family);
        }
      },
      (response) => {
        const status = response.statusCode;

        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          const next = new URL(response.headers.location, url.href).href;
          response.destroy();
          request.destroy();
          fetchPdf(next, redirectsLeft - 1).then(resolve, reject);
          return;
        }

        if (status !== 200) {
          response.destroy();
          request.destroy();
          reject(new Error(`Upstream responded ${status}`));
          return;
        }

        const declared = Number(response.headers['content-length'] || 0);
        if (declared > MAX_BYTES) {
          response.destroy();
          request.destroy();
          reject(new Error('PDF exceeds the 50 MB limit'));
          return;
        }

        const chunks = [];
        let total = 0;
        let validated = false;

        response.on('data', (chunk) => {
          chunks.push(chunk);
          total += chunk.length;

          if (!validated && total >= PDF_MAGIC.length) {
            if (!Buffer.concat(chunks).subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
              response.destroy();
              request.destroy();
              reject(new Error('Upstream returned a non-PDF payload'));
              return;
            }
            validated = true;
          }

          if (total > MAX_BYTES) {
            response.destroy();
            request.destroy();
            reject(new Error('PDF exceeds the 50 MB limit'));
          }
        });

        response.on('end', () => {
          if (!validated) return reject(new Error('Incomplete or non-PDF payload'));
          resolve(Buffer.concat(chunks));
        });

        response.on('error', reject);
      }
    );

    request.on('error', (err) => reject(new Error(`Upstream request failed: ${err.message}`)));
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Upstream request timed out'));
    });
  });
}

export default async function handler(req, res) {
  if (!beginRequest(req, res, { methods: ['GET'] })) return;

  const user = await getUserFromRequest(req);
  const identity = user ? `u:${user.id}` : `ip:${clientIp(req)}`;

  if (!(await enforce(req, res, 'pdf', { ...LIMITS.PDF_PER_MINUTE, identity }))) return;

  const target = req.query?.url;

  if (!target || typeof target !== 'string') {
    return fail(res, 400, 'A url query parameter is required');
  }
  if (target.length > MAX_URL_LENGTH) {
    return fail(res, 400, 'The url parameter is too long');
  }

  try {
    const pdf = await fetchPdf(target);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=300');

    return res.status(200).send(pdf);
  } catch (err) {
    if (isUnsafeUrlError(err)) {
      return fail(res, 400, 'That URL cannot be retrieved.', err.message);
    }
    return fail(res, 502, 'Unable to retrieve the document from its source.', err);
  }
}
