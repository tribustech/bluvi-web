import { notFound } from 'next/navigation';

/**
 * Component kit — every UI component with the design's own sample data, for the screenshot
 * comparison against design/Fundatii.dc.html. Dev only: 404 in production builds.
 */
export default function KitPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    <main className="mx-auto max-w-[1120px] space-y-10 px-5 py-8 xl:px-8">
      <h1 className="t-page-title">Kit</h1>
      <section className="grid gap-3 rounded-card bg-surface p-4 shadow-e1">
        <p className="t-label uppercase tracking-wide text-muted">Cifra-semnătură</p>
        <div className="flex items-baseline gap-2">
          <span className="t-count text-ink">412,6</span>
          <span className="t-heading text-muted">kg</span>
        </div>
        <p className="t-caption text-muted">total cântărit · 24 sectoare</p>
      </section>
    </main>
  );
}
