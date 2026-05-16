export type PollSuggestedBy = {
  id: number;
  name: string;
};

export type PollOption = {
  id: number;
  documentId: string;
  title: string;
  description: string | null;
  order: number;
  votesCount: number;
  suggestedBy: PollSuggestedBy | null;
};

export type Poll = {
  id: number;
  documentId: string;
  title: string;
  description: string | null;
  closesAt: string;
  closedAt?: string | null;
  votingClosed: boolean;
  totalVotes: number;
  myVoteOptionId: number | null;
  options: PollOption[];
};

export type PollVoteRequest = {
  pollId: string;
  optionId: number;
};

export type PollSuggestRequest = {
  pollId: string;
  text: string;
};

export type PastPollsPage = {
  data: Poll[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};
