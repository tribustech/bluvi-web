import { auth } from "@/lib/auth";
import { safeStrapiGet } from "@/lib/strapi";
import { RaffleDashboard } from "@/components/domain/raffle-dashboard";
import type { RaffleActiveResponse } from "@/types";

export default async function RafflePage() {
  const session = await auth();
  const raffle = await safeStrapiGet<RaffleActiveResponse>("/raffle-sessions/active", undefined, {
    token: session?.strapiJwt,
    revalidate: 60,
  });

  return <RaffleDashboard raffle={raffle} />;
}
