/**
 * Basic note information from search results
 */
export interface Note {
  title: string;
  content: string;
  author: string;
  url: string;
  likes?: number;
  comments?: number;
  collects?: number;
  tags: string[];
}

/**
 * Detailed note information
 */
export interface NoteDetail extends Note {
  images?: string[];
  publishTime?: string;
  location?: string;
}

/**
 * Comment information
 */
export interface Comment {
  author: string;
  content: string;
  likes: number;
  time: string;
  replies?: Comment[];
} 