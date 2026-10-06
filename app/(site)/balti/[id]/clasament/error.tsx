'use client';

import { SubError } from '../_sub/SubError';

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <SubError error={error} retry={retry} heading="Clasamentul nu a putut fi încărcat" />;
}
