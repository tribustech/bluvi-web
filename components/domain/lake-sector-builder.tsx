"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Trash2, MapPin, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/services/queries/query-keys";
import { getLakes } from "@/services/api/lakes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SECTOR_COLORS = [
  "bg-indigo-5 text-white",
  "bg-green-5 text-white",
  "bg-red-5 text-white",
  "bg-yellow-5 text-white",
  "bg-cyan-6 text-white",
  "bg-indigo-7 text-white",
  "bg-green-7 text-white",
  "bg-red-6 text-white",
  "bg-yellow-6 text-white",
];

const SECTOR_BG_COLORS = [
  "bg-indigo-1 border-indigo-4",
  "bg-green-2 border-green-3",
  "bg-red-1 border-red-5",
  "bg-yellow-1 border-yellow-5",
  "bg-indigo-2 border-cyan-6",
  "bg-indigo-1 border-indigo-7",
  "bg-green-2 border-green-7",
  "bg-red-1 border-red-6",
  "bg-yellow-1 border-yellow-6",
];

interface SectorData {
  name: string;
  minFishNumber: number;
}

interface LakeSectorBuilderProps {
  lakeId: string;
  lakeName: string;
  sectors: string;
  sponsors: string;
  onChange: (values: { lakeId?: string; lakeName?: string; sectors?: string; sponsors?: string }) => void;
}

export function LakeSectorBuilder({ lakeId, lakeName, sectors, sponsors, onChange }: LakeSectorBuilderProps) {
  const [lakeSearch, setLakeSearch] = useState(lakeName || "");
  const [showDropdown, setShowDropdown] = useState(false);

  // Parse sectors from string (JSON or simple text)
  const sectorList: SectorData[] = useMemo(() => {
    if (!sectors) return [];
    try {
      return JSON.parse(sectors) as SectorData[];
    } catch {
      return sectors
        .split("\n")
        .filter(Boolean)
        .map((name, i) => ({ name: name.trim() || String.fromCharCode(65 + i), minFishNumber: 5 }));
    }
  }, [sectors]);

  const { data: lakesResult } = useQuery({
    queryKey: queryKeys.lakes.search(lakeSearch),
    queryFn: () => getLakes({ page: 1, pageSize: 8, search: lakeSearch }),
    enabled: lakeSearch.length >= 2 && showDropdown,
  });

  const lakes = lakesResult?.data ?? [];

  const updateSectors = useCallback(
    (newSectors: SectorData[]) => {
      onChange({ sectors: JSON.stringify(newSectors) });
    },
    [onChange],
  );

  function addSector() {
    const nextLetter = String.fromCharCode(65 + sectorList.length);
    updateSectors([...sectorList, { name: `Sector ${nextLetter}`, minFishNumber: 5 }]);
  }

  function removeSector(index: number) {
    updateSectors(sectorList.filter((_, i) => i !== index));
  }

  function updateSector(index: number, field: keyof SectorData, value: string | number) {
    const updated = sectorList.map((s, i) =>
      i === index ? { ...s, [field]: value } : s,
    );
    updateSectors(updated);
  }

  function selectLake(lake: { documentId: string; name: string }) {
    onChange({ lakeId: lake.documentId, lakeName: lake.name });
    setLakeSearch(lake.name);
    setShowDropdown(false);
  }

  return (
    <div className="space-y-6">
      {/* Lake Search Combobox */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-7">
          <MapPin className="h-4 w-4 text-indigo-5" />
          Selecteaza balta
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-5" />
          <Input
            value={lakeSearch}
            onChange={(e) => {
              setLakeSearch(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) onChange({ lakeId: "", lakeName: "" });
            }}
            onFocus={() => lakeSearch.length >= 2 && setShowDropdown(true)}
            placeholder="Cauta balta dupa nume..."
            className="pl-9"
          />
          {showDropdown && lakes.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-card border border-gray-2 bg-white shadow-card">
              {lakes.map((lake) => (
                <button
                  key={lake.documentId}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-indigo-1",
                    lakeId === lake.documentId && "bg-indigo-1 font-bold text-indigo-7",
                  )}
                  onClick={() => selectLake(lake)}
                >
                  <MapPin className="h-4 w-4 flex-shrink-0 text-gray-5" />
                  <div>
                    <p className="font-semibold text-gray-7">{lake.name}</p>
                    {lake.address && <p className="text-xs text-gray-5">{lake.address}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {lakeId && (
          <p className="flex items-center gap-1.5 text-xs text-green-7">
            <MapPin className="h-3 w-3" />
            Balta selectata: <strong>{lakeName}</strong>
          </p>
        )}
      </div>

      {/* Sector Builder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-7">
            <Layers className="h-4 w-4 text-indigo-5" />
            Sectoare ({sectorList.length})
          </label>
          <Button type="button" variant="outline" size="sm" onClick={addSector} disabled={sectorList.length >= 9}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Adauga sector
          </Button>
        </div>

        {sectorList.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-gray-2 p-8 text-center">
            <Layers className="h-10 w-10 text-gray-2" />
            <p className="text-sm text-gray-5">Nu ai adaugat sectoare inca. Apasa butonul de mai sus.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sectorList.map((sector, index) => (
              <div
                key={index}
                className={cn("rounded-card border p-4 transition", SECTOR_BG_COLORS[index] || "bg-gray-1 border-gray-2")}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", SECTOR_COLORS[index] || "bg-gray-5 text-white")}>
                    {sector.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSector(index)}
                    className="rounded-full p-1 text-gray-5 transition hover:bg-red-1 hover:text-red-5"
                    aria-label="Sterge sector"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <Input
                    value={sector.name}
                    onChange={(e) => updateSector(index, "name", e.target.value)}
                    placeholder="Nume sector"
                    className="bg-white text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <label className="whitespace-nowrap text-xs text-gray-5">Min. pesti:</label>
                    <Input
                      type="number"
                      min={1}
                      value={sector.minFishNumber}
                      onChange={(e) => updateSector(index, "minFishNumber", Number(e.target.value))}
                      className="w-20 bg-white text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sponsors */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-7">Sponsori (optional)</label>
        <Textarea
          placeholder="Adauga sponsori, cate unul pe linie"
          rows={3}
          value={sponsors}
          onChange={(e) => onChange({ sponsors: e.target.value })}
        />
      </div>
    </div>
  );
}
