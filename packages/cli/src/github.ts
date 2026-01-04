import fetch from 'node-fetch';

export interface GitHubContext {
  repo: string;
  owner: string;
  pullNumber: number;
  sha: string;
  token: string;
}

export function detectGitHubContext(): GitHubContext | null {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!token || !repo || !sha) {
    return null;
  }

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    return null;
  }

  let pullNumber: number | null = null;

  if (eventPath) {
    try {
      const fs = require('fs');
      const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      pullNumber = event.pull_request?.number || null;
    } catch {
      pullNumber = null;
    }
  }

  if (!pullNumber && process.env.GITHUB_REF) {
    const prMatch = process.env.GITHUB_REF.match(/refs\/pull\/(\d+)\/merge/);
    if (prMatch) {
      pullNumber = parseInt(prMatch[1], 10);
    }
  }

  if (!pullNumber) {
    return null;
  }

  return {
    repo: repoName,
    owner,
    pullNumber,
    sha,
    token,
  };
}

const COMMENT_MARKER = '<!-- ai-gatekeeper-summary -->';

export interface Comment {
  id: number;
  body: string;
}

export function findExistingComment(comments: Comment[]): Comment | undefined {
  return comments.find((c) => c.body?.includes(COMMENT_MARKER));
}

export async function postOrUpdatePRComment(
  context: GitHubContext,
  body: string
): Promise<void> {
  const bodyWithMarker = `${COMMENT_MARKER}\n${body}`;

  const apiUrl = `https://api.github.com/repos/${context.owner}/${context.repo}/issues/${context.pullNumber}/comments`;

  try {
    const listResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!listResponse.ok) {
      if (listResponse.status === 403) {
        throw new Error(
          'Permission denied. This may occur when the PR is from a fork. ' +
          'Grant write permissions to GITHUB_TOKEN or check workflow permissions.'
        );
      }
      if (listResponse.status === 404) {
        throw new Error(
          'PR not found. This may occur when the PR is from a fork without read access.'
        );
      }
      throw new Error(`Failed to list comments: ${listResponse.status} ${listResponse.statusText}`);
    }

    const comments = (await listResponse.json()) as Comment[];
    const existingComment = findExistingComment(comments);

    if (existingComment) {
      const updateUrl = `https://api.github.com/repos/${context.owner}/${context.repo}/issues/comments/${existingComment.id}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${context.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: bodyWithMarker }),
      });

      if (!updateResponse.ok) {
        if (updateResponse.status === 403) {
          throw new Error(
            'Permission denied when updating comment. This may occur when the PR is from a fork.'
          );
        }
        throw new Error(`Failed to update comment: ${updateResponse.status} ${updateResponse.statusText}`);
      }
    } else {
      const createResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${context.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: bodyWithMarker }),
      });

      if (!createResponse.ok) {
        if (createResponse.status === 403) {
          throw new Error(
            'Permission denied when creating comment. This may occur when the PR is from a fork.'
          );
        }
        throw new Error(`Failed to create comment: ${createResponse.status} ${createResponse.statusText}`);
      }
    }
  } catch (error) {
    throw error;
  }
}
