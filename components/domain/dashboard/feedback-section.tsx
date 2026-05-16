"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSendFeedback } from "@/services/queries/use-feedback";
import type { FeedbackCategory } from "@/types";

const STORAGE_KEY = "bluvi-feedback-submitted-at";
const HIDE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const CATEGORIES: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "feature", label: "Idee de feature" },
  { value: "technical", label: "Problema tehnica" },
  { value: "content", label: "Continut" },
  { value: "account", label: "Cont" },
  { value: "ui", label: "Interfata" },
  { value: "other", label: "Altceva" },
];

const RATING_EMOJI = ["😞", "🙁", "😐", "🙂", "😄"];

function shouldHide(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < HIDE_WINDOW_MS;
}

export function FeedbackSection() {
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === "authenticated";
  const [hidden, setHidden] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [text, setText] = useState("");
  const [submittedJustNow, setSubmittedJustNow] = useState(false);

  const { mutate: send, isPending } = useSendFeedback();

  useEffect(() => {
    setHidden(shouldHide());
  }, []);

  if (!isAuthenticated) return null;
  if (hidden && !submittedJustNow) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rating || !text.trim()) return;
    send(
      { rating, category, feedback: text.trim() },
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
      <Card className="border-l-4 border-l-green-5">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="rounded-full bg-green-2 p-2 text-green-7">
            <Lightbulb className="h-5 w-5" />
          </div>
          <p className="text-sm text-gray-7">
            Multumim pentru feedback! Echipa l-a primit si il va analiza.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-yellow-5">
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-yellow-1 p-2 text-yellow-6">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-7">Ai sugestii sau intrebari?</p>
            <p className="text-sm text-gray-5">
              Spune-ne ce poate fi mai bun. Citim fiecare mesaj.
            </p>
          </div>
        </div>

        {!expanded ? (
          <Button size="sm" onClick={() => setExpanded(true)}>
            Trimite feedback
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-5">Cum a fost?</p>
              <div className="flex gap-2">
                {RATING_EMOJI.map((emoji, index) => {
                  const value = index + 1;
                  const isSelected = rating === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border text-xl transition-colors",
                        isSelected
                          ? "border-indigo-5 bg-indigo-1"
                          : "border-gray-2 bg-white hover:border-indigo-3",
                      )}
                      aria-label={`Rating ${value}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-5">Categorie</p>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className="w-full rounded-card border border-gray-2 bg-white px-3 py-2 text-sm focus:border-indigo-5 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Spune-ne mai multe..."
              className="w-full resize-none rounded-card border border-gray-2 bg-white px-3 py-2 text-sm focus:border-indigo-5 focus:outline-none"
              rows={4}
              required
            />

            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !rating || !text.trim()}
              >
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
