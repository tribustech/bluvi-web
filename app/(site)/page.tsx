import type { Metadata } from 'next';

export const metadata: Metadata = { title: { absolute: 'Bluvi' } };

/** Placeholder «Acasă» until the Acasă screen lands (design/Acasa.dc.html). Data layer: core/. */
export default function Home() {
  return (
    <div className="px-5 py-6 md:px-6 xl:px-8 xl:py-8">
      <h1 className="t-page-title">Acasă</h1>
    </div>
  );
}
