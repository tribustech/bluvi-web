'use client';

import { useRouter } from 'next/navigation';
import { Component, startTransition, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListError } from '@/components/templates/T1';
import { competitionCardsKeys } from '@/core/competitions';

/*
 * fish RouteErrorBoundary for this route (parity competitions-list.index.c29,
 * competitions-list.b.route-error-boundary): a render error in the list shows a retry card in the
 * list's place — the top bar, the rest of the site and the other routes keep working. «Încearcă din
 * nou» throws away what may have crashed it — the cached card lists (reset, so they are read again)
 * and the server payload (router.refresh) — then re-mounts the list, in the same transition, so it
 * re-mounts on the fresh payload at the place in the URL (tab, scope, search). Focus lands on the
 * retry button when the card shows.
 */
export function ScreenBoundary({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const reset = (remount: () => void) => {
    startTransition(() => {
      void qc.resetQueries({ queryKey: competitionCardsKeys.root });
      router.refresh();
      remount();
    });
  };
  return <Boundary onReset={reset}>{children}</Boundary>;
}

type State = { error: Error | null; attempt: number };

class Boundary extends Component<{ children: ReactNode; onReset: (remount: () => void) => void }, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="px-4 py-6 md:px-6 xl:px-8 xl:py-8">
          <ListError
            title="Concursurile nu s-au putut afișa"
            description="A apărut o eroare pe această pagină. Încearcă din nou."
            focusOnMount
            attempt={this.state.attempt + 1}
            onRetry={() => this.props.onReset(() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 })))}
          />
        </div>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
