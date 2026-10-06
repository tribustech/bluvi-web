import { TimelineScreenSkeleton } from './TimelineScreen';

/** While the competition read is in flight: the page's own frame (not the competition shell's). */
export default function Loading() {
  return <TimelineScreenSkeleton />;
}
