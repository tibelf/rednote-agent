import { Browser, chromium } from 'playwright';
import { logger } from '../utils/logger';
import { CookieManager } from './cookieManager';

interface LoginOptions {
  timeout?: number;
}

export class AuthManager {
  private browser: Browser | null = null;

  constructor() {
    logger.info('Initializing auth manager');
  }

  /**
   * 初始化浏览器
   */
  async getBrowser(): Promise<Browser> {
    try {
      if (!this.browser) {
        logger.info('Launching browser');
        this.browser = await chromium.launch({
          headless: false,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--disable-web-security'
          ]
        });
        logger.info('Browser launched');
      }
      return this.browser;
    } catch (error) {
      logger.error('Error launching browser:', error);
      throw error;
    }
  }

  /**
   * 获取保存的cookies
   */
  async getCookies(): Promise<any[]> {
    return CookieManager.loadCookies();
  }

  /**
   * 登录小红书账号
   */
  async login(options: LoginOptions = {}): Promise<void> {
    logger.info('Starting login process');
    const timeout = options.timeout || 120; // 默认超时2分钟
    const browser = await this.getBrowser();
    let context, page;
    try {
      context = await browser.newContext();
      page = await context.newPage();
      // 1. 访问 explore 页面
      logger.info('Navigating to Xiaohongshu explore page');
      await page.goto('https://www.xiaohongshu.com/explore', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      // 2. 检查是否已登录
      logger.info('Checking if already logged in');
      const alreadyLoggedIn: boolean = await page.evaluate(() => {
        const el = document.querySelector('.user.side-bar-component .channel');
        return !!(el && el.textContent?.trim() === '我');
      });
      if (alreadyLoggedIn) {
        logger.info('Already logged in, saving cookies');
        const cookies = await context.cookies();
        await CookieManager.saveCookies(cookies);
        await page.close();
        await context.close();
        return;
      }
      // 3. 未登录则等待登录框和二维码
      logger.info('Waiting for login dialog');
      await page.waitForSelector('.login-container', { timeout: 30000 });
      logger.info('Waiting for QR code');
      await page.waitForSelector('.qrcode-img', { timeout: 30000 });
      // 4. 提示用户扫码
      logger.info(`Waiting for user to complete login (timeout: ${timeout}s)`);
      console.log(`请在打开的浏览器窗口中扫码登录，超时时间 ${timeout} 秒...`);
      // 5. 等待登录完成
      const startTime = Date.now();
      let isLoggedIn = false;
      while (Date.now() - startTime < timeout * 1000) {
        isLoggedIn = !!(await page.evaluate(() => {
          const el = document.querySelector('.user.side-bar-component .channel');
          return el && el.textContent?.trim() === '我';
        }));
        if (isLoggedIn) {
          logger.info('Login successful');
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!isLoggedIn) {
        throw new Error('Login timed out or failed');
      }
      // 6. 登录成功，保存 cookies
      logger.info('Login successful, saving cookies');
      const cookies = await context.cookies();
      await CookieManager.saveCookies(cookies);
      await page.close();
      await context.close();
      logger.info('Login process completed');
    } catch (error) {
      logger.error('Error during login:', error);
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      throw error;
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up auth manager resources');
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info('Browser closed');
      } catch (error) {
        logger.error('Error closing browser:', error);
      }
    }
  }
} 