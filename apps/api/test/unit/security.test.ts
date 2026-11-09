import { describe, expect, it } from 'vitest';
import { BlockedUrlError, isPublicAddress, resolveSafeTarget } from '../../src/security/safeFetch';
import { csvCell, csvRow } from '../../src/lib/csv';
import { signToken, verifyToken } from '../../src/security/auth';

describe('isPublicAddress', () => {
  it.each([
    ['8.8.8.8', true],
    ['2606:4700:4700::1111', true],
    ['127.0.0.1', false],
    ['10.1.2.3', false],
    ['172.16.0.5', false],
    ['192.168.1.1', false],
    ['169.254.169.254', false], // cloud metadata
    ['100.64.0.1', false], // carrier-grade NAT
    ['0.0.0.0', false],
    ['::1', false],
    ['fc00::1', false],
    ['fe80::1', false],
    ['::ffff:127.0.0.1', false], // IPv4-mapped loopback
    ['::ffff:10.0.0.1', false],
    ['224.0.0.1', false],
    ['not-an-ip', false],
  ])('%s -> %s', (ip, expected) => {
    expect(isPublicAddress(ip)).toBe(expected);
  });
});

describe('resolveSafeTarget', () => {
  const blocked = [
    'http://127.0.0.1/admin',
    'http://localhost:80/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://10.0.0.8/',
    'http://redis.internal/',
    'ftp://example.com/file',
    'file:///etc/passwd',
    'https://user:pass@example.com/',
    'https://example.com:8443/',
    'http://2130706433/', // 127.0.0.1 as an integer
    'not a url',
  ];
  it.each(blocked)('blocks %s', async (url) => {
    await expect(resolveSafeTarget(url)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('accepts a public IP literal', async () => {
    const t = await resolveSafeTarget('https://1.1.1.1/');
    expect(t.address).toBe('1.1.1.1');
  });
});

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell(-42)).toBe('-42');
  });
  it('serialises arrays, dates and nulls', () => {
    expect(csvRow([['a', 'b'], new Date('2026-01-02T00:00:00Z'), null])).toBe('a; b,2026-01-02T00:00:00.000Z,\r\n');
  });
});

describe('jwt', () => {
  it('round-trips and rejects tampering', () => {
    const token = signToken({ id: 'u1', email: 'a@b.co', name: 'A', role: 'analyst' });
    expect(verifyToken(token)?.role).toBe('analyst');
    const [h, p, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), role: 'admin' })).toString('base64url');
    expect(verifyToken(`${h}.${forged}.${s}`)).toBeNull();
    expect(verifyToken('garbage')).toBeNull();
  });
  it('rejects alg=none tokens', () => {
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"x","role":"admin","iss":"strata"}').toString('base64url')}.`;
    expect(verifyToken(none)).toBeNull();
  });
});
