import { Page } from 'playwright';
import { logger } from '../utils/logger';

export interface NoteDetail {
  title: string;
  content: string;
  tags: string[];
  url: string;
  author: string;
  likes?: number;
  collects?: number;
  comments?: number;
  images?: string[];
  publishTime?: string;
  location?: string;
}

export async function GetNoteDetail(page: Page): Promise<NoteDetail> {
  logger.info('Getting note detail');

  try {
    // Wait for note container to be visible
    await page.waitForSelector('#noteContainer', { timeout: 30000 });

    // Extract note details
    const noteDetail = await page.evaluate(() => {
      const article = document.querySelector('#noteContainer') as HTMLElement;
      if (!article) {
        return null;
      }

      // Get title
      const titleElement = article.querySelector('#detail-title');
      const title = titleElement?.textContent?.trim() || '';

      // Get content
      const contentElement = article.querySelector('#detail-desc .note-text');
      const content = contentElement?.textContent?.trim() || '';

      // Get author info
      const authorElement = article.querySelector('.author-wrapper .username');
      const author = authorElement?.textContent?.trim() || '';

      // Get interaction counts from engage-bar
      const engageBar = document.querySelector('.engage-bar-style') as HTMLElement;
      const likesElement = engageBar?.querySelector('.like-wrapper .count');
      const likes = parseInt(likesElement?.textContent?.replace(/[^\d]/g, '') || '0');

      const collectElement = engageBar?.querySelector('.collect-wrapper .count');
      const collects = parseInt(collectElement?.textContent?.replace(/[^\d]/g, '') || '0');

      const commentsElement = engageBar?.querySelector('.chat-wrapper .count');
      const comments = parseInt(commentsElement?.textContent?.replace(/[^\d]/g, '') || '0');

      // Get publish time
      const publishTimeElement = article.querySelector('.publish-time');
      const publishTime = publishTimeElement?.textContent?.trim() || '';

      // Get location if available
      const locationElement = article.querySelector('.location-wrapper');
      const location = locationElement?.textContent?.trim() || '';

      // Get tags
      const tagElements = article.querySelectorAll('.tag-item');
      const tags = Array.from(tagElements).map(tag => tag.textContent?.trim() || '').filter(Boolean);

      // Get images
      const imageElements = article.querySelectorAll('.carousel-image');
      const images: string[] = [];
      
      // Check if there are images in the carousel
      if (imageElements.length > 0) {
        imageElements.forEach(img => {
          const src = (img as HTMLImageElement).src;
          if (src) images.push(src);
        });
      } else {
        // Try alternative image selectors if carousel not found
        const altImgElements = article.querySelectorAll('.note-image, .images-wrapper img, .carousel-container img');
        altImgElements.forEach(img => {
          const src = (img as HTMLImageElement).src;
          if (src) images.push(src);
        });
      }

      return {
        title,
        content,
        tags,
        author,
        likes,
        collects,
        comments,
        images,
        publishTime,
        location,
        url: window.location.href
      };
    });

    if (!noteDetail) {
      throw new Error('Failed to extract note details');
    }

    logger.info(`Successfully extracted note: ${noteDetail.title}`);
    return noteDetail;
  } catch (error) {
    logger.error('Error getting note detail:', error);
    throw error;
  }
} 