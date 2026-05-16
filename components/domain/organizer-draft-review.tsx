"use client";

import { useState } from "react";
import Link from "next/link";
import { useCompetitionDraft } from "@/hooks/use-competition-draft";
import { createDraft, publishDraft } from "@/services/api/organizer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Pencil, Loader2, Send, Calendar, Users, Trophy, MapPin } from "lucide-react";

function ReviewSection({
  title,
  icon: Icon,
  editHref,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-gray-1 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-indigo-5" />
          <p className="text-sm font-bold uppercase tracking-wider text-gray-5">{title}</p>
        </div>
        <Link href={editHref} className="flex items-center gap-1 text-xs font-bold text-indigo-5 hover:text-indigo-7">
          <Pencil className="h-3 w-3" />
          Editeaza
        </Link>
      </div>
      {children}
    </div>
  );
}

export function OrganizerDraftReview() {
  const { draft, resetDraft } = useCompetitionDraft();
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  let parsedSectors: { name: string; minFishNumber: number }[] = [];
  try {
    parsedSectors = draft.lakeSectors.sectors ? JSON.parse(draft.lakeSectors.sectors) : [];
  } catch {
    parsedSectors = [];
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    try {
      await createDraft({
        name: draft.basics.name,
        startDate: draft.basics.startDate,
        endDate: draft.basics.endDate,
        registerFee: draft.basics.registerFee,
        description: draft.basics.description,
      });
      setMessage({ text: "Draft salvat cu succes.", type: "success" });
    } catch {
      setMessage({ text: "Draftul local ramane salvat in browser.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    setIsPublishing(true);
    try {
      const created = await createDraft({
        name: draft.basics.name,
        startDate: draft.basics.startDate,
        endDate: draft.basics.endDate,
        registerFee: draft.basics.registerFee,
      });
      await publishDraft(created.documentId);
      resetDraft();
      setMessage({ text: "Competitia a fost publicata!", type: "success" });
    } catch {
      setMessage({ text: "Publicarea necesita endpoint-urile organizer din Strapi.", type: "error" });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-5 w-5 text-green-7" />
          Revizuire si publicare
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <ReviewSection title="Informatii de baza" icon={Calendar} editHref="/create-competition/basics">
            <p className="text-lg font-bold text-gray-7">{draft.basics.name || "Fara nume"}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-5">
              {draft.basics.startDate && <Badge variant="indigo">{draft.basics.startDate}</Badge>}
              {draft.basics.endDate && <Badge variant="indigo">{draft.basics.endDate}</Badge>}
            </div>
            {draft.basics.registerFee && (
              <p className="mt-2 text-sm font-bold text-indigo-7">{draft.basics.registerFee} lei taxa</p>
            )}
          </ReviewSection>

          <ReviewSection title="Configuratie" icon={Users} editHref="/create-competition/config">
            <div className="flex flex-wrap gap-2">
              <Badge variant={draft.config.competitionType === "team" ? "solidIndigo" : "indigo"}>
                {draft.config.competitionType === "team" ? "Echipe" : "Individual"}
              </Badge>
              {draft.config.participantsLimit && (
                <Badge variant="gray">{draft.config.participantsLimit} locuri</Badge>
              )}
              {draft.config.teamParticipants && draft.config.competitionType === "team" && (
                <Badge variant="gray">{draft.config.teamParticipants} / echipa</Badge>
              )}
            </div>
          </ReviewSection>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ReviewSection title="Clasament" icon={Trophy} editHref="/create-competition/ranking">
            <Badge variant="solidIndigo">{draft.ranking.rankingType}</Badge>
            {draft.ranking.numberOfWinners && (
              <p className="mt-2 text-sm text-gray-5">{draft.ranking.numberOfWinners} castigatori</p>
            )}
          </ReviewSection>

          <ReviewSection title="Balta si sectoare" icon={MapPin} editHref="/create-competition/lake-sectors">
            <p className="font-bold text-gray-7">{draft.lakeSectors.lakeName || "Neselectata"}</p>
            {parsedSectors.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parsedSectors.map((s, i) => (
                  <Badge key={i} variant="indigo">{s.name}</Badge>
                ))}
              </div>
            )}
            {draft.lakeSectors.sponsors && (
              <p className="mt-2 text-xs text-gray-5">Sponsori: {draft.lakeSectors.sponsors}</p>
            )}
          </ReviewSection>
        </div>

        {message && (
          <div className={`rounded-card px-4 py-3 text-sm font-semibold ${message.type === "success" ? "bg-green-2 text-green-7" : "bg-red-1 text-red-5"}`}>
            {message.text}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-1 pt-5">
          <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salveaza ciorna
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing} className="bg-green-7 hover:bg-green-5">
            {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Publica competitia
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
