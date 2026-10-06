'use client';

import { useParams } from 'next/navigation';
import { T2MapPill } from '@/components/templates/T2';
import { MapFrame } from './LakeMapScreen';

/**
 * The map page's frame while the lake (loading.tsx) or its stands (the page's Suspense, with the
 * lake's name) are read: the h1, the title row, T2Map's busy pill.
 */
export function LakeMapLoading({ lakeName, lakeId: id }: { lakeName?: string; lakeId?: string }) {
  const params = useParams<{ id?: string }>();
  const lakeId = id ?? params?.id;
  return (
    <MapFrame title={lakeName ? `Hartă ${lakeName}` : 'Hartă baltă'} lakeName={lakeName} lakeId={lakeId}>
      <div aria-busy="true" className="absolute inset-0 flex items-center justify-center bg-navy">
        <p role="status" className="sr-only">
          Se încarcă harta…
        </p>
        <T2MapPill busy>Se încarcă harta…</T2MapPill>
      </div>
    </MapFrame>
  );
}
