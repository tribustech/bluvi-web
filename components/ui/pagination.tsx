import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  createHref,
}: {
  page: number;
  totalPages: number;
  createHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-2">
      {Array.from({ length: totalPages }).map((_, index) => {
        const itemPage = index + 1;
        return (
          <Link
            key={itemPage}
            href={createHref(itemPage)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-button border text-sm font-bold",
              itemPage === page
                ? "border-indigo-5 bg-indigo-5 text-white"
                : "border-gray-2 bg-white text-gray-7 hover:border-indigo-4",
            )}
          >
            {itemPage}
          </Link>
        );
      })}
    </nav>
  );
}
