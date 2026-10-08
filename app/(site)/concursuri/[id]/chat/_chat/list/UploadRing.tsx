/*
 * fish UploadRing (participant.chat c20): a ring over a photo that is still uploading. The web's
 * upload is one fetch (no progress events), so the ring turns until the message is written — the
 * honest «still uploading» without a made-up percentage.
 */
export function UploadRing() {
  return (
    <span role="status" aria-label="Se încarcă poza" className="absolute inset-0 flex items-center justify-center bg-photo-scrim/40">
      <svg aria-hidden viewBox="0 0 28 28" className="size-7 text-on-photo-scrim motion-safe:animate-spin">
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" />
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="78.5" strokeDashoffset="55" />
      </svg>
    </span>
  );
}
