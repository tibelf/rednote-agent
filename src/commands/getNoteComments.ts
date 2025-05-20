import { Comment } from '../types/note';
import { logger } from '../utils/logger';
import { RedNoteTools } from '../tools/rednoteTools';

/**
 * Get comments for a note by URL
 * @param url The URL of the note
 * @param headless Whether to use headless mode
 * @returns Array of comments for the note
 */
export async function getNoteComments(url: string, headless: boolean = false): Promise<Comment[]> {
  const tools = new RedNoteTools(headless);
  try {
    logger.info(`Getting comments for URL: ${url}`);
    const comments = await tools.getNoteComments(url);
    // 统计评论总数（一级评论+回复）
    const totalComments = comments.reduce((sum, comment) => {
      return sum + 1 + (Array.isArray(comment.replies) ? comment.replies.length : 0);
    }, 0);
    logger.info(`Found ${comments.length} comments with a total of ${totalComments} comments+replies for URL: ${url}`);
    return comments;
  } catch (error) {
    logger.error(`Error getting comments for URL ${url}:`, error);
    throw new Error(`Failed to get comments: ${(error as Error).message}`);
  }
}