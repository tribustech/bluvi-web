import qs from "qs";

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

type SearchParamsValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>
  | Record<string, unknown>;

interface FetchOptions {
  tags?: string[];
  revalidate?: number;
  token?: string;
}

export async function strapiGet<T>(
  path: string,
  params?: Record<string, SearchParamsValue>,
  options: FetchOptions = {},
): Promise<T> {
  const query = params
    ? qs.stringify(params, {
        encodeValuesOnly: true,
        arrayFormat: "indices",
      })
    : "";

  const url = `${STRAPI_URL}/api${path}${query ? `?${query}` : ""}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  } else if (STRAPI_TOKEN) {
    headers.Authorization = `Bearer ${STRAPI_TOKEN}`;
  }

  const response = await fetch(url, {
    headers,
    next: {
      tags: options.tags,
      revalidate: options.revalidate,
    },
  });

  if (!response.ok) {
    throw new Error(`Strapi request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function safeStrapiGet<T>(
  path: string,
  params?: Record<string, SearchParamsValue>,
  options?: FetchOptions,
): Promise<T | null> {
  try {
    return await strapiGet<T>(path, params, options);
  } catch {
    return null;
  }
}
