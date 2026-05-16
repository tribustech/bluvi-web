"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MapPinPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSendLakeRequest } from "@/services/queries/use-lake-requests";

const STORAGE_KEY = "bluvi-lake-request-submitted-at";
const HIDE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function shouldHide(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < HIDE_WINDOW_MS;
}

export function LakeRequestBanner() {
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === "authenticated";
  const [hidden, setHidden] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [lakeName, setLakeName] = useState("");
  const [message, setMessage] = useState("");
  const [submittedJustNow, setSubmittedJustNow] = useState(false);

  const { mutate: send, isPending } = useSendLakeRequest();

  useEffect(() => {
    setHidden(shouldHide());
  }, []);

  if (hidden && !submittedJustNow) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lakeName.trim()) return;
    send(
      { lakeName: lakeName.trim(), message: message.trim() || undefined },
      {
        onSuccess: () => {
          window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
          setSubmittedJustNow(true);
        },
      },
    );
  };

  if (submittedJustNow) {
    return (
      <Card className="border-green-3 bg-green-1">
        <CardContent className="flex items-center gap-3 py-4">
          <MapPinPlus className="h-5 w-5 text-green-7" />
          <p className="text-sm text-gray-7">
            Multumim! Sugestia ta a fost trimisa. O vom analiza in cel mai scurt timp.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-2 bg-indigo-1">
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center gap-3">
          <MapPinPlus className="h-5 w-5 text-indigo-7" />
          <div>
            <p className="text-sm font-bold text-indigo-7">Sugereaza o balta noua</p>
            <p className="text-sm text-gray-6">
              Cunosti o balta care nu e inca pe Bluvi? Spune-ne si o adaugam.
            </p>
          </div>
        </div>

        {!isAuthenticated ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/sign-in">Intra in cont</Link>
          </Button>
        ) : !expanded ? (
          <Button size="sm" onClick={() => setExpanded(true)}>
            Trimite sugestia
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              type="text"
              value={lakeName}
              onChange={(e) => setLakeName(e.target.value)}
              placeholder="Numele baltii"
              className="w-full rounded-card border border-gray-2 bg-white px-3 py-2 text-sm focus:border-indigo-5 focus:outline-none"
              required
              autoFocus
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Detalii (optional): locatie, contact organizator..."
              className="w-full resize-none rounded-card border border-gray-2 bg-white px-3 py-2 text-sm focus:border-indigo-5 focus:outline-none"
              rows={3}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending || !lakeName.trim()}>
                {isPending ? "Se trimite..." : "Trimite"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpanded(false)}
                disabled={isPending}
              >
                Anuleaza
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
