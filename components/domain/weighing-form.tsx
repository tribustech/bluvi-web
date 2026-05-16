"use client";

import { useState } from "react";
import { Plus, Play, Fish } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addCatch, createWeighing } from "@/services/api/weighing";

const FISH_TYPES = [
  "Crap", "Caras", "Stiuca", "Somn", "Salau", "Biban",
  "Platica", "Rosioara", "Amur", "Lin", "Sanger", "Altul",
];

export function WeighingForm({
  competitionId,
  standId,
  activeWeighingId,
  onSuccess,
}: {
  competitionId: string;
  standId: string;
  activeWeighingId?: string | null;
  onSuccess?: () => void;
}) {
  const [weight, setWeight] = useState("");
  const [fishType, setFishType] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCreate() {
    setIsLoading(true);
    try {
      await createWeighing(competitionId, { standId });
      setMessage({ text: "Cantarirea a fost deschisa.", type: "success" });
      onSuccess?.();
    } catch {
      setMessage({ text: "Nu am putut crea cantarirea.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddCatch() {
    if (!activeWeighingId) {
      setMessage({ text: "Porneste o cantarire activa pentru a adauga capturi.", type: "error" });
      return;
    }

    const parsed = Number(weight);
    if (isNaN(parsed) || parsed <= 0) {
      setMessage({ text: "Introdu o greutate valida (numar pozitiv).", type: "error" });
      return;
    }
    if (parsed > 100) {
      setMessage({ text: "Greutatea maxima este 100 kg.", type: "error" });
      return;
    }

    setIsLoading(true);
    try {
      await addCatch(activeWeighingId, { weight: parsed, fishType: fishType || undefined });
      setWeight("");
      setFishType("");
      setMessage({ text: "Captura a fost adaugata.", type: "success" });
      onSuccess?.();
    } catch {
      setMessage({ text: "Nu am putut adauga captura.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {!activeWeighingId && (
        <div className="rounded-card bg-indigo-1 p-6 text-center shadow-[0_2px_8px_rgba(99,102,241,0.15)]">
          <Play className="mx-auto mb-3 h-8 w-8 text-indigo-5" />
          <p className="mb-4 text-sm text-gray-5">Nu exista o cantarire activa. Porneste una noua.</p>
          <Button onClick={handleCreate} disabled={isLoading}>
            <Play className="mr-2 h-4 w-4" />
            Porneste cantarirea
          </Button>
        </div>
      )}

      {activeWeighingId && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-card bg-green-2 px-3 py-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-5" />
            <span className="text-sm font-bold text-green-7">Cantarire activa</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="relative">
              <Input
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="Greutate (kg)"
                type="number"
                step="0.01"
                min="0"
                className="pl-9"
              />
              <Fish className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-5" />
            </div>
            <Select value={fishType} onValueChange={setFishType}>
              <SelectTrigger>
                <SelectValue placeholder="Specie (optional)" />
              </SelectTrigger>
              <SelectContent>
                {FISH_TYPES.map((ft) => (
                  <SelectItem key={ft} value={ft}>{ft}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddCatch} disabled={isLoading || !weight}>
              <Plus className="mr-1 h-4 w-4" />
              Adauga
            </Button>
          </div>
        </div>
      )}

      {message && (
        <div className={`rounded-card px-4 py-2 text-sm font-semibold ${message.type === "success" ? "bg-green-2 text-green-7" : "bg-red-1 text-red-5"}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
