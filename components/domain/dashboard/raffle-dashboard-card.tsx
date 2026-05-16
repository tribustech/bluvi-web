"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Gift, Trophy, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveRaffle, useRaffleParticipation } from "@/services/queries/use-raffle";
import {
  useDeleteRaffleReceipt,
  useJoinRaffle,
  useUploadRaffleReceipt,
} from "@/services/queries/use-mutations";
import type { RaffleActiveResponse, RaffleParticipation } from "@/types";

function useCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [targetIso]);

  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, ended: false };
}

interface InnerProps {
  raffle: RaffleActiveResponse;
  participation: RaffleParticipation | null | undefined;
}

function RaffleInner({ raffle, participation }: InnerProps) {
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === "authenticated";
  const { session, isRegistrationOpen, isEnded, hasWinners } = raffle;
  const countdown = useCountdown(session.endDate);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: joinRaffle, isPending: joining } = useJoinRaffle();
  const { mutate: uploadReceipt, isPending: uploading } = useUploadRaffleReceipt();
  const { mutate: deleteReceipt, isPending: deleting } = useDeleteRaffleReceipt();

  const types = session.types ?? [];
  const prizes = session.prizes ?? [];
  const totalPrizeCount = prizes.reduce((sum, p) => sum + (p.count ?? 0), 0);

  const handleJoin = (typeKey: string) => {
    if (!isAuthenticated) return;
    joinRaffle({ sessionDocumentId: session.documentId, typeKey });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadReceipt({ raffleId: session.documentId, file });
    event.target.value = "";
  };

  const handleDeleteReceipt = () => {
    deleteReceipt(session.documentId);
  };

  if (isEnded && hasWinners) {
    return (
      <Card className="border-l-4 border-l-yellow-5">
        <CardContent className="flex items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-1 p-2 text-yellow-6">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-7">Tombola s-a incheiat</p>
              <p className="text-sm text-gray-5">Vezi castigatorii sesiunii curente.</p>
            </div>
          </div>
          <Button asChild>
            <Link href={`/raffle/${session.documentId}`}>Vezi castigatori</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-indigo-5">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-2 p-2 text-indigo-7">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-7">
                {session.dashboardTitle ?? "Tombola"}
              </p>
              {session.dashboardSubtitle ? (
                <p className="text-sm text-gray-5">{session.dashboardSubtitle}</p>
              ) : null}
            </div>
          </div>
          {totalPrizeCount > 0 ? (
            <span className="rounded-full bg-indigo-2 px-3 py-1 text-xs font-bold text-indigo-7">
              {totalPrizeCount} {totalPrizeCount === 1 ? "premiu" : "premii"}
            </span>
          ) : null}
        </div>

        {countdown && !countdown.ended ? (
          <div className="grid grid-cols-4 gap-2 rounded-card bg-gray-1 p-3">
            <CountdownUnit value={countdown.days} label="zile" />
            <CountdownUnit value={countdown.hours} label="ore" />
            <CountdownUnit value={countdown.minutes} label="min" />
            <CountdownUnit value={countdown.seconds} label="sec" />
          </div>
        ) : null}

        {!isAuthenticated ? (
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-in">Intra in cont pentru a participa</Link>
          </Button>
        ) : participation?.joined ? (
          <ParticipationStatus
            participation={participation}
            uploading={uploading}
            deleting={deleting}
            onUploadClick={handleUploadClick}
            onDeleteClick={handleDeleteReceipt}
          />
        ) : isRegistrationOpen ? (
          <JoinControls types={types} disabled={joining} onJoin={handleJoin} />
        ) : (
          <p className="text-sm text-gray-7">Inscrierile au fost inchise.</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-bold tabular-nums text-gray-7">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs uppercase tracking-wider text-gray-5">{label}</span>
    </div>
  );
}

function JoinControls({
  types,
  disabled,
  onJoin,
}: {
  types: NonNullable<RaffleActiveResponse["session"]["types"]>;
  disabled: boolean;
  onJoin: (typeKey: string) => void;
}) {
  if (!types.length) {
    return (
      <Button className="w-full" disabled={disabled} onClick={() => onJoin("default")}>
        Inscrie-te
      </Button>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {types.map((type) => (
        <Button
          key={type.key}
          variant="outline"
          disabled={disabled}
          onClick={() => onJoin(type.key)}
        >
          {type.label}
        </Button>
      ))}
    </div>
  );
}

function ParticipationStatus({
  participation,
  uploading,
  deleting,
  onUploadClick,
  onDeleteClick,
}: {
  participation: RaffleParticipation;
  uploading: boolean;
  deleting: boolean;
  onUploadClick: () => void;
  onDeleteClick: () => void;
}) {
  if (!participation.receiptUploaded) {
    return (
      <div className="space-y-3 rounded-card bg-gray-1 p-3">
        <p className="text-sm text-gray-7">
          Esti inscris. Incarca bonul de cumparaturi pentru a valida participarea.
        </p>
        <Button onClick={onUploadClick} disabled={uploading} className="w-full">
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Se incarca..." : "Incarca bon"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-card bg-gray-1 p-3">
      <p className="text-sm font-bold text-green-7">
        {participation.receiptUnderVerification
          ? "Bon incarcat, in curs de verificare"
          : "Bon incarcat si validat"}
      </p>
      <div className="flex gap-2">
        <Button onClick={onUploadClick} disabled={uploading} variant="outline" className="flex-1">
          {uploading ? "Se incarca..." : "Inlocuieste bon"}
        </Button>
        <Button
          onClick={onDeleteClick}
          disabled={deleting}
          variant="outline"
          className="flex-1 text-red-6"
        >
          {deleting ? "Se sterge..." : "Sterge bon"}
        </Button>
      </div>
    </div>
  );
}

export function RaffleDashboardCard() {
  const { data: raffle, isLoading: raffleLoading } = useActiveRaffle();
  const { data: participation } = useRaffleParticipation();

  if (raffleLoading) return null;
  if (!raffle?.session?.documentId) return null;

  return <RaffleInner raffle={raffle} participation={participation} />;
}
