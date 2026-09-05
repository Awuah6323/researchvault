// api/_lib/ssrf.js
// URL validation for server-side fetching.
//
// The threat: /api/pdfProxy fetches a URL chosen by the caller, from inside the
// hosting provider's network. Without checks that makes it a proxy for probing
// anything the function can reach — the cloud metadata service, internal
// addresses, other tenants.
//
// A hostname string blocklist does not stop this, because the string is not
// what gets connected to. All of the following defeat one:
//
//   http://localtest.me/           a public name resolving to 127.0.0.1
//   http://2130706433/             127.0.0.1 as a decimal integer
//   http://0x7f.1/                 hex octets
//   http://[::ffff:169.254.169.254]/   IPv4-mapped IPv6
//   http://attacker.com/           DNS the attacker controls, answering 169.254.169.254
//
// So the check here is: resolve the name to addresses first, then decide about
// every address, then connect to the address that was actually approved. And
// because a redirect is a second request to a second host, every hop repeats
// the whole check.

import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Is this IP one we must never connect to?
 *
 * Covers loopback, RFC1918 private space, link-local (which is where the cloud
 * metadata endpoint 169.254.169.254 lives), carrier-grade NAT, and the IPv6
 * equivalents including the IPv4-mapped form that would otherwise sneak an IPv4
 * address past an IPv6 check.
 */
export function isBlockedAddress(ip) {
  if (!ip) return true;

  const version = net.isIP(ip);
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return true; // not an IP literal at all
}

function isBlockedIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||                                  // 0.0.0.0/8 "this network"
    a === 10 ||                                 // private
    a === 127 ||                                // loopback
    (a === 100 && b >= 64 && b <= 127) ||       // 100.64/10 carrier-grade NAT
    (a === 169 && b === 254) ||                 // link-local — cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||        // private
    (a === 192 && b === 0) ||                   // 192.0.0/24 protocol assignments
    (a === 192 && b === 168) ||                 // private
    (a === 198 && (b === 18 || b === 19)) ||    // benchmarking
    a >= 224                                    // multicast, reserved, broadcast
  );
}

/**
 * Expands any IPv6 form into its eight 16-bit words.
 *
 * String matching on IPv6 is a trap, because one address has many spellings:
 * ::ffff:127.0.0.1 and ::ffff:7f00:1 are the same address, and Node's URL
 * parser rewrites the first into the second. Comparing words rather than text
 * means every spelling collapses to the same answer.
 *
 * @returns {number[]|null} eight words, or null if unparseable
 */
function ipv6Words(ip) {
  let text = ip.toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, ''); // drop zone id

  // A trailing dotted-quad ("::ffff:127.0.0.1") is two words written in IPv4
  // notation. Convert it to hex so the rest of the parse is uniform.
  const dotted = /:((?:\d{1,3}\.){3}\d{1,3})$/.exec(text);
  if (dotted) {
    const octets = dotted[1].split('.').map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    text = text.slice(0, dotted.index) + ':' + hi + ':' + lo;
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const parse = (part) =>
    part ? part.split(':').filter((s) => s !== '').map((s) => parseInt(s, 16)) : [];

  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];

  if ([...head, ...tail].some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const zeros = 8 - head.length - tail.length;
  if (zeros < 1) return null;

  return [...head, ...Array(zeros).fill(0), ...tail];
}

function isBlockedIPv6(ip) {
  const words = ipv6Words(ip);
  if (!words) return true; // unparseable is not something to connect to

  const [w0, w1, w2, w3, w4, w5, w6, w7] = words;
  const embeddedIPv4 = (hi, lo) => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) are IPv4
  // destinations, so the IPv4 rules are the ones that apply.
  if (w0 === 0 && w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0) {
    if (w5 === 0xffff || w5 === 0) {
      if (w6 === 0 && w7 === 0) return true; // :: unspecified
      if (w6 === 0 && w7 === 1) return true; // ::1 loopback
      return isBlockedIPv4(embeddedIPv4(w6, w7));
    }
  }

  // 6to4 carries an IPv4 address in the next 32 bits.
  if (w0 === 0x2002) return isBlockedIPv4(embeddedIPv4(w1, w2));

  // Teredo tunnels to the IPv4 address in the last 32 bits, stored inverted.
  if (w0 === 0x2001 && w1 === 0x0000) {
    return isBlockedIPv4(embeddedIPv4(~w6 & 0xffff, ~w7 & 0xffff));
  }

  return (
    (w0 & 0xfe00) === 0xfc00 ||   // fc00::/7  unique local
    (w0 & 0xffc0) === 0xfe80 ||   // fe80::/10 link-local
    (w0 & 0xff00) === 0xff00      // ff00::/8  multicast
  );
}

/**
 * Parses and vets a URL, then resolves it to a safe address to connect to.
 *
 * Returns the resolved address alongside the URL so the caller can connect to
 * the address it validated rather than re-resolving the name. Re-resolving
 * would reintroduce the whole bug: a DNS server that answers "public" the first
 * time and "169.254.169.254" the second defeats any check that does not pin
 * the result it approved (DNS rebinding).
 *
 * @returns {Promise<{url: URL, address: string, family: number}>}
 * @throws {Error} with .code 'UNSAFE_URL', carrying a message safe to log but
 *                 not to return verbatim to a client.
 */
export async function resolveSafeUrl(rawUrl, { allowHttp = false } = {}) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    throw unsafe('Malformed URL');
  }

  // Only http(s). This is what rejects file:, ftp:, gopher:, and the data: and
  // javascript: schemes.
  const isHttps = url.protocol === 'https:';
  const isHttp = url.protocol === 'http:';
  if (!isHttps && !(isHttp && allowHttp)) {
    throw unsafe(`Protocol not allowed: ${url.protocol}`);
  }

  // Credentials in a URL are a redirect-laundering trick and never legitimate
  // for a public PDF.
  if (url.username || url.password) throw unsafe('URL must not contain credentials');

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!hostname) throw unsafe('URL has no host');

  // An IP literal skips DNS, so judge it directly. This is what catches the
  // decimal, hex, and IPv4-mapped-IPv6 encodings: Node's URL parser has already
  // normalised http://2130706433/ to 127.0.0.1 by this point.
  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw unsafe(`Blocked address: ${hostname}`);
    return { url, address: hostname, family: net.isIP(hostname) };
  }

  // Names that never resolve anywhere useful, rejected before spending a DNS
  // lookup on them.
  const lowerHost = hostname.toLowerCase();
  if (lowerHost === 'localhost' || lowerHost.endsWith('.localhost') || lowerHost.endsWith('.local')) {
    throw unsafe(`Blocked hostname: ${hostname}`);
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw unsafe(`DNS lookup failed for ${hostname}`);
  }

  if (!records?.length) throw unsafe(`No addresses for ${hostname}`);

  // EVERY address must be safe, not merely the first. A name answering with one
  // public and one private address would otherwise be usable by retrying until
  // the private one came first.
  for (const record of records) {
    if (isBlockedAddress(record.address)) {
      throw unsafe(`${hostname} resolves to a blocked address (${record.address})`);
    }
  }

  return { url, address: records[0].address, family: records[0].family };
}

function unsafe(message) {
  const err = new Error(message);
  err.code = 'UNSAFE_URL';
  return err;
}

export function isUnsafeUrlError(err) {
  return err?.code === 'UNSAFE_URL';
}
