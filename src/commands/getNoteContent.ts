import { NoteDetail } from '../types/note';
import { logger } from '../utils/logger';
import { RedNoteTools } from '../tools/rednoteTools';

/**
 * Get detailed content of a note by URL
 * @param url The URL of the note
 * @returns Detailed note information
 */
export async function getNoteContent(url: string): Promise<NoteDetail> {
  logger.info(`Getting note content for URL: ${url}`);
  
  try {
    const redNoteTools = new RedNoteTools();
    const noteDetail = await redNoteTools.getNoteContent(url);
    
    logger.info(`Successfully retrieved note: ${noteDetail.title}`);
    return noteDetail;
  } catch (error) {
    logger.error(`Error getting note content for URL ${url}:`, error);
    throw new Error(`Failed to get note content: ${(error as Error).message}`);
  }
}