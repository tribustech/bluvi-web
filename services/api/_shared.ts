import qs from "qs";
import { strapiAxios } from "@/lib/strapi-client";

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export function buildQuery(input: Record<string, unknown>) {
  return qs.stringify(input, {
    encodeValuesOnly: true,
    arrayFormat: "indices",
  });
}

export function unwrapData<T>(payload: { data?: T } | T): T {
  if (payload && typeof payload === "object" && "data" in (payload as { data?: T })) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
}

export async function getJson<T>(url: string, params?: Record<string, unknown>) {
  const response = await strapiAxios.get<T>(url, { params });
  return response.data;
}

export async function postJson<T>(url: string, body?: Record<string, unknown>) {
  const response = await strapiAxios.post<T>(url, body);
  return response.data;
}

export async function putJson<T>(url: string, body?: Record<string, unknown>) {
  const response = await strapiAxios.put<T>(url, body);
  return response.data;
}

export async function patchJson<T>(url: string, body?: Record<string, unknown>) {
  const response = await strapiAxios.patch<T>(url, body);
  return response.data;
}

export async function deleteJson<T>(url: string) {
  const response = await strapiAxios.delete<T>(url);
  return response.data;
}
