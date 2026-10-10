'use client';

import { useState } from 'react';
import type { Transport } from '@/core/transport';
import { createPulseTracker } from '../analytics';
import { PhoneBento } from './PhoneBento';
import { usePulse } from './usePulse';

/**
 * The phone bento with its reads (fish useCompetitionsPulse + PulseBento). Mounted only once the
 * client knows it is on a phone, so the person and featured draws never run elsewhere.
 */
export function PhonePulse({
  t,
  isAuthenticated,
  onOpenLive,
  onOpenStartingSoon,
}: {
  t: Transport;
  isAuthenticated: boolean;
  onOpenLive: () => void;
  onOpenStartingSoon: () => void;
}) {
  const pulse = usePulse(t, true, isAuthenticated);
  // One tracker per visit (fish createPulseTracker).
  const [tracker] = useState(() => createPulseTracker());
  return (
    <PhoneBento
      pulse={pulse}
      isAuthenticated={isAuthenticated}
      tracker={tracker}
      onOpenLive={onOpenLive}
      onOpenStartingSoon={onOpenStartingSoon}
    />
  );
}
