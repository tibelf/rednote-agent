import * as XLSX from 'xlsx';
import { Note, Comment } from '../types/note';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

interface NoteRow {
  id: number;
  title: string;
  content: string;
  tags: string;
  author: string;
  imgs: string;
  videos: string;
  url: string;
  likes: number;
  collects: number;
  comments: number;
  publishtime: string;
}

interface CommentRow {
  id: number;
  note_id: number;
  parent_id: string;
  author: string;
  content: string;
  likes: number;
  time: string;
  demand: string;
}

export class ExcelExporter {
  private noteIdCounter = 1;
  private commentIdCounter = 1;
  private noteMap = new Map<string, number>(); // url -> id mapping
  private readonly notesFilePath: string;
  private readonly commentsFilePath: string;
  private notesWorkbook: XLSX.WorkBook = XLSX.utils.book_new();
  private commentsWorkbook: XLSX.WorkBook = XLSX.utils.book_new();
  private notesSheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet([]);
  private commentsSheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet([]);

  constructor(notesFilePath: string = 'notes.xlsx', commentsFilePath: string = 'comments.xlsx') {
    this.notesFilePath = notesFilePath;
    this.commentsFilePath = commentsFilePath;
    this.initializeWorkbooks();
  }

  private initializeWorkbooks() {
    // Initialize Notes workbook
    if (fs.existsSync(this.notesFilePath)) {
      this.notesWorkbook = XLSX.readFile(this.notesFilePath);
      this.notesSheet = this.notesWorkbook.Sheets['Notes'];
      const noteRows = XLSX.utils.sheet_to_json<NoteRow>(this.notesSheet);
      
      // Initialize noteIdCounter based on existing data
      if (noteRows.length > 0) {
        const maxId = Math.max(...noteRows.map(row => row.id));
        this.noteIdCounter = maxId + 1;
        // Rebuild noteMap with existing data
        noteRows.forEach(row => this.noteMap.set(row.url, row.id));
      } else {
        this.noteIdCounter = 1;
      }
    } else {
      this.notesWorkbook = XLSX.utils.book_new();
      this.notesSheet = XLSX.utils.json_to_sheet([]);
      XLSX.utils.book_append_sheet(this.notesWorkbook, this.notesSheet, 'Notes');
      this.noteIdCounter = 1;
    }

    // Initialize Comments workbook
    if (fs.existsSync(this.commentsFilePath)) {
      this.commentsWorkbook = XLSX.readFile(this.commentsFilePath);
      this.commentsSheet = this.commentsWorkbook.Sheets['Comments'];
      const commentRows = XLSX.utils.sheet_to_json<CommentRow>(this.commentsSheet);
      
      // Initialize commentIdCounter based on existing data
      if (commentRows.length > 0) {
        const maxId = Math.max(...commentRows.map(row => row.id));
        this.commentIdCounter = maxId + 1;
      } else {
        this.commentIdCounter = 1;
      }
    } else {
      this.commentsWorkbook = XLSX.utils.book_new();
      this.commentsSheet = XLSX.utils.json_to_sheet([]);
      XLSX.utils.book_append_sheet(this.commentsWorkbook, this.commentsSheet, 'Comments');
      this.commentIdCounter = 1;
    }
  }

  private convertNoteToRow(note: Note): NoteRow {
    const id = this.noteIdCounter++;
    this.noteMap.set(note.url, id);
    
    return {
      id,
      title: note.title,
      content: note.content,
      tags: note.tags.join(','),
      author: note.author,
      imgs: '',
      videos: '',
      url: note.url,
      likes: note.likes || 0,
      collects: note.collects || 0,
      comments: note.comments || 0,
      publishtime: note.publishTime || ''
    };
  }

  private convertCommentToRows(comment: Comment, noteId: number, parentId?: number): CommentRow[] {
    const rows: CommentRow[] = [];
    const commentId = this.commentIdCounter++;
    
    // Create row for current comment
    const commentRow: CommentRow = {
      id: commentId,
      note_id: noteId,
      parent_id: parentId ? parentId.toString() : '',
      author: comment.author,
      content: comment.content,
      likes: comment.likes,
      time: comment.time,
      demand: ''
    };
    rows.push(commentRow);

    // Process replies if they exist
    if (comment.replies && comment.replies.length > 0) {
      for (const reply of comment.replies) {
        // Recursively process replies, passing the current comment's ID as parentId
        rows.push(...this.convertCommentToRows(reply, noteId, commentId));
      }
    }

    return rows;
  }

  public appendNote(note: Note) {
    // Convert note to row
    const noteRow = this.convertNoteToRow(note);
    
    // Get existing data
    const existingNotes = XLSX.utils.sheet_to_json<NoteRow>(this.notesSheet);

    // Remove existing note if exists
    const filteredNotes = existingNotes.filter(n => n.url !== note.url);

    // Add new note
    filteredNotes.push(noteRow);

    // Update sheet
    this.notesSheet = XLSX.utils.json_to_sheet(filteredNotes);
    this.notesWorkbook.Sheets['Notes'] = this.notesSheet;

    // Save to file
    XLSX.writeFile(this.notesWorkbook, this.notesFilePath);
  }

  public appendComments(noteUrl: string, comments: Comment[]) {
    // Get note ID from note URL
    const noteId = this.noteMap.get(noteUrl);

    if (!noteId) {
      logger.error(`Note with URL ${noteUrl} not found`);
      return;
    }

    // Get existing comments
    const existingComments = XLSX.utils.sheet_to_json<CommentRow>(this.commentsSheet);

    // Remove existing comments for this note
    const filteredComments = existingComments.filter(c => c.note_id !== noteId);

    // Process each comment and its replies
    const commentRows: CommentRow[] = [];
    for (const comment of comments) {
      // Convert each comment and its replies to rows
      const rows = this.convertCommentToRows(comment, noteId);
      commentRows.push(...rows);
    }

    logger.info(`Adding ${commentRows.length} comment rows for note ${noteId}`);
    
    // Add all new comment rows
    filteredComments.push(...commentRows);

    // Update sheet
    this.commentsSheet = XLSX.utils.json_to_sheet(filteredComments);
    this.commentsWorkbook.Sheets['Comments'] = this.commentsSheet;

    // Save to file
    XLSX.writeFile(this.commentsWorkbook, this.commentsFilePath);
  }

  public appendNoteWithComments(note: Note, comments: Comment[]) {
    this.appendNote(note);
    this.appendComments(note.url, comments);
  }
} 