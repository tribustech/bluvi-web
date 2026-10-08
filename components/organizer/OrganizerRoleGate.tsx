import { LockClosedIcon } from '@heroicons/react/24/outline';
import { DashboardEmpty, DashboardHeader, DashboardPage } from '@/components/templates/T5';
import { ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * organizer.b.role-gate — what an organizer page shows a signed-in viewer whose role is not
 * Organizer (lib/server/require-organizer.ts answered `allowed: false`): the page's own header and a
 * neutral T5 page-state card with the way home. No organizer read is made (fish skipToken), nothing
 * crashes, and nothing pretends the page is empty. `title` is the page's h1 (the panel's by default).
 */
export function OrganizerRoleGate({ title = 'Panou organizator' }: { title?: string }) {
  return (
    <DashboardPage header={<DashboardHeader title={title} back={{ href: routes.home(), label: 'Înapoi', inApp: true }} />}>
      <DashboardEmpty
        icon={<LockClosedIcon aria-hidden className="size-12" />}
        title="Panoul organizator este disponibil doar organizatorilor."
        action={
          <ButtonLink href={routes.home()} variant="secondary">
            Acasă
          </ButtonLink>
        }
      />
    </DashboardPage>
  );
}
