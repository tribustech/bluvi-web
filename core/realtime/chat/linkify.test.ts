import { describe, expect, it } from 'vitest';
import { linkify } from './linkify';

describe('linkify', () => {
  it('returns one text token for plain text', () => {
    expect(linkify('salut')).toEqual([{ kind: 'text', value: 'salut', href: '' }]);
  });

  it('finds http(s) urls and www. hosts', () => {
    expect(linkify('vezi https://bluvi.ro/x?a=1 si www.anar.ro acum')).toEqual([
      { kind: 'text', value: 'vezi ', href: '' },
      { kind: 'url', value: 'https://bluvi.ro/x?a=1', href: 'https://bluvi.ro/x?a=1' },
      { kind: 'text', value: ' si ', href: '' },
      { kind: 'url', value: 'www.anar.ro', href: 'https://www.anar.ro' },
      { kind: 'text', value: ' acum', href: '' },
    ]);
  });

  it('prefixes https on an upper-case www host', () => {
    expect(linkify('WWW.anar.ro')).toEqual([{ kind: 'url', value: 'WWW.anar.ro', href: 'https://WWW.anar.ro' }]);
  });

  it('strips a trailing punctuation mark from a url', () => {
    expect(linkify('link: https://bluvi.ro.')).toEqual([
      { kind: 'text', value: 'link: ', href: '' },
      { kind: 'url', value: 'https://bluvi.ro', href: 'https://bluvi.ro' },
      { kind: 'text', value: '.', href: '' },
    ]);
  });

  it('finds Romanian phone numbers with and without separators', () => {
    expect(linkify('suna 0722 123 456 sau +40722123456')).toEqual([
      { kind: 'text', value: 'suna ', href: '' },
      { kind: 'phone', value: '0722 123 456', href: 'tel:0722123456' },
      { kind: 'text', value: ' sau ', href: '' },
      { kind: 'phone', value: '+40722123456', href: 'tel:+40722123456' },
    ]);
  });

  it('does not treat a weight or a stand number as a phone', () => {
    expect(linkify('12,450 kg pe B3 la 07:30')).toEqual([{ kind: 'text', value: '12,450 kg pe B3 la 07:30', href: '' }]);
  });

  it('covers the whole input with no dropped characters', () => {
    const inputs = [
      'salut',
      'vezi https://bluvi.ro/x?a=1 si www.anar.ro acum',
      'link: https://bluvi.ro.',
      'suna 0722 123 456 sau +40722123456',
      '12,450 kg pe B3 la 07:30',
    ];
    for (const input of inputs) {
      const tokens = linkify(input);
      expect(tokens.map(t => t.value).join('')).toBe(input);
    }
  });
});
