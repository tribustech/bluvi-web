import type {
  PastPollsPage,
  Poll,
  PollSuggestRequest,
  PollVoteRequest,
} from "@/types/poll";
import { getJson, postJson, putJson } from "./_shared";

export async function fetchCurrentPoll(): Promise<Poll | null> {
  try {
    const response = await getJson<{ data: Poll | null }>("/polls/current");
    return response.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchPastPolls(
  params: { page?: number; pageSize?: number } = {},
): Promise<PastPollsPage | null> {
  try {
    return await getJson<PastPollsPage>("/polls/past", {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
    });
  } catch {
    return null;
  }
}

export async function castPollVote({ pollId, optionId }: PollVoteRequest) {
  return putJson(`/polls/${pollId}/vote`, { optionId });
}

export async function submitPollSuggestion({
  pollId,
  text,
}: PollSuggestRequest) {
  return postJson(`/polls/${pollId}/suggest`, { text });
}
