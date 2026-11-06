/** @format */
import { getUrl } from "../shared";
import { APAxios } from "../utils";

export type RecentSubmission = {
  id: string;
  titleSlug: string;
  /** Unix seconds, as a string. */
  timestamp: string;
  /** "Accepted", "Wrong Answer", "Time Limit Exceeded", etc. */
  statusDisplay: string;
  lang: string;
};

const graphql = async (
  query: string,
  variables: Record<string, unknown>,
): Promise<any> => {
  const res = await APAxios(getUrl("graphql"), {
    method: "POST",
    data: { query, variables },
  });
  const errors = res.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(errors.map((e: any) => e?.message ?? String(e)).join("; "));
  }
  return res.data?.data;
};

const recentSubmissionsQuery = `
    query recentSubmissions($username: String!, $limit: Int) {
        recentSubmissionList(username: $username, limit: $limit) {
            id
            titleSlug
            timestamp
            statusDisplay
            lang
        }
    }
`;

/**
 * Recent submissions for a user, newest first. Unlike interpret_solution this
 * is a plain GraphQL read, not blocked by Cloudflare TLS fingerprinting.
 */
export const recentSubmissions = async (
  username: string,
  limit: number = 20,
): Promise<RecentSubmission[]> => {
  const data = await graphql(recentSubmissionsQuery, { username, limit });
  return data?.recentSubmissionList ?? [];
};

const submissionDetailsQuery = `
    query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
            code
            lang {
                name
            }
        }
    }
`;

/**
 * Fetches the exact code judged by LeetCode for a submission.
 */
export const submissionDetails = async (
  submissionId: string,
): Promise<{ code: string; lang: string } | undefined> => {
  const data = await graphql(submissionDetailsQuery, {
    submissionId: Number(submissionId),
  });
  const details = data?.submissionDetails;

  if (!details?.code) {
    return undefined;
  }
  return {
    code: details.code,
    lang: (details.lang?.name ?? "").toLowerCase(),
  };
};
