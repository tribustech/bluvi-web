import { LoadingRow } from '@/components/surfaces/StateCard';

/** Route-level fallback while a page streams in (text skeleton only, Fundații §07). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-3 px-5 py-6 md:px-6 xl:px-8 xl:py-8">
      <div aria-hidden className="mb-2 h-8 w-48 rounded-full bg-soft-fill animate-shimmer" />
      <LoadingRow />
      <div aria-hidden className="flex flex-col gap-3">
        <LoadingRow />
        <LoadingRow />
      </div>
    </div>
  );
}
