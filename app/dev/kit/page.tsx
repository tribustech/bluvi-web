import { notFound } from 'next/navigation';
import { CardsSection } from './sections/cards';
import { NavigationSection } from './sections/navigation';
import { PrimitivesSection } from './sections/primitives';

/**
 * Component kit — every UI component with the design's own sample data, for the screenshot
 * comparison against design/Fundatii.dc.html §07. Dev only: 404 in production builds.
 * One section file per component group so parallel work never touches the same file.
 */
export default function KitPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    <main className="mx-auto max-w-[1120px] space-y-10 px-5 py-8 xl:px-8">
      <h1 className="t-page-title">Kit</h1>
      <section id="primitives" className="space-y-6">
        <PrimitivesSection />
      </section>
      <section id="cards" className="space-y-6">
        <CardsSection />
      </section>
      <section id="navigation" className="space-y-6">
        <NavigationSection />
      </section>
    </main>
  );
}
