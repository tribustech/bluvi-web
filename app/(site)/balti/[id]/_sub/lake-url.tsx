'use client';

import { createContext, useContext, type ReactNode } from 'react';

/*
 * The lake's URL segment (`/balti/<slug>`, lib/routes.ts lakeUrlId) for the links of the lake page
 * and its subpages. The screens keep the documentId for their reads (the route param, once proxy.ts
 * has rewritten a slug URL) and take their links from here, so a link goes straight to the slug URL
 * instead of through proxy.ts's 308. Outside a provider the documentId is the URL (it redirects).
 */
const LakeUrlContext = createContext<string | null>(null);

export function LakeUrlProvider({ urlId, children }: { urlId: string; children: ReactNode }) {
  return <LakeUrlContext.Provider value={urlId}>{children}</LakeUrlContext.Provider>;
}

/** The URL segment for `lakeId`'s links: the provided slug, or `lakeId` itself. */
export function useLakeUrlId(lakeId: string): string {
  return useContext(LakeUrlContext) ?? lakeId;
}
