"use client";

import { useState } from "react";
import { ChevronDown, Info, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RankingOption {
  key: string;
  label: string;
  shortDescription: string;
  fullExplanation: string;
  showBestOf?: boolean;
}

const RANKING_OPTIONS: RankingOption[] = [
  {
    key: "quantity",
    label: "Cantitate",
    shortDescription: "Castigatorul este cel care prinde cea mai mare greutate totala de pesti.",
    fullExplanation:
      "In clasamentul de tip Cantitate, fiecare participant aduna greutatea totala a tuturor pestilor prinsi. Clasamentul se face pe sector, apoi general. Punctele se acorda in functie de pozitia din sector. In caz de egalitate, se compara numarul de capturi si cel mai mare peste prins.",
  },
  {
    key: "quality",
    label: "Calitate",
    shortDescription: "Se pastreaza doar cei mai grei N pesti (configurabil per sector). Restul sunt eliberati.",
    fullExplanation:
      "In clasamentul de tip Calitate, fiecare stand are un numar minim de pesti (configurat per sector). Se pastreaza doar acei N pesti cei mai grei din fiecare cantarire. Clasamentul se face dupa greutatea totala a celor N pesti selectati. Aceasta metoda favorizeaza calitatea pestilor prinsi, nu cantitatea.",
  },
  {
    key: "quantityQuality",
    label: "Cantitate + Calitate",
    shortDescription: "Doua clasamente separate: unul pe cantitate si unul pe calitate, combinate intr-un clasament general.",
    fullExplanation:
      "Acest tip de clasament combina doua metrici: greutatea totala (cantitate) si greutatea celor mai buni N pesti (calitate). Fiecare metrica genereaza un clasament pe sector cu puncte. Clasamentul general se face prin insumarea punctelor din ambele clasamente. Aceasta metoda ofera o imagine completa a performantei.",
  },
  {
    key: "bestOf",
    label: "Best Of",
    shortDescription: "Se pastreaza doar primii N pesti (dupa greutate) din toate capturile.",
    fullExplanation:
      "In clasamentul Best Of, fiecare participant isi selecteaza cei mai grei N pesti (numarul N este configurat la crearea competitiei). Clasamentul se face dupa media greutatii acestor N pesti selectati. Daca un participant are mai putini de N pesti, se calculeaza media cu 0 pentru pestii lipsa.",
    showBestOf: true,
  },
  {
    key: "nationalChampionship",
    label: "Campionat National",
    shortDescription: "Clasament pe echipe (cluburi). Punctele echipelor se aduna la nivel de club.",
    fullExplanation:
      "Clasamentul de tip Campionat National este destinat competitiilor pe echipe organizate la nivel national. Fiecare echipa apartine unui club. Punctele se acumuleaza la nivel de club, bazat pe performantele individuale ale echipelor din fiecare sector. Clasamentul final se face pe cluburi.",
  },
];

interface RankingTypeSelectorProps {
  value: string;
  bestOfFishCount: string;
  numberOfWinners: string;
  onChange: (values: { rankingType?: string; bestOfFishCount?: string; numberOfWinners?: string }) => void;
}

export function RankingTypeSelector({ value, bestOfFishCount, numberOfWinners, onChange }: RankingTypeSelectorProps) {
  const [expanded, setExpanded] = useState<string | null>(value || null);
  const [dialogOption, setDialogOption] = useState<RankingOption | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-5">Selecteaza tipul de clasament pentru competitie:</p>

      <div className="space-y-3">
        {RANKING_OPTIONS.map((option) => {
          const isSelected = value === option.key;
          const isExpanded = expanded === option.key;

          return (
            <div
              key={option.key}
              className={cn(
                "overflow-hidden rounded-card border transition-all",
                isSelected ? "border-indigo-5 bg-indigo-1 ring-1 ring-indigo-4" : "border-gray-2 bg-white hover:border-gray-5",
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-5 py-4 text-left"
                onClick={() => {
                  onChange({ rankingType: option.key });
                  setExpanded(isExpanded ? null : option.key);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    isSelected ? "bg-indigo-5 text-white" : "bg-gray-1 text-gray-5",
                  )}>
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={cn("font-bold", isSelected ? "text-indigo-7" : "text-gray-7")}>{option.label}</p>
                    <p className="mt-0.5 text-sm text-gray-5">{option.shortDescription}</p>
                  </div>
                </div>
                <ChevronDown className={cn("h-5 w-5 text-gray-5 transition-transform", isExpanded && "rotate-180")} />
              </button>

              {isExpanded && (
                <div className="border-t border-gray-2 bg-white px-5 py-4 space-y-4">
                  {option.showBestOf && (
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-gray-7">Numar pesti Best Of</label>
                      <Input
                        type="number"
                        placeholder="Ex: 5"
                        value={bestOfFishCount}
                        onChange={(e) => onChange({ bestOfFishCount: e.target.value })}
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-gray-7">Numar castigatori</label>
                    <Input
                      type="number"
                      placeholder="Ex: 3"
                      value={numberOfWinners}
                      onChange={(e) => onChange({ numberOfWinners: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogOption(option)}
                  >
                    <Info className="mr-1.5 h-4 w-4" />
                    Vezi explicatia completa
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!dialogOption} onOpenChange={(open) => !open && setDialogOption(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-indigo-5" />
              {dialogOption?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-gray-7">{dialogOption?.fullExplanation}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
