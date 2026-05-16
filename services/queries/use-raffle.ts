"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "@/services/api/raffle";
import { queryKeys } from "./query-keys";

export function useActiveRaffle() {
  return useQuery({
    queryKey: queryKeys.raffle.active,
    queryFn: api.fetchActiveRaffle,
  });
}

export function useRaffleParticipation() {
  return useQuery({
    queryKey: queryKeys.raffle.participation,
    queryFn: api.fetchRaffleParticipation,
  });
}
