import { RedNoteTools } from '../tools/rednoteTools';
import { NoteDetail } from '../types/note';
import { logger } from '../utils/logger';

/**
 * Get detailed content of a note by URL
 * @param url The URL of the note
 * @param headless Whether to use headless mode
 * @returns Detailed note information
 */
export async function getNoteContent(url: string, headless: boolean = false): Promise<NoteDetail> {
  const tools = new RedNoteTools(headless);
  try {
    await tools.initialize();
    logger.info(`Getting note content for URL: ${url}`);
    const noteDetail = await tools.getNoteContent(url);
    
    logger.info(`Successfully retrieved note: ${noteDetail.title}`);
    return noteDetail;
  } catch (error) {
    logger.error(`Error getting note content for URL ${url}:`, error);
    throw new Error(`Failed to get note content: ${(error as Error).message}`);
  } finally {
    await tools.cleanup();
  }
}