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

export async function postOrUpdatePRComment(
  context: GitHubContext,
  body: string
): Promise<void> {
  const commentMarker = '<!-- ai-gate-summary -->';
  const bodyWithMarker = `${commentMarker}\n${body}`;

  const apiUrl = `https://api.github.com/repos/${context.owner}/${context.repo}/issues/${context.pullNumber}/comments`;

  try {
    const listResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${context.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list comments: ${listResponse.statusText}`);
    }

    const comments = (await listResponse.json()) as Array<{
      id: number;
      body: string;
    }>;
    const existingComment = comments.find((c) => c.body?.includes(commentMarker));

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
        throw new Error(`Failed to update comment: ${updateResponse.statusText}`);
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
        throw new Error(`Failed to create comment: ${createResponse.statusText}`);
      }
    }
  } catch (error) {
    throw error;
  }
}
