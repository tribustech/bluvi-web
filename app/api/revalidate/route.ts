import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const tagMap: Record<string, string> = {
  competition: "competitions",
  lake: "lakes",
  announcement: "news",
  sponsor: "sponsors",
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidation-secret");

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { model?: string };
    const tag = body.model ? tagMap[body.model] : undefined;

    if (!tag) {
      return NextResponse.json({ revalidated: false, message: "Unknown model" });
    }

    revalidateTag(tag);
    return NextResponse.json({ revalidated: true, tag });
  } catch {
    return NextResponse.json({ message: "Error revalidating" }, { status: 500 });
  }
}
