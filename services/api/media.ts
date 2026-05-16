import { postJson } from "./_shared";

export async function uploadMedia(file: File) {
  const formData = new FormData();
  formData.append("files", file);
  return postJson("/upload", formData as unknown as Record<string, unknown>);
}
