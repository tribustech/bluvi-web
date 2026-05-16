"use client";

import Link from "next/link";
import { useCompetitionDraft } from "@/hooks/use-competition-draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RankingTypeSelector } from "@/components/domain/ranking-type-selector";
import { LakeSectorBuilder } from "@/components/domain/lake-sector-builder";
import { Save, ArrowLeft, ArrowRight } from "lucide-react";

type StepKey = "basics" | "config" | "ranking" | "lakeSectors";

export function OrganizerDraftStep({
  step,
  nextHref,
  previousHref,
}: {
  step: StepKey;
  nextHref: string;
  previousHref?: string;
}) {
  const { draft, setDraft } = useCompetitionDraft();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {step === "basics" && "Informatii de baza"}
          {step === "config" && "Configuratie competitie"}
          {step === "ranking" && "Configurare clasament"}
          {step === "lakeSectors" && "Balta si sectoare"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === "basics" && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-7">Nume competitie</label>
              <Input
                placeholder="Ex: Cupa Bluvi 2026"
                value={draft.basics.name}
                onChange={(e) =>
                  setDraft((c) => ({ ...c, basics: { ...c.basics, name: e.target.value } }))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-7">Data inceput</label>
                <Input
                  type="datetime-local"
                  value={draft.basics.startDate}
                  onChange={(e) =>
                    setDraft((c) => ({ ...c, basics: { ...c.basics, startDate: e.target.value } }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-7">Data sfarsit</label>
                <Input
                  type="datetime-local"
                  value={draft.basics.endDate}
                  onChange={(e) =>
                    setDraft((c) => ({ ...c, basics: { ...c.basics, endDate: e.target.value } }))
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-7">Taxa inscriere (lei)</label>
              <Input
                placeholder="Ex: 150"
                value={draft.basics.registerFee}
                onChange={(e) =>
                  setDraft((c) => ({ ...c, basics: { ...c.basics, registerFee: e.target.value } }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-7">Descriere</label>
              <Textarea
                placeholder="Descrie competitia..."
                rows={4}
                value={draft.basics.description}
                onChange={(e) =>
                  setDraft((c) => ({ ...c, basics: { ...c.basics, description: e.target.value } }))
                }
              />
            </div>
          </>
        )}

        {step === "config" && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-7">Tip competitie</label>
              <Select
                value={draft.config.competitionType}
                onValueChange={(value) =>
                  setDraft((c) => ({
                    ...c,
                    config: { ...c.config, competitionType: value as "single" | "team" },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteaza tipul" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Individual</SelectItem>
                  <SelectItem value="team">Echipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-gray-7">Numar locuri</label>
              <Input
                placeholder="Ex: 50"
                type="number"
                value={draft.config.participantsLimit}
                onChange={(e) =>
                  setDraft((c) => ({
                    ...c,
                    config: { ...c.config, participantsLimit: e.target.value },
                  }))
                }
              />
            </div>
            {draft.config.competitionType === "team" && (
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-7">Participanti per echipa</label>
                <Input
                  placeholder="Ex: 2"
                  type="number"
                  value={draft.config.teamParticipants}
                  onChange={(e) =>
                    setDraft((c) => ({
                      ...c,
                      config: { ...c.config, teamParticipants: e.target.value },
                    }))
                  }
                />
              </div>
            )}
          </>
        )}

        {step === "ranking" && (
          <RankingTypeSelector
            value={draft.ranking.rankingType}
            bestOfFishCount={draft.ranking.bestOfFishCount}
            numberOfWinners={draft.ranking.numberOfWinners}
            onChange={(values) =>
              setDraft((c) => ({
                ...c,
                ranking: { ...c.ranking, ...values },
              }))
            }
          />
        )}

        {step === "lakeSectors" && (
          <LakeSectorBuilder
            lakeId={draft.lakeSectors.lakeId}
            lakeName={draft.lakeSectors.lakeName}
            sectors={draft.lakeSectors.sectors}
            sponsors={draft.lakeSectors.sponsors}
            onChange={(values) =>
              setDraft((c) => ({
                ...c,
                lakeSectors: { ...c.lakeSectors, ...values },
              }))
            }
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-1 pt-5">
          <div className="flex gap-2">
            {previousHref && (
              <Button asChild variant="outline">
                <Link href={previousHref}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Inapoi
                </Link>
              </Button>
            )}
            <Button variant="secondary" onClick={() => { /* save draft logic already in review */ }}>
              <Save className="mr-1 h-4 w-4" />
              Salveaza ciorna
            </Button>
          </div>
          <Button asChild>
            <Link href={nextHref}>
              Urmatorul pas
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
