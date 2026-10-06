import { describe, expect, it } from 'vitest';
import { originOf, photoProxyTarget } from './photoProxy';

describe('photoProxyTarget', () => {
  const cms = 'http://localhost:1337';

  it('passes the CMS buckets over https', () => {
    expect(photoProxyTarget('https://bluvi-staging.s3.eu-central-1.amazonaws.com/a.jpg', cms)?.href).toBe(
      'https://bluvi-staging.s3.eu-central-1.amazonaws.com/a.jpg',
    );
    expect(photoProxyTarget('https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/b.png', null)).not.toBeNull();
  });

  it('passes the CMS origin (local uploads)', () => {
    expect(photoProxyTarget('http://localhost:1337/uploads/c.jpg', cms)?.pathname).toBe('/uploads/c.jpg');
  });

  it('refuses everything else', () => {
    expect(photoProxyTarget(null, cms)).toBeNull();
    expect(photoProxyTarget('', cms)).toBeNull();
    expect(photoProxyTarget('not a url', cms)).toBeNull();
    expect(photoProxyTarget('http://bluvi-staging.s3.eu-central-1.amazonaws.com/a.jpg', cms)).toBeNull();
    expect(photoProxyTarget('https://evil.example/a.jpg', cms)).toBeNull();
    expect(photoProxyTarget('https://bluvi-staging.s3.eu-central-1.amazonaws.com.evil.example/a.jpg', cms)).toBeNull();
    expect(photoProxyTarget('http://localhost:1338/uploads/c.jpg', cms)).toBeNull();
    expect(photoProxyTarget('http://user:pw@localhost:1337/uploads/c.jpg', cms)).toBeNull();
    expect(photoProxyTarget('file:///etc/passwd', cms)).toBeNull();
    expect(photoProxyTarget('http://localhost:1337/uploads/c.jpg', null)).toBeNull();
  });
});

describe('originOf', () => {
  it('reads the origin of the CMS base', () => {
    expect(originOf('http://localhost:1337/api')).toBe('http://localhost:1337');
    expect(originOf(undefined)).toBeNull();
    expect(originOf('nope')).toBeNull();
  });
});
