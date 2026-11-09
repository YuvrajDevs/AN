import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { config } from '../config';

/**
 * SSRF-safe outbound HTTP client.
 *
 * Every URL that reaches the network on behalf of a user (RSS feeds they add, alert
 * webhooks, press-release links) goes through here. Defences:
 *  - http/https only, default ports only, no credentials in the URL;
 *  - the hostname is resolved once and EVERY resolved address must be public unicast
 *    (blocks 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16 incl. cloud metadata,
 *    100.64/10, ::1, fc00::/7, fe80::/10, IPv4-mapped IPv6 of those, multicast, …);
 *  - the socket connects to the address we validated (custom `lookup`), so a second
 *    DNS answer cannot rebind the request to an internal host;
 *  - redirects are followed manually (max 3) and every hop is re-validated;
 *  - hard timeout and response-size cap.
 */

export class BlockedUrlError extends Error {
  readonly code = 'blocked_url';
}

export interface SafeFetchOptions {
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

export interface SafeFetchResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  url: string;
  text: string;
}

const ALLOWED_PORTS = new Set(['', '80', '443']);

export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  let ip = ipaddr.parse(address);
  if (ip.kind() === 'ipv6' && (ip as ipaddr.IPv6).isIPv4MappedAddress()) {
    ip = (ip as ipaddr.IPv6).toIPv4Address();
  }
  // ipaddr.js labels globally routable addresses "unicast"; every other range
  // (private, loopback, linkLocal, uniqueLocal, carrierGradeNat, reserved, …) is refused.
  return ip.range() === 'unicast';
}

function allowListed(hostname: string): boolean {
  const allow = config.FETCH_ALLOW_HOSTS.split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(hostname.toLowerCase());
}

/** Validate a URL's shape and resolve it to a single vetted address. */
export async function resolveSafeTarget(rawUrl: string): Promise<{ url: URL; address: string; family: 4 | 6 }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BlockedUrlError('Only http(s) URLs are allowed');
  if (url.username || url.password) throw new BlockedUrlError('Credentials in URLs are not allowed');
  if (!ALLOWED_PORTS.has(url.port)) throw new BlockedUrlError('Only default ports (80/443) are allowed');

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const exempt = allowListed(hostname);

  let addresses: { address: string; family: number }[];
  if (net.isIP(hostname)) {
    addresses = [{ address: hostname, family: net.isIP(hostname) }];
  } else {
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(hostname) && !exempt) {
      throw new BlockedUrlError('Internal hostnames are not allowed');
    }
    try {
      addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new BlockedUrlError('Hostname could not be resolved');
    }
  }
  if (addresses.length === 0) throw new BlockedUrlError('Hostname could not be resolved');
  if (!exempt) {
    for (const a of addresses) {
      if (!isPublicAddress(a.address)) throw new BlockedUrlError('URL resolves to a private or reserved address');
    }
  }
  const chosen = addresses[0];
  return { url, address: chosen.address, family: chosen.family === 6 ? 6 : 4 };
}

function requestOnce(
  target: { url: URL; address: string; family: 4 | 6 },
  opts: Required<Pick<SafeFetchOptions, 'timeoutMs' | 'maxBytes'>> & SafeFetchOptions,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; text: string }> {
  const { url, address, family } = target;
  const mod = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      url,
      {
        method: opts.method ?? 'GET',
        headers: { 'user-agent': 'StrataBot/0.1 (+https://github.com/YuvrajDevs/AN)', ...opts.headers },
        // Pin the connection to the address we validated (defeats DNS rebinding).
        lookup: (_host, _o, cb) => cb(null, address, family),
        timeout: opts.timeoutMs,
        servername: net.isIP(url.hostname) ? undefined : url.hostname,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > opts.maxBytes) {
            req.destroy(new Error('Response too large'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }),
        );
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const opts = { timeoutMs: 10_000, maxBytes: 2 * 1024 * 1024, maxRedirects: 3, ...options };
  let current = rawUrl;
  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    const target = await resolveSafeTarget(current);
    const res = await requestOnce(target, opts);
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = new URL(res.headers.location, target.url).toString();
      continue;
    }
    return { ...res, url: current };
  }
  throw new BlockedUrlError('Too many redirects');
}
