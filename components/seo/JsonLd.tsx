import { jsonLdHtml } from '@/lib/json-ld';

/** schema.org JSON-LD, rendered on the server. `<` is escaped so a title can never close the script. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(data)} />;
}
