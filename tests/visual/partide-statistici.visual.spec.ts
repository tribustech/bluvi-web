import { captureRoute } from './capture';

/*
 * Partide · Statistici comunitate (/partide/statistici) on the local CMS data: «Anul curent» (the
 * period the local database fills: totals, chart, top anglers and venues, the record, species) and
 * «Săptămâna» (empty locally: the empty state). The slow switch, the error and the hidden-section
 * states depend on mocked reads: tests/e2e/partide-statistici.spec.ts covers them.
 */
captureRoute({
  name: 'partide-statistici-an',
  path: '/partide/statistici?perioada=year',
  states: [{ name: 'signed-out' }],
});

captureRoute({
  name: 'partide-statistici-saptamana',
  path: '/partide/statistici?perioada=week',
  states: [{ name: 'signed-out' }],
});
