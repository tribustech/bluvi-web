import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardGreetingProps {
  username: string | null | undefined;
}

export function DashboardGreeting({ username }: DashboardGreetingProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bine ai revenit, {username || "pescar"}.</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-gray-7">
        <p>Dashboard-ul combina recomandari publice cu datele private din contul tau Strapi.</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/competitions">Vezi competitii</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile">Editeaza profilul</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
