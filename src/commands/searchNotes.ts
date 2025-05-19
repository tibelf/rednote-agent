import { Note } from '../types/note';
import { logger } from '../utils/logger';
import { RedNoteTools } from '../tools/rednoteTools';

/**
 * Search for notes by keywords
 * @param keywords The search keywords
 * @param limit Maximum number of notes to return
 * @param headless Whether to use headless mode
 * @returns Array of matching notes
 */
export async function searchNotes(keywords: string, limit: number = 10, headless: boolean = false): Promise<Note[]> {
  logger.info(`Searching for notes with keywords: "${keywords}", limit: ${limit}`);
  const tools = new RedNoteTools(headless);
  try {
    await tools.initialize();
    const notes = await tools.searchNotes(keywords, limit);
    logger.info(`Found ${notes.length} notes for keywords: "${keywords}"`);
    return notes;
  } catch (error) {
    logger.error(`Error searching for notes with keywords "${keywords}":`, error);
    throw new Error(`Failed to search for notes: ${(error as Error).message}`);
  } finally {
    await tools.cleanup();
  }
} 