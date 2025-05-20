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
      const contentElement = article.querySelector('#detail-desc .note-text')
      function getTextWithoutLinks(ele: any) {
        let text = '';
        for (const node of ele.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
          } else if (
            node.nodeType === Node.ELEMENT_NODE &&
            !(node.tagName && node.tagName.toLowerCase() === 'a')
          ) {
            text += getTextWithoutLinks(node);
          }
        }
        return text;
      }
      const content = contentElement ? getTextWithoutLinks(contentElement).trim() : ''

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

      // Get tags
      const tagElements = article.querySelectorAll('#detail-desc a.tag');
      const tags = Array.from(tagElements).map(tag => tag.textContent?.replace(/^#/, '').trim() || '').filter(Boolean);
      // const tags = Array.from(tagElements).map(tag => tag.textContent?.trim() || '').filter(Boolean);

      // Get publish time and location
      const publishTimeElement = article.querySelector('.bottom-container .date');
      //console.log("publishTImeElement is " + publishTimeElement)
      let publishTime = '';
      let location = '';

      if (publishTimeElement) {
        const fullText = publishTimeElement.textContent?.trim() || '';
        //console.log("fullText is " + fullText)
        // 分离时间和地点
        const parts = fullText.split(/\s+/);
        //console.log("parts is " + parts)
        
        // 处理时间部分
        if (parts.length > 0) {
          // 检查第一个部分是否为"编辑于"，如果是，则取第二个部分作为时间
          let timeStr = '';
          let startIndex = 0;
          
          if (parts[0] === '编辑于') {
            timeStr = parts[1]; // 直接取第二个部分作为时间字符串
            startIndex = 1;
            console.log("检测到'编辑于'前缀，使用第二个部分作为时间:", timeStr);
          } else if (parts[0].includes('编辑于')) {
            // 如果"编辑于"是第一个部分的一部分，则去除该前缀
            timeStr = parts[0].replace('编辑于', '').trim();
            console.log("检测到'编辑于'内嵌前缀，移除后:", timeStr);
          } else {
            timeStr = parts[0];
            console.log("使用第一个部分作为时间:", timeStr);
          }
                    
          // 日期转换逻辑
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const currentYear = now.getFullYear();
          
          // 处理"今天"的情况
          if (timeStr.includes('今天')) {
            publishTime = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          }
          // 处理"昨天"的情况
          else if (timeStr.includes('昨天')) {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            publishTime = `${currentYear}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
          }
          // 处理"X天前"的情况
          else if (timeStr.match(/\d+\s*天前/)) {
            const daysAgoMatch = timeStr.match(/(\d+)\s*天前/);
            if (daysAgoMatch) {
              const days = parseInt(daysAgoMatch[1]);
              const date = new Date(today);
              date.setDate(date.getDate() - days);
              publishTime = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
          }
          // 处理"X个月前"的情况
          else if (timeStr.match(/\d+\s*个月前/)) {
            const monthsAgoMatch = timeStr.match(/(\d+)\s*个月前/);
            if (monthsAgoMatch) {
              const months = parseInt(monthsAgoMatch[1]);
              const date = new Date(today);
              date.setMonth(date.getMonth() - months);
              publishTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
          }
          // 处理"X年前"的情况
          else if (timeStr.match(/\d+\s*年前/)) {
            const yearsAgoMatch = timeStr.match(/(\d+)\s*年前/);
            if (yearsAgoMatch) {
              const years = parseInt(yearsAgoMatch[1]);
              const date = new Date(today);
              date.setFullYear(date.getFullYear() - years);
              publishTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
          }
          // 处理"X小时前"的情况
          else if (timeStr.match(/\d+\s*小时前/)) {
            const hoursAgoMatch = timeStr.match(/(\d+)\s*小时前/);
            if (hoursAgoMatch) {
              publishTime = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            }
          }
          // 处理"X分钟前"的情况
          else if (timeStr.match(/\d+\s*分钟前/)) {
            const minutesAgoMatch = timeStr.match(/(\d+)\s*分钟前/);
            if (minutesAgoMatch) {
              publishTime = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            }
          }
          // 处理"MM-DD"格式 (支持单位数月份和日期)
          else if (timeStr.match(/(\d{1,2})-(\d{1,2})/)) {
            const shortDateMatch = timeStr.match(/(\d{1,2})-(\d{1,2})/);
            if (shortDateMatch) {
              const month = parseInt(shortDateMatch[1]);
              const day = parseInt(shortDateMatch[2]);
              publishTime = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            }
          }
          // 处理"YYYY-MM-DD"格式
          else if (timeStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)) {
            const fullDateMatch = timeStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (fullDateMatch) {
              const year = parseInt(fullDateMatch[1]);
              const month = parseInt(fullDateMatch[2]);
              const day = parseInt(fullDateMatch[3]);
              publishTime = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            }
          }

          // 如果时间解析失败，使用原始文本
          if (publishTime === '') {
            publishTime = fullText;
          }
        }
      }

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