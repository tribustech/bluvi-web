import axios from "axios";

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

export const strapiAxios = axios.create({
  baseURL: `${STRAPI_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

export function setStrapiToken(token: string | null) {
  if (token) {
    strapiAxios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete strapiAxios.defaults.headers.common.Authorization;
  }
}
