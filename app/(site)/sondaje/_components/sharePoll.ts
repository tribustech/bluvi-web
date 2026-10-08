import { absoluteUrl, routes } from '@/lib/routes';
import { pollShareText } from './model';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

/**
 * fish helpers/sharePoll.ts on the web (c14): the system share sheet (Web Share API) with the text
 * and the absolute /sondaje URL; without one (desktop browsers) the link is copied and the caller
 * says so. A dismissed sheet or a refused clipboard is silent (fish: «user cancelled — silent»).
 */
export async function sharePoll(poll: { title: string }): Promise<ShareOutcome> {
  const url = absoluteUrl(routes.polls());
  const text = pollShareText(poll.title);
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: poll.title, text, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'cancelled';
  }
}
