import { FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { JoinBack } from './JoinBack';
import { JOIN_HELPER, JoinForm } from './JoinForm';

export const JOIN_TITLE = 'Alătură-te unei partide';
const TITLE_ID = 'partide-intra-title';

/**
 * /partide/intra on T6 (fish app/(app)/partide/join/index.tsx): the header band (its back chip is
 * fish goBackOrHome: history back when the page before is ours, else the Partide hub; ./JoinBack)
 * and one task — the code. Below 768 a flush white section from the header down (fish's white
 * screen); from 768 a card, centred at the state measure (720), its form centred inside at 448. No
 * action bar: the button sits under the field, as in fish, so it stays next to the field above a
 * phone keyboard.
 */
export function JoinScreen() {
  return (
    <FlowLayout header={<FlowHeader title={JOIN_TITLE} id={TITLE_ID} backPlaceholder={<JoinBack />} />} labelledBy={TITLE_ID} narrow fill>
      <JoinForm />
    </FlowLayout>
  );
}

/** The route's loading state: the same header and card, the field and button in grey. */
export function JoinScreenLoading() {
  return (
    <FlowLayout header={<FlowHeader title={JOIN_TITLE} id={TITLE_ID} backPlaceholder={<JoinBack />} />} labelledBy={TITLE_ID} narrow fill busy>
      <FlowLoadingStatus />
      <div aria-hidden className="mx-auto flex w-full max-w-md flex-col gap-4 md:gap-5 md:py-4 xl:py-6">
        <p className="t-body-strong text-muted md:text-center">{JOIN_HELPER}</p>
        <span className="block h-18 rounded-control bg-soft-fill animate-shimmer md:h-20" />
        <span className="block h-12 rounded-control bg-soft-fill animate-shimmer xl:h-10" />
      </div>
    </FlowLayout>
  );
}
