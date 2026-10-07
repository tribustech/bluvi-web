import { FollowedFrame, FollowedLoading } from './_components/FollowedFrame';

/** Navigating here: the same frame and spinner the page streams behind its gate. */
export default function Loading() {
  return (
    <FollowedFrame>
      <FollowedLoading />
    </FollowedFrame>
  );
}
