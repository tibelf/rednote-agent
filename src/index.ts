#!/usr/bin/env node

import { Command } from 'commander';
import { searchNotes } from './commands/searchNotes';
import { getNoteContent } from './commands/getNoteContent';
import { getNoteComments } from './commands/getNoteComments';
import { logger } from './utils/logger';
import { Note, Comment, NoteDetail } from './types/note';

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
  .action(async (keywords: string, options: { limit: string }) => {
    try {
      const limit = parseInt(options.limit, 10);
      const notes = await searchNotes(keywords, limit);
      
      if (notes.length === 0) {
        console.log('No notes found for the given keywords.');
        return;
      }
      
      console.log(`Found ${notes.length} notes:`);
      notes.forEach((note: Note, index: number) => {
        console.log(`\n[${index + 1}] ${note.title}`);
        console.log(`Author: ${note.author}`);
        console.log(`Content: ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}`);
        console.log(`Likes: ${note.likes}, Comments: ${note.comments}`);
        console.log(`URL: ${note.url}`);
      });
    } catch (error) {
      logger.error('Error while searching notes:', error);
      console.error('Failed to search notes. See logs for details.');
    }
  });

// Command: get-note
program
  .command('get-note <url>')
  .description('Get detailed content of a note')
  .action(async (url: string) => {
    try {
      const note = await getNoteContent(url);
      console.log(`\nTitle: ${note.title}`);
      console.log(`Author: ${note.author}`);
      console.log(`\nContent:\n${note.content}`);
      console.log(`\nTags: ${note.tags.join(', ')}`);
      console.log(`Likes: ${note.likes}, Collects: ${note.collects}, Comments: ${note.comments}`);
      if (note.images && note.images.length > 0) {
        console.log(`\nImages (${note.images.length}):`);
        note.images.forEach((image: string, index: number) => {
          console.log(`[${index + 1}] ${image}`);
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
  .action(async (url: string) => {
    try {
      const comments = await getNoteComments(url);
      
      if (comments.length === 0) {
        console.log('No comments found for this note.');
        return;
      }
      
      console.log(`\nFound ${comments.length} comments:`);
      comments.forEach((comment: Comment, index: number) => {
        console.log(`\n[${index + 1}] ${comment.author}`);
        console.log(`Content: ${comment.content}`);
        console.log(`Likes: ${comment.likes}, Time: ${comment.time}`);
        
        if (comment.replies && comment.replies.length > 0) {
          console.log(`\n  Replies (${comment.replies.length}):`);
          comment.replies.forEach((reply: Comment, replyIndex: number) => {
            console.log(`  [${replyIndex + 1}] ${reply.author}`);
            console.log(`  Content: ${reply.content}`);
            console.log(`  Likes: ${reply.likes}, Time: ${reply.time}`);
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
  .action(async (keywords: string, options: { limit: string, skipContent: boolean, skipComments: boolean }) => {
    try {
      // Step 1: Search notes
      console.log(`\n--- Searching for notes matching: "${keywords}" ---`);
      const limit = parseInt(options.limit, 10);
      const notes = await searchNotes(keywords, limit);
      
      if (notes.length === 0) {
        console.log('No notes found for the given keywords.');
        return;
      }
      
      // Display notes summary
      console.log(`Found ${notes.length} notes:`);
      notes.forEach((note: Note, index: number) => {
        console.log(`\n[${index + 1}] ${note.title}`);
        console.log(`Author: ${note.author}`);
        console.log(`URL: ${note.url}`);
      });
      
      // Process only the first note for the full workflow
      const selectedNote = notes[0];
      console.log(`\n--- Selected note: "${selectedNote.title}" ---`);
      
      // Step 2: Get note content (if not skipped)
      if (!options.skipContent) {
        console.log('\n--- Getting note content ---');
        const noteDetail = await getNoteContent(selectedNote.url);
        console.log(`\nTitle: ${noteDetail.title}`);
        console.log(`Author: ${noteDetail.author}`);
        console.log(`\nContent:\n${noteDetail.content}`);
        console.log(`\nTags: ${noteDetail.tags.join(', ')}`);
      }
      
      // Step 3: Get comments (if not skipped)
      if (!options.skipComments) {
        console.log('\n--- Getting note comments ---');
        const comments = await getNoteComments(selectedNote.url);
        
        if (comments.length === 0) {
          console.log('No comments found for this note.');
          return;
        }
        
        console.log(`\nFound ${comments.length} comments:`);
        comments.slice(0, 5).forEach((comment: Comment, index: number) => {
          console.log(`\n[${index + 1}] ${comment.author}`);
          console.log(`Content: ${comment.content}`);
          
          if (comment.replies && comment.replies.length > 0) {
            console.log(`  Replies: ${comment.replies.length}`);
          }
        });
        
        if (comments.length > 5) {
          console.log(`\n... and ${comments.length - 5} more comments`);
        }
      }
      
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
  .action(async (options: { timeout: string }) => {
    const { AuthManager } = require('./auth/authManager');
    try {
      const timeout = parseInt(options.timeout, 10);
      console.log(`Starting login process (timeout: ${timeout}s)...`);
      
      const authManager = new AuthManager();
      await authManager.login({ timeout });
      await authManager.cleanup();
      
      console.log('Login successful! Cookie has been saved.');
    } catch (error) {
      logger.error('Error during initialization:', error);
      console.error('Failed to login. See logs for details.');
    }
  });

program.parse(process.argv); 