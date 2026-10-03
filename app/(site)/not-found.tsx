import { EmptyState } from '@/components/surfaces/StateCard';
import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 px-5 py-6 md:px-6 xl:px-8 xl:py-8">
      <h1 className="t-page-title">Pagina nu există</h1>
      <EmptyState
        className="w-full max-w-[560px]"
        title="Nu am găsit ce cauți."
        description="Linkul poate fi greșit sau pagina a fost mutată."
      />
      <ButtonLink href="/" variant="secondary">
        Înapoi acasă
      </ButtonLink>
    </div>
  );
}
