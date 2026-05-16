"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "basics", label: "Informatii de baza", href: "/create-competition/basics" },
  { key: "config", label: "Configuratie", href: "/create-competition/config" },
  { key: "ranking", label: "Clasament", href: "/create-competition/ranking" },
  { key: "lake-sectors", label: "Balta si sectoare", href: "/create-competition/lake-sectors" },
  { key: "review", label: "Revizuire", href: "/create-competition/review" },
];

export default function CreateCompetitionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentStepIndex = STEPS.findIndex((s) => pathname.includes(s.key));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-7">Creaza competitie</h1>
        <p className="mt-1 text-sm text-gray-5">Completeaza toti pasii pentru a publica competitia.</p>
      </div>

      {/* Progress bar */}
      <nav className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((step, index) => {
          const isComplete = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step.key} className="flex items-center">
              <Link
                href={step.href}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition whitespace-nowrap",
                  isComplete && "bg-green-2 text-green-7",
                  isCurrent && "bg-indigo-5 text-white shadow-card",
                  !isComplete && !isCurrent && "bg-gray-1 text-gray-5 hover:bg-gray-2",
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    isCurrent ? "bg-white/20 text-white" : "bg-gray-2 text-gray-5",
                  )}>
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">Pas {index + 1}</span>
              </Link>
              {index < STEPS.length - 1 && (
                <div className={cn("mx-1 h-px w-4 md:w-8", index < currentStepIndex ? "bg-green-3" : "bg-gray-2")} />
              )}
            </div>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
