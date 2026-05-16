import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface OrganizerBannerProps {
  isOrganizer: boolean;
}

export function OrganizerBanner({ isOrganizer }: OrganizerBannerProps) {
  if (!isOrganizer) return null;

  return (
    <Link href="/organizer" className="block">
      <Card className="border-l-4 border-l-green-5 transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-2 p-2 text-green-7">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-7">Organizer mode</p>
              <p className="text-sm text-gray-5">Acceseaza dashboard-ul de organizator pentru a-ti gestiona competitiile.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-5" />
        </CardContent>
      </Card>
    </Link>
  );
}
