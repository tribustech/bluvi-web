import Link from "next/link";
import { ArrowRight, UserCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Profile } from "@/types";

interface ProfileCompletionNudgeProps {
  profile: Profile | null | undefined;
}

function isProfileIncomplete(profile: Profile | null | undefined) {
  if (!profile) return false;
  if (profile.isProfileComplete === false) return true;
  if (profile.isProfileComplete === true) return false;
  // Fallback when the flag isn't populated: missing username or phone reads as incomplete.
  return !profile.username || !profile.phone;
}

export function ProfileCompletionNudge({ profile }: ProfileCompletionNudgeProps) {
  if (!isProfileIncomplete(profile)) return null;

  return (
    <Link href="/profile" className="block">
      <Card className="border-indigo-3 bg-indigo-1 transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-3 p-2 text-indigo-7">
              <UserCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-7">Completeaza-ti profilul</p>
              <p className="text-sm text-gray-6">Adauga numele si telefonul pentru a te putea inscrie la competitii.</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-indigo-7" />
        </CardContent>
      </Card>
    </Link>
  );
}
