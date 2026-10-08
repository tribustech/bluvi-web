'use client';

import { useParams } from 'next/navigation';
import { ListHeader } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { SubtitleBone } from './CatchesSkeleton';

/** The title row while the page loads (loading.tsx gets no params): «Capturi» and the way back. */
export function LoadingHeader() {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : null;
  return <ListHeader title="Capturi" titleId="capturi-titlu" description={<SubtitleBone />} back={{ label: 'Înapoi la partidă', href: id ? routes.partida(id) : routes.partide() }} />;
}
