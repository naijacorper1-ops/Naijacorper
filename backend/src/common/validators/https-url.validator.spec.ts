import { isHttpsUrl } from './https-url.validator';

describe('isHttpsUrl', () => {
  it.each([
    'https://example.com',
    'https://example.com/apply?job=12&ref=naijacorper',
    'https://careers.example.co.ng/jobs/1#top',
    'https://example.com:443/x',
  ])('accepts %s', (value) => {
    expect(isHttpsUrl(value)).toBe(true);
  });

  it.each([
    'http://example.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com/file',
    'https://user:pass@example.com',
    'https://example.com:8443/x',
    'https://localhost/x',
    'example.com',
    '',
    'https://' + 'a'.repeat(500) + '.com',
  ])('rejects %s', (value) => {
    expect(isHttpsUrl(value)).toBe(false);
  });

  it('rejects things that are not strings', () => {
    expect(isHttpsUrl(undefined)).toBe(false);
    expect(isHttpsUrl(42)).toBe(false);
    expect(isHttpsUrl(null)).toBe(false);
  });
});
