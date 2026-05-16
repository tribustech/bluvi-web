"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Circle, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePollCurrent, usePollVote } from "@/services/queries/use-polls";
import type { Poll, PollOption } from "@/types";

function getPercent(option: PollOption, totalVotes: number) {
  if (totalVotes <= 0) return 0;
  return Math.round((option.votesCount / totalVotes) * 100);
}

function PollCardInner({ poll }: { poll: Poll }) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { mutate: vote, isPending } = usePollVote();
  const [pendingSelection, setPendingSelection] = useState<number | null>(null);

  const totalVotes = poll.totalVotes ?? 0;
  const myVoteOptionId = poll.myVoteOptionId;
  const votingClosed = poll.votingClosed;

  const handleOptionClick = (optionId: number) => {
    if (votingClosed) return;
    if (!isAuthenticated) return;
    if (pendingSelection === optionId) {
      setPendingSelection(null);
      return;
    }
    if (myVoteOptionId === optionId && pendingSelection === null) return;
    setPendingSelection(optionId);
  };

  const submitVote = () => {
    if (pendingSelection === null) return;
    const optionId = pendingSelection;
    setPendingSelection(null);
    vote({ pollId: poll.documentId, optionId });
  };

  const buttonLabel = myVoteOptionId === null ? "Voteaza" : "Schimba votul";

  return (
    <Card className="border-indigo-2 bg-indigo-1">
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-indigo-7" />
          <h2 className="text-xl font-bold text-gray-7">{poll.title}</h2>
        </div>

        {poll.description ? (
          <p className="text-sm text-gray-6">{poll.description}</p>
        ) : null}

        <ul className="space-y-2">
          {poll.options.map((option) => {
            const isSelectedByMe = myVoteOptionId === option.id;
            const isPending = pendingSelection === option.id;
            const isActive = isSelectedByMe || isPending;
            const percent = getPercent(option, totalVotes);

            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => handleOptionClick(option.id)}
                  disabled={votingClosed || !isAuthenticated}
                  className={cn(
                    "relative flex w-full items-center gap-3 overflow-hidden rounded-card border bg-white p-3 text-left transition-colors",
                    isActive
                      ? "border-indigo-5 bg-indigo-1"
                      : "border-gray-2 hover:border-indigo-3",
                    (votingClosed || !isAuthenticated) && "cursor-not-allowed opacity-90",
                  )}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-indigo-2/60 transition-[width]"
                    style={{ width: `${percent}%` }}
                  />
                  {isActive ? (
                    <CheckCircle2 className="relative z-10 h-5 w-5 shrink-0 text-indigo-7" />
                  ) : (
                    <Circle className="relative z-10 h-5 w-5 shrink-0 text-gray-4" />
                  )}
                  <span className="relative z-10 flex-1 text-sm font-medium text-gray-7">
                    {option.title}
                  </span>
                  <span className="relative z-10 text-sm font-bold text-gray-6">{percent}%</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-gray-5">{totalVotes} {totalVotes === 1 ? "vot" : "voturi"}</p>
          {votingClosed ? (
            <p className="text-xs font-bold text-red-6">Votare inchisa</p>
          ) : isAuthenticated ? (
            <Button
              size="sm"
              onClick={submitVote}
              disabled={pendingSelection === null || isPending}
            >
              {buttonLabel}
            </Button>
          ) : (
            <Button size="sm" asChild variant="outline">
              <Link href="/sign-in">Intra in cont sa votezi</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function PollCard() {
  const { data: poll, isLoading } = usePollCurrent();

  if (isLoading) return null;
  if (!poll) return null;

  return <PollCardInner poll={poll} />;
}
