#!/usr/bin/env node

import { Command } from 'commander';
import { searchNotes } from './commands/searchNotes';
import { getNoteContent } from './commands/getNoteContent';
import { getNoteComments } from './commands/getNoteComments';
import { logger } from './utils/logger';
import { Note, Comment, NoteDetail } from './types/note';
import { ExcelExporter } from './utils/excel';

// Initialize the CLI
const program = new Command();

program
  .name('rednote-agent')
  .description('CLI agent to interact with Xiaohongshu (RedNote) content')
  .version('0.1.0');

// Command: search
program
  .command('search <keywords>')
  .description('Search for notes by topic/keywords')
  .option('-l, --limit <number>', 'Maximum number of notes to return', '10')
  .option('-h, --headless', 'Run in headless mode')
  .action(async (keywords: string, options: { limit: string, headless: boolean }) => {
    try {
      const limit = parseInt(options.limit, 10);
      const notes = await searchNotes(keywords, limit, options.headless);
      
      if (notes.length === 0) {
        logger.info('No notes found for the given keywords.');
        return;
      }
      
      logger.info(`Found ${notes.length} notes:`);
      notes.forEach((note: Note, index: number) => {
        logger.info(`\n[${index + 1}]`);
        logger.info(`\nTitle: ${note.title}`);
        logger.info(`Author: ${note.author}`);
        logger.info(`\nContent:\n${note.content}`);
        logger.info(`\nTags: ${note.tags.join(', ')}`);
        logger.info(`Likes: ${note.likes}, Collects: ${note.collects}, Comments: ${note.comments}`);
        logger.info(`URL: ${note.url}`);
        logger.info(`Publish Time: ${note.publishTime}`);
      });
    } catch (error) {
      logger.error('Error while searching notes:', error);
      logger.error('Failed to search notes. See logs for details.');
    }
  });

// Command: get-note
program
  .command('get-note <url>')
  .description('Get detailed content of a note')
  .option('-h, --headless', 'Run in headless mode')
  .action(async (url: string, options: { headless: boolean }) => {
    try {
      const note = await getNoteContent(url, options.headless);
      logger.info(`\nTitle: ${note.title}`);
      logger.info(`Author: ${note.author}`);
      logger.info(`Content:\n${note.content}`);
      logger.info(`\nTags: ${note.tags.join(', ')}`);
      logger.info(`Likes: ${note.likes}, Collects: ${note.collects}, Comments: ${note.comments}`);
      if (note.images && note.images.length > 0) {
        logger.info(`\nImages (${note.images.length}):`);
        note.images.forEach((image: string, index: number) => {
          logger.info(`[${index + 1}] ${image}`);
        });
      }
    } catch (error) {
      logger.error('Error while getting note content:', error);
      console.error('Failed to get note content. See logs for details.');
    }
  });

// Command: get-comments
program
  .command('get-comments <url>')
  .description('Get comments for a note')
  .option('-h, --headless', 'Run in headless mode')
  .action(async (url: string, options: { headless: boolean }) => {
    try {
      const comments = await getNoteComments(url, options.headless);
      
      if (comments.length === 0) {
        logger.info('No comments found for this note.');
        return;
      }
      
      logger.info(`\nFound ${comments.length} comments:`);
      comments.forEach((comment: Comment, index: number) => {
        logger.info(`\n[${index + 1}] ${comment.author}`);
        logger.info(`Content: ${comment.content}`);
        logger.info(`Likes: ${comment.likes}, Time: ${comment.time}`);
        
        if (comment.replies && comment.replies.length > 0) {
          logger.info(`\n  Replies (${comment.replies.length}):`);
          comment.replies.forEach((reply: Comment, replyIndex: number) => {
            logger.info(`  [${replyIndex + 1}] ${reply.author}`);
            logger.info(`  Content: ${reply.content}`);
            logger.info(`  Likes: ${reply.likes}, Time: ${reply.time}`);
          });
        }
      });
    } catch (error) {
      logger.error('Error while getting comments:', error);
      console.error('Failed to get comments. See logs for details.');
    }
  });

// Command: full
program
  .command('full <keywords>')
  .description('Perform a full workflow: search notes, get content, and comments')
  .option('-l, --limit <number>', 'Maximum number of notes to return in search', '5')
  .option('-s, --skip-content', 'Skip retrieving full note content')
  .option('-c, --skip-comments', 'Skip retrieving note comments')
  .option('-h, --headless', 'Run in headless mode')
  .action(async (keywords: string, options: { limit: string, skipContent: boolean, skipComments: boolean, headless: boolean }) => {
    try {
      // Step 1: Search notes
      logger.info(`\n--- Searching for notes matching: "${keywords}" ---`);
      const limit = parseInt(options.limit, 10);
      const notes = await searchNotes(keywords, limit, options.headless);
      
      if (notes.length === 0) {
        logger.info('No notes found for the given keywords.');
        return;
      }
      
      // Display notes summary
      logger.info(`Found ${notes.length} notes:`);
      notes.forEach((note: Note, index: number) => {
        logger.info(`\n[${index + 1}] ${note.title}`);
        logger.info(`Author: ${note.author}`);
        logger.info(`URL: ${note.url}`);
      });
      
      // Initialize Excel exporter
      const excelExporter = new ExcelExporter();
      
      // Process notes one by one
      for (const note of notes) {
        logger.info(`\n--- Processing note: "${note.title}" ---`);
        
        let noteDetail: NoteDetail | undefined;
        let comments: Comment[] = [];
        
        // Step 2: Get note content (if not skipped)
        if (!options.skipContent) {
          logger.info('\n--- Getting note content ---');
          noteDetail = await getNoteContent(note.url, options.headless);
          logger.info(`\nTitle: ${noteDetail.title}`);
          logger.info(`Author: ${noteDetail.author}`);
          logger.info(`\nContent:\n${noteDetail.content}`);
          logger.info(`\nTags: ${noteDetail.tags.join(', ')}`);
        }
        
        // Step 3: Get comments (if not skipped)
        if (!options.skipComments) {
          logger.info('\n--- Getting note comments ---');
          comments = await getNoteComments(note.url, options.headless);
          
          if (comments.length === 0) {
            logger.info('No comments found for this note.');
          } else {
            logger.info(`\nFound ${comments.length} comments:`);
            comments.forEach((comment: Comment, index: number) => {
              logger.info(`\n[${index + 1}] ${comment.author}`);
              logger.info(`Content: ${comment.content}`);
              logger.info(`Likes: ${comment.likes}, Time: ${comment.time}`);
              
              if (comment.replies && comment.replies.length > 0) {
                logger.info(`\n  Replies (${comment.replies.length}):`);
                comment.replies.forEach((reply: Comment, replyIndex: number) => {
                  logger.info(`  [${replyIndex + 1}] ${reply.author}`);
                  logger.info(`  Content: ${reply.content}`);
                  logger.info(`  Likes: ${reply.likes}, Time: ${reply.time}`);
                });
              }
            });
          }
        }

        // Save note and its comments to Excel
        excelExporter.appendNoteWithComments(noteDetail || note, comments);
        logger.info(`\n--- Note "${note.title}" has been saved to notes.xlsx ---`);
      }
      
      logger.info('\n--- All notes have been processed and saved to notes.xlsx ---');
      
    } catch (error) {
      logger.error('Error during full workflow:', error);
      console.error('Failed to complete the full workflow. See logs for details.');
    }
  });

// Command: login
program
  .command('init')
  .description('Initialize and login to RedNote')
  .option('-t, --timeout <seconds>', 'Login timeout in seconds', '120')
  .option('-h, --headless', 'Run in headless mode')
  .action(async (options) => {
    const { AuthManager } = require('./auth/authManager');
    try {
      const timeout = parseInt(options.timeout, 10);
      logger.info(`Starting login process (timeout: ${timeout}s)...`);
      
      const authManager = new AuthManager();
      await authManager.login({ 
        timeout,
        headless: options.headless
      });
      await authManager.cleanup();
      
      logger.info('Login successful! Cookie has been saved.');
    } catch (error) {
      logger.error('Error during initialization:', error);
      console.error('Failed to login. See logs for details.');
    }
  });

program.parse(process.argv); 