import { AuthManager } from '../auth/authManager';
import { Browser, Page } from 'playwright';
import { logger } from '../utils/logger';
import { GetNoteDetail, NoteDetail } from './noteDetail';

export interface Note {
  title: string
  content: string
  tags: string[]
  url: string
  author: string
  likes?: number
  collects?: number
  comments?: number
  publishTime?: string
}



export interface Comment {
  author: string
  content: string
  likes: number
  time: string
  replies?: Comment[]
}

interface ScrollState {
  previousTop: number
  newTop: number
  height: number
  client: number
  remaining: number
  scrolled: boolean
}

interface ScrollResult {
  reachedEnd: boolean
  message: string
  hasEndText: boolean
  scrollState?: ScrollState
  error?: string
  debug?: { selectors: string[]; tested: boolean }
}

export class RedNoteTools {
  private authManager: AuthManager
  private browser: Browser | null = null
  private page: Page | null = null
  private headless: boolean = false

  constructor(headless: boolean = false) {
    logger.info('Initializing RedNoteTools')
    this.authManager = new AuthManager()
    this.headless = headless
  }

  /**
   * Convert relative time to YYYY-MM-DD format
   * @param timeStr Time string to convert
   * @returns Formatted date string
   */
  private convertToStandardDate(timeStr: string): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentYear = now.getFullYear();
    
    // 处理"今天"的情况
    if (timeStr.includes('今天')) {
      return today.toISOString().split('T')[0];
    }
    
    // 处理"昨天"的情况
    if (timeStr.includes('昨天')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    }
    
    // 处理"X天前"的情况
    const daysAgoMatch = timeStr.match(/(\d+)\s*天前/);
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1]);
      const date = new Date(today);
      date.setDate(date.getDate() - days);
      return date.toISOString().split('T')[0];
    }
    
    // 处理"X个月前"的情况
    const monthsAgoMatch = timeStr.match(/(\d+)\s*个月前/);
    if (monthsAgoMatch) {
      const months = parseInt(monthsAgoMatch[1]);
      const date = new Date(today);
      date.setMonth(date.getMonth() - months);
      return date.toISOString().split('T')[0];
    }
    
    // 处理"X年前"的情况
    const yearsAgoMatch = timeStr.match(/(\d+)\s*年前/);
    if (yearsAgoMatch) {
      const years = parseInt(yearsAgoMatch[1]);
      const date = new Date(today);
      date.setFullYear(date.getFullYear() - years);
      return date.toISOString().split('T')[0];
    }
    
    // 处理"MM-DD"格式
    const shortDateMatch = timeStr.match(/(\d{2})-(\d{2})/);
    if (shortDateMatch) {
      const month = parseInt(shortDateMatch[1]);
      const day = parseInt(shortDateMatch[2]);
      return `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }
    
    // 处理"YYYY-MM-DD"格式
    const fullDateMatch = timeStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (fullDateMatch) {
      return timeStr;
    }
    
    // 如果无法解析，返回空字符串
    return '';
  }

  async initialize(): Promise<void> {
    logger.info('Initializing browser and page')
    this.browser = await this.authManager.getBrowser(this.headless)
    if (!this.browser) {
      throw new Error('Failed to initialize browser')
    }
    
    try {
      this.page = await this.browser.newPage()
      
      // Load cookies if available
      const cookies = await this.authManager.getCookies()
      if (cookies.length > 0) {
        logger.info(`Loading ${cookies.length} cookies`)
        await this.page.context().addCookies(cookies)
      }

      // Check login status
      logger.info('Checking login status')
      await this.page.goto('https://www.xiaohongshu.com')
      const isLoggedIn = await this.page.evaluate(() => {
        const sidebarUser = document.querySelector('.user.side-bar-component .channel')
        return sidebarUser?.textContent?.trim() === '我'
      })

      // If not logged in, perform login
      if (!isLoggedIn) {
        logger.error('Not logged in, please login first')
        throw new Error('Not logged in')
      }
      logger.info('Login status verified')
    } catch (error) {
      // 初始化过程中出错，确保清理资源
      await this.cleanup()
      throw error
    }
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up browser resources')
    try {
      if (this.page) {
        await this.page.close().catch(err => logger.error('Error closing page:', err))
        this.page = null
      }
      
      if (this.browser) {
        await this.browser.close().catch(err => logger.error('Error closing browser:', err))
        this.browser = null
      }
    } catch (error) {
      logger.error('Error during cleanup:', error)
    } finally {
      this.page = null
      this.browser = null
    }
  }

  extractRedBookUrl(shareText: string): string {
    // 匹配 http://xhslink.com/ 开头的链接
    const xhslinkRegex = /(https?:\/\/xhslink\.com\/[a-zA-Z0-9\/]+)/i
    const xhslinkMatch = shareText.match(xhslinkRegex)

    if (xhslinkMatch && xhslinkMatch[1]) {
      return xhslinkMatch[1]
    }

    // 匹配 https://www.xiaohongshu.com/ 开头的链接
    const xiaohongshuRegex = /(https?:\/\/(?:www\.)?xiaohongshu\.com\/[^，\s]+)/i
    const xiaohongshuMatch = shareText.match(xiaohongshuRegex)

    if (xiaohongshuMatch && xiaohongshuMatch[1]) {
      return xiaohongshuMatch[1]
    }

    return shareText
  }

  async searchNotes(keywords: string, limit: number = 10): Promise<Note[]> {
    logger.info(`Searching notes with keywords: ${keywords}, limit: ${limit}`)
    try {
      await this.initialize()
      if (!this.page) throw new Error('Page not initialized')

      // Navigate to search page
      logger.info('Navigating to search page')
      await this.page.goto(`https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(keywords)}`)

      // Wait for search results to load
      logger.info('Waiting for search results')
      await this.page.waitForSelector('.feeds-container', {
        timeout: 30000
      })

      // Get all note items
      let noteItems = await this.page.$$('.feeds-container .note-item')
      logger.info(`Found ${noteItems.length} note items`)
      const notes: Note[] = []

      // Process each note
      for (let i = 0; i < Math.min(noteItems.length, limit); i++) {
        logger.info(`Processing note ${i + 1}/${Math.min(noteItems.length, limit)}`)
        try {
          // Wait for the note cover to be visible and clickable
          await this.page.waitForSelector('a.cover.mask.ld', {
            state: 'visible',
            timeout: 3000
          }).catch(() => {
            logger.warn('Note cover not immediately visible, continuing anyway')
          })

          // Try to click the note cover with retry logic
          let retryCount = 0
          const maxRetries = 3
          while (retryCount < maxRetries) {
            try {
              await noteItems[i].$eval('a.cover.mask.ld', (el: HTMLElement) => el.click())
              break
            } catch (error) {
              retryCount++
              if (retryCount === maxRetries) {
                throw error
              }
              logger.warn(`Failed to click note cover, retry ${retryCount}/${maxRetries}`)
              await this.page.waitForTimeout(1000)
            }
          }

          // Wait for the note page to load
          logger.info('Waiting for note page to load')
          await this.page.waitForSelector('#noteContainer', {
            timeout: 30000
          })

          await this.randomDelay(0.5, 1.5)

          // 设置监听器来捕获页面中的所有控制台日志
          this.page.on('console', message => {
            console.log(`浏览器控制台: ${message.text()}`);
          });
          // Extract note content
          const note = await this.page.evaluate(() => {
            const article = document.querySelector('#noteContainer')
            if (!article) return null

            // Get title
            const titleElement = article.querySelector('#detail-title')
            const title = titleElement?.textContent?.trim() || ''

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
            const authorElement = article.querySelector('.author-wrapper .username')
            const author = authorElement?.textContent?.trim() || ''

            // Get interaction counts from engage-bar
            const engageBar = document.querySelector('.engage-bar-style')
            const likesElement = engageBar?.querySelector('.like-wrapper .count')
            const likes = parseInt(likesElement?.textContent?.replace(/[^\d]/g, '') || '0')

            const collectElement = engageBar?.querySelector('.collect-wrapper .count')
            const collects = parseInt(collectElement?.textContent?.replace(/[^\d]/g, '') || '0')

            const commentsElement = engageBar?.querySelector('.chat-wrapper .count')
            const comments = parseInt(commentsElement?.textContent?.replace(/[^\d]/g, '') || '0')

            // Get tags
            const tagElements = article.querySelectorAll('#detail-desc a.tag');
            const tags = Array.from(tagElements).map(el => el.textContent?.replace(/^#/, '').trim()).filter(Boolean);

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

            return {
              title,
              content,
              url: window.location.href,
              author,
              likes,
              collects,
              comments,
              tags,
              publishTime
            }
          })

          if (note) {
            logger.info(`Extracted note: ${note.title}`)
            notes.push(note as Note)
          }

          // Add random delay before closing
          await this.randomDelay(0.5, 1)

          // Close note by clicking the close button
          const closeButton = await this.page.$('.close-circle')
          if (closeButton) {
            logger.info('Closing note dialog')
            await closeButton.click()

            // Wait for note dialog to disappear
            await this.page.waitForSelector('#noteContainer', {
              state: 'detached',
              timeout: 30000
            })
          }
        } catch (error) {
          logger.error(`Error processing note ${i + 1}:`, error)
          const closeButton = await this.page.$('.close-circle')
          if (closeButton) {
            logger.info('Attempting to close note dialog after error')
            await closeButton.click()

            // Wait for note dialog to disappear
            await this.page.waitForSelector('#noteContainer', {
              state: 'detached',
              timeout: 30000
            })
          }
        } finally {
          // Add random delay before next note
          await this.randomDelay(0.5, 1.5)
        }
      }

      logger.info(`Successfully processed ${notes.length} notes`)
      return notes
    } catch (error) {
      logger.error('Error searching notes:', error)
      throw error
    } finally {
      await this.cleanup()
    }
  }

  async getNoteContent(url: string): Promise<NoteDetail> {
    logger.info(`Getting note content for URL: ${url}`)
    try {
      await this.initialize()
      if (!this.page) throw new Error('Page not initialized')

      const actualURL = this.extractRedBookUrl(url)
      await this.page.goto(actualURL)
      let note = await GetNoteDetail(this.page)
      note.url = url
      logger.info(`Successfully extracted note: ${note.title}`)
      return note
    } catch (error) {
      logger.error('Error getting note content:', error)
      throw error
    } finally {
      await this.cleanup()
    }
  }

  async getNoteComments(url: string): Promise<Comment[]> {
    logger.debug(`Getting comments for URL: ${url}`)
    try {
      await this.initialize()
      if (!this.page) throw new Error('Page not initialized')

      const actualURL = this.extractRedBookUrl(url)
      logger.debug(`Navigating to URL: ${actualURL}`)
      await this.page.goto(actualURL)

      // 获取评论总数（只包含一级评论）
      const commentCount = await this.page.evaluate(() => {
        // 尝试多种选择器来获取评论总数
        const selectors = [
          '.chat-wrapper .count',
          '.comment-wrapper .count',
          '[class*="comment"] .count',
          '.comment-count',
          '.comment-total',
          '.total-comments',
          '.comment-header .count',
          '.comment-header .total'
        ]

        for (const selector of selectors) {
          const element = document.querySelector(selector)
          if (element) {
            const text = element.textContent || ''
            const count = parseInt(text.replace(/[^\d]/g, ''))
            if (!isNaN(count) && count > 0) {
              return count
            }
          }
        }

        // 如果通过选择器没有找到，尝试从评论列表获取
        const commentItems = document.querySelectorAll('.comment-item, .comment-card, [class*="comment-item"]')
        return commentItems.length
      })

      logger.debug(`Expected total comments: ${commentCount}`)

      if (commentCount === 0) {
        logger.debug('No comments found')
        return []
      }

      // 点击评论按钮
      logger.debug('Clicking comment button')
      await this.page.click('.chat-wrapper, .comment-wrapper, [class*="comment"]')

      // 等待评论对话框出现
      logger.debug('Waiting for comments dialog')
      await this.page.waitForSelector('.comment-modal, .comments-popup, [role="dialog"], .comments-container')

      // 等待第一条评论加载
      await this.page.waitForSelector('.comment-item, .comment-card, [class*="comment-item"]')
      await this.page.waitForTimeout(2000) // 等待评论列表完全显示

      //调用滚动加载评论方法
      await this.scrollAndLoadAllComments(this.page)

      // 调用提取出来的滚动加载评论方法
      const allComments = await this.scrollAndCollectAllComments(this.page, commentCount)

      // 统计所有评论（一级+二级）总数，并在主循环体内判断是否 break
      const totalComments = allComments.reduce((sum, comment) => {
        return sum + 1 + (Array.isArray(comment.replies) ? comment.replies.length : 0);
      }, 0);

      logger.debug(`Final comments count: ${totalComments}/${commentCount}`)
      if (totalComments < commentCount) {
        logger.debug(`Warning: Only retrieved ${totalComments} comments out of ${commentCount}`)
      }

      return allComments
    } catch (error) {
      logger.error('Error getting comments:', error)
      throw error
    } finally {
      await this.cleanup()
    }
  }

  /**
   * 滚动并收集所有评论
   */
  private async scrollAndCollectAllComments(page: Page, commentCount: number): Promise<Comment[]> {
    let allComments: Comment[] = []
    while (true) {
      // 获取当前可见的评论
      const currentComments = await page.evaluate(() => {
        // 新的提取逻辑：遍历所有 parent-comment
        function extractContentWithEmoji(contentNode: Node): string {
          if (!contentNode) return '';
          let result = '';
          contentNode.childNodes.forEach((node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              result += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'IMG' && (node as HTMLElement).classList.contains('note-content-emoji')) {
              const src = (node as HTMLImageElement).getAttribute('src');
              result += src ? `[emoji:${src}]` : '[emoji]';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              result += extractContentWithEmoji(node);
            }
          });
          return result.trim();
        }

        const parentBlocks = document.querySelectorAll('.parent-comment')

        // logger.debug('Print parentBlocks')
        // parentBlocks.forEach(block => logger.debug(block))

        return Array.from(parentBlocks)
          .map(block => {
            // 一级评论（主评论）
            const mainComment = block.querySelector('.comment-item:not(.comment-item-sub)');
            if (!mainComment) return null;
            const author = mainComment.querySelector('.user-name, .nickname, [class*="user-name"], [class*="nickname"], .author')?.textContent?.trim() || '';
            const contentElem = mainComment.querySelector('.content, .desc, .text, [class*="content"], .comment-text');
            let content = contentElem ? extractContentWithEmoji(contentElem) : '';
            // 新增：查找图片
            const pictureImgs = block.querySelectorAll('.comment-picture img');
            pictureImgs.forEach(img => {
              const src = img.getAttribute('src');
              if (src) content += `[image:${src}]`;
            });
            // 如果内容为空但有图片，返回特殊标记
            if (!content.trim() && pictureImgs.length > 0) {
              content = '[图片评论]';
            }
            const likesText = mainComment.querySelector('.like-count, .likes, [class*="like"], .digg-count')?.textContent?.trim() || '0';
            const timeText = mainComment.querySelector('.time, .date, [class*="time"], .create-time')?.textContent?.trim() || '';
            const likes = parseInt(likesText.replace(/[^\d]/g, '')) || 0;

            // 二级评论（回复）
            const replyNodes = block.querySelectorAll('.comment-item.comment-item-sub');
            const replies = Array.from(replyNodes).map(reply => {
              const replyAuthor = reply.querySelector('.user-name, .nickname, [class*="user-name"], [class*="nickname"], .author')?.textContent?.trim() || '';
              const replyContentElem = reply.querySelector('.content, .desc, .text, [class*="content"], .comment-text');
              let replyContent = replyContentElem ? extractContentWithEmoji(replyContentElem) : '';
              // 新增：查找图片
              const replyPictureImgs = reply.querySelectorAll('.comment-picture img');
              replyPictureImgs.forEach(img => {
                const src = img.getAttribute('src');
                if (src) replyContent += `[image:${src}]`;
              });
              if (!replyContent.trim() && replyPictureImgs.length > 0) {
                replyContent = '[图片评论]';
              }
              const replyLikesText = reply.querySelector('.like-count, .likes, [class*="like"], .digg-count')?.textContent?.trim() || '0';
              const replyTimeText = reply.querySelector('.time, .date, [class*="time"], .create-time')?.textContent?.trim() || '';
              const replyLikes = parseInt(replyLikesText.replace(/[^\d]/g, '')) || 0;
              return {
                author: replyAuthor,
                content: replyContent,
                likes: replyLikes,
                time: replyTimeText
              }
            }).filter(reply => reply.author && reply.content);

            return {
              author,
              content,
              likes,
              time: timeText,
              replies
            }
          })
          .filter((comment): comment is { author: string; content: string; likes: number; time: string; replies: any[] } => !!comment && !!comment.author && !!comment.content);
      })

      // 更新评论数组，确保不重复
      const newComments = currentComments.filter(comment => 
        !allComments.some(existing => 
          existing.author === comment.author && 
          existing.content === comment.content &&
          existing.time === comment.time
        )
      )
      
      logger.debug('New comments to be added:')
      newComments.forEach((comment, index) => {
        logger.debug(`${index + 1}. ${comment.author} (${comment.time}): ${comment.content}`)
      })
      // Prepend new comments to maintain correct order
      allComments = [...newComments, ...allComments]

      logger.debug(`Current comments count: ${allComments.length}/${commentCount} (Found ${currentComments.length} in view)`)

      // 统计所有评论（一级+二级）总数，并在主循环体内判断是否 break
      const totalComments = allComments.reduce((sum, comment) => {
        return sum + 1 + (Array.isArray(comment.replies) ? comment.replies.length : 0);
      }, 0);
      if (totalComments >= commentCount) {
        logger.debug('All comments have been collected');
        break;
      }

      // 模拟鼠标滚轮事件
      const scrollResult: ScrollResult = await page.evaluate(() => {
        const selectors = [
          '.comment-list',
          '.comments-list',
          '[class*="comment-list"]',
          '.comment-panel',
          '.comments-panel',
          '[class*="comment-panel"]',
          '.comment-content',
          '.comments-content',
          '[class*="comment-content"]',
          '.scroll-container',
          '.scroll-area',
          '[class*="scroll"]',
          '.comment-modal',
          '.comments-popup',
          '[role="dialog"]',
          '.comments-container'
        ]
        let scrollContainer = null
        for (const selector of selectors) {
          const element = document.querySelector(selector)
          if (element) {
            const style = window.getComputedStyle(element)
            const overflow = style.overflow + style.overflowY
            const height = element.scrollHeight
            const clientHeight = element.clientHeight
            if ((overflow.includes('scroll') || overflow.includes('auto')) && height > clientHeight) {
              scrollContainer = element
              break
            }
          }
        }
        if (!scrollContainer) {
          // logger.debug('No scrollable container found')
          return { 
            reachedEnd: true, 
            message: 'No scrollable container found', 
            hasEndText: false,
            debug: { selectors, tested: true }
          }
        }
        // 检查是否已经到达底部（是否出现 THE END）
        const endText = Array.from(scrollContainer.querySelectorAll('*')).find(el => 
          el.textContent?.trim().toUpperCase().includes('THE END')
        )
        logger.debug('endText ', endText)
        if (endText) {
          // logger.debug('THE END text detected in comments dialog')
          return { 
            reachedEnd: true, 
            message: 'THE END text detected in comments dialog',
            hasEndText: true
          }
        }
        // 获取滚动状态
        const scrollTop = scrollContainer.scrollTop
        const scrollHeight = scrollContainer.scrollHeight
        const clientHeight = scrollContainer.clientHeight
        const remainingScroll = scrollHeight - scrollTop - clientHeight
        // logger.debug('Initial scroll state:', {
        //   scrollTop,
        //   scrollHeight,
        //   clientHeight,
        //   remainingScroll
        // })
        try {
          const newScrollTop = scrollTop + 500
          scrollContainer.scrollTop = newScrollTop
          scrollContainer.scrollTo({
            top: newScrollTop,
            behavior: 'smooth'
          })
          return new Promise<ScrollResult>(resolve => {
            setTimeout(() => {
              const newScrollTop = scrollContainer.scrollTop
              const scrolled = newScrollTop > scrollTop
              logger.debug('After scroll:', {
                previousTop: scrollTop,
                newTop: newScrollTop,
                scrolled
              })
              resolve({
                reachedEnd: false,
                message: scrolled ? 'Scroll successful' : 'Scroll may not have worked',
                hasEndText: false,
                scrollState: {
                  previousTop: scrollTop,
                  newTop: newScrollTop,
                  height: scrollHeight,
                  client: clientHeight,
                  remaining: remainingScroll,
                  scrolled: scrolled
                }
              })
            }, 100)
          })
        } catch (error) {
          // logger.error('Scroll error:', error)
          return {
            reachedEnd: false,
            message: 'Error during scroll attempt',
            hasEndText: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      })
      // 输出调试信息
      if (scrollResult.debug) {
        logger.debug('Debug info:', scrollResult.debug)
      }
      if (scrollResult.reachedEnd) {
        logger.debug(scrollResult.message)
        if (scrollResult.hasEndText) {
          logger.debug('THE END text was found in the dialog')
        }
        break
      }
      if (scrollResult.scrollState) {
        logger.debug(`Scroll state - Previous Top: ${scrollResult.scrollState.previousTop}, New Top: ${scrollResult.scrollState.newTop}, Height: ${scrollResult.scrollState.height}, Client: ${scrollResult.scrollState.client}, Remaining: ${scrollResult.scrollState.remaining}, Scrolled: ${scrollResult.scrollState.scrolled}`)
      }
      if (scrollResult.error) {
        logger.error('Scroll error:', scrollResult.error)
      }
      // 等待内容加载
      await page.waitForTimeout(2000)
      // 检查是否有新评论加载
      const newCommentsLoaded = await page.evaluate(() => {
        const commentItems = document.querySelectorAll('.comment-item, .comment-card, [class*="comment-item"]')
        return commentItems.length > 0
      })
      if (!newCommentsLoaded) {
        logger.debug('No new comments loaded after scroll, might have reached the end')
        break
      }
    }
    return allComments
  }

  /**
   * 展开所有评论区的"展开"、"展开更多回复"、"展开 X 条回复"等按钮
   */
  private async expandAllCommentReplies(page: Page): Promise<void> {
    let hasMore = true;
    let round = 0;
    while (hasMore) {
      round++;
      logger.debug(`expandAllCommentReplies - Round ${round}: start searching for expandable buttons...`);
      hasMore = await page.evaluate(() => {
        const expandSelectors = [
          'div.show-more'
        ];
        const keywords = [
          '展开',
          '展开更多回复',
          '更多回复',
          '更多评论',
          '展开全部',
          '展开回复',
          '展开 \\d+ 条回复',
          '展开\\d+条回复',
          '展开\\s*\\d+\\s*条',
          'Show more',
          'More replies',
          'Show all',
        ];
        const keywordReg = new RegExp(keywords.join('|'));
        const candidates: HTMLElement[] = [];
        expandSelectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            if (
              el instanceof HTMLElement &&
              el.offsetParent !== null &&
              !el.hasAttribute('data-expanded')
            ) {
              const text = el.textContent?.trim() || '';
              if (keywordReg.test(text)) {
                candidates.push(el);
              }
            }
          });
        });
        // logger.debug(`expandAllCommentReplies - Found ${candidates.length} expandable buttons in this round.`);
        if (candidates.length > 0) {
          // 标记已点击，防止死循环
          candidates[0].setAttribute('data-expanded', 'true');
          candidates[0].click();
          // logger.debug('expandAllCommentReplies - Clicked expand button:', candidates[0].textContent);
          return true;
        }
        return false;
      });
      if (hasMore) {
        logger.debug(`expandAllCommentReplies - Waiting for content to load after click in round ${round}...`);
        await page.waitForTimeout(500);
      }
    }
    logger.debug('expandAllCommentReplies - No more expandable buttons found, finished expanding all.');
  }

  /**
   * 只滚动并看完所有评论（不收集评论内容，仅判断 THE END）
   */
  private async scrollAndLoadAllComments(page: Page): Promise<void> {
    while (true) {
      // 获取当前可见的评论数，仅做日志
      const commentCountInView = await page.evaluate(() => {
        const commentItems = document.querySelectorAll('.comment-item, .comment-card, [class*="comment-item"]')
        // logger.debug('Found comment elements:', commentItems.length)
        // 调试：输出所有评论元素的信息
        Array.from(commentItems).forEach((item, index) => {
          const author = item.querySelector('.user-name, .nickname, [class*="user-name"], [class*="nickname"], .author')?.textContent?.trim() || ''
          const time = item.querySelector('.time, .date, [class*="time"], .create-time')?.textContent?.trim() || ''
          // logger.debug(`Comment ${index + 1}:`, { author, time })
        })
        return commentItems.length
      })
      logger.debug(`scrollAndLoadAllComments - Current comments in view: ${commentCountInView}`)
      
      // 展开所有评论回复
      await this.expandAllCommentReplies(page);
      // 等待内容加载
      await page.waitForTimeout(2000)
      // 检查是否有新评论加载

      // 滚动逻辑与原函数一致
      const scrollResult: ScrollResult = await page.evaluate(() => {
        const selectors = [
          '.comment-list',
          '.comments-list',
          '[class*="comment-list"]',
          '.comment-panel',
          '.comments-panel',
          '[class*="comment-panel"]',
          '.comment-content',
          '.comments-content',
          '[class*="comment-content"]',
          '.scroll-container',
          '.scroll-area',
          '[class*="scroll"]',
          '.comment-modal',
          '.comments-popup',
          '[role="dialog"]',
          '.comments-container'
        ];
        let scrollContainer = null;
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            const style = window.getComputedStyle(element);
            const overflow = style.overflow + style.overflowY;
            const height = element.scrollHeight;
            const clientHeight = element.clientHeight;
            if ((overflow.includes('scroll') || overflow.includes('auto')) && height > clientHeight) {
              scrollContainer = element;
              break;
            }
          }
        }
        if (!scrollContainer) {
          // logger.debug('scrollAndLoadAllComments - No scrollable container found')
          return { 
            reachedEnd: true, 
            message: 'scrollAndLoadAllComments - No scrollable container found', 
            hasEndText: false,
            debug: { selectors, tested: true }
          }
        }
        // 检查是否已经到达底部（是否出现 THE END）
        const endText = Array.from(scrollContainer.querySelectorAll('*')).find(el => 
          el.textContent?.trim().toUpperCase().includes('THE END')
        )
        // logger.debug('endText ', endText)
        if (endText) {
          // logger.debug('scrollAndLoadAllComments - THE END text detected in comments dialog')
          return { 
            reachedEnd: true, 
            message: 'scrollAndLoadAllComments - THE END text detected in comments dialog',
            hasEndText: true
          }
        }
        // 获取滚动状态
        const scrollTop = scrollContainer.scrollTop
        const scrollHeight = scrollContainer.scrollHeight
        const clientHeight = scrollContainer.clientHeight
        const remainingScroll = scrollHeight - scrollTop - clientHeight
        // logger.debug('scrollAndLoadAllComments - Initial scroll state:', {
        //   scrollTop,
        //   scrollHeight,
        //   clientHeight,
        //   remainingScroll
        // })
        try {
          const newScrollTop = scrollTop + 500
          scrollContainer.scrollTop = newScrollTop
          scrollContainer.scrollTo({
            top: newScrollTop,
            behavior: 'smooth'
          })
          return new Promise<ScrollResult>(resolve => {
            setTimeout(() => {
              const newScrollTop = scrollContainer.scrollTop
              const scrolled = newScrollTop > scrollTop
              // logger.debug('scrollAndLoadAllComments - After scroll:', {
              //   previousTop: scrollTop,
              //   newTop: newScrollTop,
              //   scrolled
              // })
              resolve({
                reachedEnd: false,
                message: scrolled ? 'Scroll successful' : 'Scroll may not have worked',
                hasEndText: false,
                scrollState: {
                  previousTop: scrollTop,
                  newTop: newScrollTop,
                  height: scrollHeight,
                  client: clientHeight,
                  remaining: remainingScroll,
                  scrolled: scrolled
                }
              })
            }, 100)
          })
        } catch (error) {
          // logger.error('scrollAndLoadAllComments - Scroll error:', error)
          return {
            reachedEnd: false,
            message: 'scrollAndLoadAllComments - Error during scroll attempt',
            hasEndText: false,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      })
      // 输出调试信息
      if (scrollResult.debug) {
        logger.debug('scrollAndLoadAllComments - Debug info:', scrollResult.debug)
      }
      if (scrollResult.reachedEnd) {
        logger.debug(scrollResult.message)
        if (scrollResult.hasEndText) {
          logger.debug('scrollAndLoadAllComments - THE END text was found in the dialog')
        }
        break
      }
      if (scrollResult.scrollState) {
        logger.debug(`scrollAndLoadAllComments - Scroll state - Previous Top: ${scrollResult.scrollState.previousTop}, New Top: ${scrollResult.scrollState.newTop}, Height: ${scrollResult.scrollState.height}, Client: ${scrollResult.scrollState.client}, Remaining: ${scrollResult.scrollState.remaining}, Scrolled: ${scrollResult.scrollState.scrolled}`)
      }
      if (scrollResult.error) {
        logger.error('scrollAndLoadAllComments - Scroll error:', scrollResult.error)
      }
      // 展开所有评论回复
      await this.expandAllCommentReplies(page);
      // 等待内容加载
      await page.waitForTimeout(2000)
      // 检查是否有新评论加载
      const newCommentsLoaded = await page.evaluate(() => {
        const commentItems = document.querySelectorAll('.comment-item, .comment-card, [class*="comment-item"]')
        return commentItems.length > 0
      })
      if (!newCommentsLoaded) {
        logger.debug('scrollAndLoadAllComments - No new comments loaded after scroll, might have reached the end')
        break
      }
    }
  }

  /**
   * Wait for a random duration between min and max seconds
   * @param min Minimum seconds to wait
   * @param max Maximum seconds to wait
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min
    logger.debug(`Adding random delay of ${delay.toFixed(2)} seconds`)
    await new Promise((resolve) => setTimeout(resolve, delay * 1000))
  }
}
