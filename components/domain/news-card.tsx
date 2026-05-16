import Image from "next/image";
import Link from "next/link";
import type { NewsArticle } from "@/types";
import { timeAgo, resolveMediaUrl } from "@/lib/utils";

export function NewsCard({ article }: { article: NewsArticle }) {
  const image = resolveMediaUrl(article.banner?.url) || "/logo.svg";
  const slug = article.slug || article.documentId;

  return (
    <Link href={`/news/${slug}`}>
      <div className="overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_8px_25px_rgba(0,0,0,0.12)]">
        <div className="relative h-[200px] w-full">
          <Image src={image} alt={article.title} fill className="object-cover" />
        </div>

        <div className="card-image-overlap px-4 pb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-5">
            {article.createdAt ? timeAgo(article.createdAt) : "Recent"}
          </p>
          <h3 className="mt-1 text-lg font-bold text-gray-7">{article.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-gray-5">
            {article.excerpt || "Ultimele noutati din ecosistemul Bluvi."}
          </p>
        </div>
      </div>
    </Link>
  );
}
