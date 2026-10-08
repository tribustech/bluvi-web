import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { formatText } from './api';

describe('formatText (fish services/api/ai.ts)', () => {
  it('POSTs the text to /ai/format-text (authenticated) and returns data.formatted', async () => {
    const { transport, calls } = createFakeTransport([{ data: { formatted: '<p><strong>Premii</strong></p>' } }]);
    await expect(formatText(transport, 'premii')).resolves.toBe('<p><strong>Premii</strong></p>');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/ai/format-text', body: { text: 'premii' }, auth: 'required' });
  });

  it('rejects a response without data.formatted', async () => {
    const { transport } = createFakeTransport([{ data: { text: 'x' } }]);
    await expect(formatText(transport, 'x')).rejects.toThrow();
  });
});
