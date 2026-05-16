import { Trophy, Fish, Award, Target } from "lucide-react";
import { auth } from "@/lib/auth";
import { safeStrapiGet } from "@/lib/strapi";
import { ProfileForm } from "@/components/domain/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Profile } from "@/types";

const STAT_ITEMS = [
  { key: "competitionsCount", label: "Competitii", icon: Trophy, color: "text-indigo-5 bg-indigo-1" },
  { key: "catchesCount", label: "Capturi", icon: Fish, color: "text-green-7 bg-green-2" },
  { key: "podiumsCount", label: "Podiumuri", icon: Award, color: "text-yellow-6 bg-yellow-1" },
  { key: "biggestCatchKg", label: "Record (kg)", icon: Target, color: "text-red-5 bg-red-1" },
] as const;

export default async function ProfilePage() {
  const session = await auth();
  const profile = await safeStrapiGet<Profile>("/user/profile", undefined, { token: session?.strapiJwt });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-7">Profilul meu</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_ITEMS.map(({ key, label, icon: Icon, color }) => {
          const value = profile?.statistics?.[key] ?? 0;
          return (
            <Card key={key}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-7">{typeof value === "number" ? value : 0}</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-5">{label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editeaza profilul</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
