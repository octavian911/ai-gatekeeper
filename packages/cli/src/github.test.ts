import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findExistingComment, postOrUpdatePRComment, type GitHubContext, type Comment } from './github.js';

describe('GitHub PR Comment Utilities', () => {
  describe('findExistingComment', () => {
    it('should find comment with ai-gatekeeper-summary marker', () => {
      const comments: Comment[] = [
        { id: 1, body: 'Some other comment' },
        { id: 2, body: '<!-- ai-gatekeeper-summary -->\n## Visual Regression Gate: Passed' },
        { id: 3, body: 'Another comment' },
      ];

      const result = findExistingComment(comments);

      expect(result).toBeDefined();
      expect(result?.id).toBe(2);
      expect(result?.body).toContain('ai-gatekeeper-summary');
    });

    it('should return undefined when no marker found', () => {
      const comments: Comment[] = [
        { id: 1, body: 'Some other comment' },
        { id: 2, body: '<!-- old-marker -->\n## Old format' },
      ];

      const result = findExistingComment(comments);

      expect(result).toBeUndefined();
    });

    it('should handle empty comments array', () => {
      const result = findExistingComment([]);

      expect(result).toBeUndefined();
    });

    it('should find marker in middle of long comment', () => {
      const comments: Comment[] = [
        {
          id: 1,
          body: 'prefix content\n<!-- ai-gatekeeper-summary -->\nactual content\nsuffix content',
        },
      ];

      const result = findExistingComment(comments);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });
  });

  describe('postOrUpdatePRComment', () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let context: GitHubContext;

    beforeEach(() => {
      mockFetch = vi.fn();
      global.fetch = mockFetch as any;

      context = {
        owner: 'test-owner',
        repo: 'test-repo',
        pullNumber: 123,
        sha: 'abc123def456',
        token: 'test-token',
      };
    });

    it('should create new comment when no existing comment found', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 999 }),
        });

      await postOrUpdatePRComment(context, 'Test summary');

      expect(mockFetch).toHaveBeenCalledTimes(2);

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api.github.com/repos/test-owner/test-repo/issues/123/comments',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/test-owner/test-repo/issues/123/comments',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('ai-gatekeeper-summary'),
        })
      );
    });

    it('should update existing comment when marker found', async () => {
      const existingComments: Comment[] = [
        { id: 1, body: 'Other comment' },
        { id: 42, body: '<!-- ai-gatekeeper-summary -->\nOld summary' },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => existingComments,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 42 }),
        });

      await postOrUpdatePRComment(context, 'Updated summary');

      expect(mockFetch).toHaveBeenCalledTimes(2);

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://api.github.com/repos/test-owner/test-repo/issues/comments/42',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('Updated summary'),
        })
      );
    });

    it('should throw descriptive error for 403 permission denied on list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(postOrUpdatePRComment(context, 'Test')).rejects.toThrow(
        'Permission denied'
      );
      await expect(postOrUpdatePRComment(context, 'Test')).rejects.toThrow('fork');
    });

    it('should throw descriptive error for 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(postOrUpdatePRComment(context, 'Test')).rejects.toThrow('PR not found');
      await expect(postOrUpdatePRComment(context, 'Test')).rejects.toThrow('fork');
    });

    it('should throw descriptive error for 403 on update', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: 42, body: '<!-- ai-gatekeeper-summary -->\nOld' },
          ],
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        });

      await expect(postOrUpdatePRComment(context, 'Test')).rejects.toThrow(
        'Permission denied when updating comment'
      );
    });

    it('should throw descriptive error for 403 on create', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        });

      await expect(postOrUpdatePRComment(context, 'Test')).rejects.toThrow(
        'Permission denied when creating comment'
      );
    });

    it('should preserve marker in body for both create and update', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 1 }),
        });

      await postOrUpdatePRComment(context, '## Test Summary');

      const createCall = mockFetch.mock.calls[1][1];
      const body = JSON.parse(createCall.body).body;

      expect(body).toContain('<!-- ai-gatekeeper-summary -->');
      expect(body).toContain('## Test Summary');
    });
  });
});
