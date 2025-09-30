'use server';

import 'server-only';
import { z } from 'zod';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER || "YOUR_USER_OR_ORG";
const REPO_NAME = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : "crewsphere";

const EmptySchema = z.object({});

export interface PullRequestInfo {
    count: number;
    url: string;
}

/**
 * Fetches the count of open pull requests from the GitHub repository.
 * @returns A promise that resolves to an object containing the count and a URL to the PRs page.
 */
export async function getOpenPullRequests(): Promise<PullRequestInfo> {
    EmptySchema.parse({}); // Zod validation

    const pullRequestsUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/pulls`;

    if (!GITHUB_TOKEN) {
        console.warn("GITHUB_TOKEN is not set. Cannot fetch open pull requests.");
        return { count: 0, url: pullRequestsUrl };
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=open`, {
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
            },
            next: {
                revalidate: 300, // Cache for 5 minutes
            },
        });

        if (!response.ok) {
            console.error(`GitHub API request failed: ${response.status} ${response.statusText}`);
            return { count: 0, url: pullRequestsUrl };
        }

        const prs = await response.json();
        return { count: prs.length, url: pullRequestsUrl };

    } catch (error) {
        console.error("Error fetching open pull requests from GitHub:", error);
        return { count: 0, url: pullRequestsUrl };
    }
}
