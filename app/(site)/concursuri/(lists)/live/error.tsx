'use client';

import { StatusListError } from '../_status/StatusListError';

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <StatusListError list="live" error={error} retry={retry} />;
}
