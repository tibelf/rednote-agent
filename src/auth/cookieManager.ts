import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger';

// 定义cookie的存储路径
export const COOKIE_PATH = path.join(os.homedir(), '.rednote-agent', 'cookies.json');

/**
 * Cookie管理器，用于保存和加载cookie
 */
export class CookieManager {
  /**
   * 保存cookie到本地文件
   * @param cookies 要保存的cookie数组
   */
  static async saveCookies(cookies: any[]): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(COOKIE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 保存cookie
      await fs.promises.writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2));
      logger.info(`Cookies saved to ${COOKIE_PATH}`);
    } catch (error) {
      logger.error('Error saving cookies:', error);
      throw error;
    }
  }

  /**
   * 从本地文件加载cookie
   * @returns 加载的cookie数组
   */
  static async loadCookies(): Promise<any[]> {
    try {
      if (!fs.existsSync(COOKIE_PATH)) {
        logger.info('No cookies file found');
        return [];
      }

      const data = await fs.promises.readFile(COOKIE_PATH, 'utf8');
      const cookies = JSON.parse(data);
      logger.info(`Loaded ${cookies.length} cookies from ${COOKIE_PATH}`);
      return cookies;
    } catch (error) {
      logger.error('Error loading cookies:', error);
      return [];
    }
  }
} 