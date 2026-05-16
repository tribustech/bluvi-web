"use client";

import { useState } from "react";
import Image from "next/image";
import { Gift, Trophy, Users, CheckCircle, Clock } from "lucide-react";
import type { RaffleActiveResponse, RaffleWinnerEntry } from "@/types";
import { joinRaffleSession } from "@/services/api/raffle";
import { resolveMediaUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function WinnerCard({ winner, index }: { winner: RaffleWinnerEntry; index: number }) {
  const medals = ["bg-yellow-1 text-yellow-6", "bg-gray-1 text-gray-5", "bg-yellow-1/50 text-yellow-6"];
  const medalClass = medals[index] || "bg-indigo-1 text-indigo-5";

  return (
    <div className="flex items-center gap-3 rounded-card bg-white px-4 py-3 shadow-sm">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${medalClass}`}>
        {index + 1}
      </div>
      {winner.avatarUrl ? (
        <Image src={resolveMediaUrl(winner.avatarUrl) || "/logo.svg"} alt="" width={32} height={32} className="rounded-full object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-1 text-sm font-bold text-indigo-7">
          {winner.username?.charAt(0)?.toUpperCase() || "?"}
        </div>
      )}
      <span className="text-sm font-bold text-gray-7">{winner.username || "Participant"}</span>
    </div>
  );
}

export function RaffleDashboard({ raffle }: { raffle: RaffleActiveResponse | null }) {
  const [selectedType, setSelectedType] = useState<string | null>(raffle?.session.types?.[0]?.key ?? null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  if (!raffle) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card bg-white p-12 text-center shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
        <Gift className="h-12 w-12 text-gray-2" />
        <p className="text-sm text-gray-5">Nu exista o sesiune activa de tombola.</p>
      </div>
    );
  }

  const sessionDocumentId = raffle.session.documentId;
  const hasWinners = raffle.hasWinners && raffle.winnersByTypeKey;

  async function handleJoin() {
    if (!selectedType) return;
    setIsJoining(true);

    try {
      await joinRaffleSession(sessionDocumentId, selectedType);
      setMessage({ text: "Participarea a fost inregistrata!", type: "success" });
    } catch {
      setMessage({ text: "Nu am putut inregistra participarea.", type: "error" });
    } finally {
      setIsJoining(false);
    }
  }

  const totalParticipants = Object.values(raffle.registrationsByType).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="surface-card overflow-hidden rounded-card">
        {(raffle.session.headerLogoLeftUrl || raffle.session.headerLogoRightUrl) && (
          <div className="flex items-center justify-between border-b border-gray-1 bg-white px-6 py-4">
            {raffle.session.headerLogoLeftUrl ? (
              <Image src={resolveMediaUrl(raffle.session.headerLogoLeftUrl) || "/logo.svg"} alt="" width={120} height={40} className="h-10 w-auto" />
            ) : null}
            {raffle.session.headerLogoRightUrl ? (
              <Image src={resolveMediaUrl(raffle.session.headerLogoRightUrl) || "/logo.svg"} alt="" width={120} height={40} className="h-10 w-auto" />
            ) : null}
          </div>
        )}
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-7">{raffle.session.dashboardTitle || "Tombola Bluvi"}</h2>
              <p className="mt-1 text-sm text-gray-5">
                {raffle.session.dashboardSubtitle || "Alege tipul de participare si intra in cursa pentru premii."}
              </p>
            </div>
            <div className="flex gap-4">
              <div className="rounded-card bg-indigo-1 px-4 py-2 text-center">
                <p className="text-xl font-bold text-indigo-7">{totalParticipants}</p>
                <p className="text-xs text-gray-5">Participanti</p>
              </div>
              {raffle.isEnded ? (
                <Badge variant="gray" className="self-center px-3 py-1.5">Incheiata</Badge>
              ) : raffle.isRegistrationOpen ? (
                <Badge variant="green" className="self-center px-3 py-1.5">Activa</Badge>
              ) : (
                <Badge variant="yellow" className="self-center px-3 py-1.5">Inscrieri inchise</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left column: Join + Prizes */}
        <div className="space-y-6">
          {/* Type selection & Join */}
          {!raffle.isEnded && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-5" />
                  Participa la tombola
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {raffle.session.types?.length ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-5">Alege tipul de participare:</p>
                    <div className="flex flex-wrap gap-2">
                      {raffle.session.types.map((type) => (
                        <button
                          key={type.key}
                          className={`rounded-button border px-4 py-2.5 text-sm font-bold transition ${
                            selectedType === type.key
                              ? "border-indigo-5 bg-indigo-5 text-white shadow-card"
                              : "border-gray-2 bg-white text-gray-7 hover:border-indigo-4 hover:bg-indigo-1"
                          }`}
                          onClick={() => setSelectedType(type.key)}
                          type="button"
                        >
                          {type.label}
                          {raffle.registrationsByType[type.key] != null && (
                            <span className="ml-1.5 opacity-70">({raffle.registrationsByType[type.key]})</span>
                          )}
                        </button>
                      ))}
                    </div>
                    {raffle.session.types.find((t) => t.key === selectedType)?.description && (
                      <p className="rounded-card bg-gray-1 px-3 py-2 text-xs text-gray-5">
                        {raffle.session.types.find((t) => t.key === selectedType)?.description}
                      </p>
                    )}
                  </div>
                ) : null}

                {message && (
                  <div className={`rounded-card px-4 py-2 text-sm font-semibold ${message.type === "success" ? "bg-green-2 text-green-7" : "bg-red-1 text-red-5"}`}>
                    {message.type === "success" ? <CheckCircle className="mr-1.5 inline h-4 w-4" /> : null}
                    {message.text}
                  </div>
                )}

                <Button onClick={handleJoin} disabled={!raffle.isRegistrationOpen || isJoining || !selectedType} className="w-full">
                  <Gift className="mr-2 h-4 w-4" />
                  {raffle.isRegistrationOpen ? "Participa acum" : "Inscrierile sunt inchise"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Prizes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-5" />
                Premii
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {raffle.session.prizes?.map((prize, i) => (
                <div key={i} className="overflow-hidden rounded-card bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                  <div className="flex items-start gap-4 p-4">
                    {prize.image?.url && (
                      <Image src={resolveMediaUrl(prize.image.url) || "/logo.svg"} alt={prize.title} width={64} height={64} className="rounded-card object-cover" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-7">{prize.title}</p>
                        <Badge variant="indigo">x{prize.count}</Badge>
                      </div>
                      {prize.description && <p className="mt-1 text-sm text-gray-5">{prize.description}</p>}
                      {prize.priceLei && (
                        <p className="mt-1 text-sm font-bold text-indigo-5">{prize.priceLei} lei</p>
                      )}
                    </div>
                  </div>
                  {prize.items?.length ? (
                    <div className="border-t border-gray-1 bg-gray-1/50 px-4 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {prize.items.map((item, j) => (
                          <span key={j} className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-5 shadow-sm">
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Winners + Regulation */}
        <div className="space-y-6">
          {hasWinners && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-5" />
                  Castigatori
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(raffle.winnersByTypeKey!).map(([typeKey, winners]) => {
                  const typeLabel = raffle.session.types?.find((t) => t.key === typeKey)?.label || typeKey;
                  return (
                    <div key={typeKey} className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-5">{typeLabel}</p>
                      <div className="space-y-2">
                        {winners.map((winner, i) => (
                          <WinnerCard key={winner.documentId || i} winner={winner} index={i} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {raffle.session.previousWinnerAnnouncement && (
            <div className="surface-card rounded-card p-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-5" />
                <p className="text-xs font-bold uppercase tracking-wider text-gray-5">Ultimul castigator</p>
              </div>
              <p className="mt-2 text-sm font-bold text-gray-7">{raffle.session.previousWinnerAnnouncement}</p>
            </div>
          )}

          {raffle.session.regulationSections?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>{raffle.session.regulationTitle || "Regulament"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {raffle.session.regulationSections.map((section, i) => (
                  <div key={i}>
                    <p className="text-sm font-bold text-gray-7">{section.title}</p>
                    <p className="mt-1 text-sm text-gray-5">{section.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
