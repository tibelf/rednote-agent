import { Note } from '../types/note';
import { logger } from '../utils/logger';
import { RedNoteTools } from '../tools/rednoteTools';

/**
 * Search for notes by keywords
 * @param keywords The search keywords
 * @param limit Maximum number of notes to return
 * @returns Array of matching notes
 */
export async function searchNotes(keywords: string, limit: number = 10): Promise<Note[]> {
  logger.info(`Searching for notes with keywords: "${keywords}", limit: ${limit}`);
  
  try {
    const redNoteTools = new RedNoteTools();
    const notes = await redNoteTools.searchNotes(keywords, limit);
    
    logger.info(`Found ${notes.length} notes for keywords: "${keywords}"`);
    return notes;
  } catch (error) {
    logger.error(`Error searching for notes with keywords "${keywords}":`, error);
    throw new Error(`Failed to search for notes: ${(error as Error).message}`);
  }
} 