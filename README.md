# RedNote Agent

一个命令行界面代理程序，用于通过直接的方式与小红书（Red Note）内容进行交互。

## 功能特性

- **搜索笔记**: 通过主题或关键词搜索笔记
- **获取笔记内容**: 获取特定笔记的详细内容
- **获取笔记评论**: 获取特定笔记的评论
- **全流程工作**: 在一个命令中执行完整的搜索-查看-评论流程

## 前提条件

- Node.js 16 或更高版本
- 需要小红书账号登录以获取完整功能

## 安装

1. 克隆代码库:
   ```bash
   git clone https://github.com/your-username/rednote-agent.git
   cd rednote-agent
   ```

2. 安装依赖:
   ```bash
   npm install
   ```

3. 构建项目:
   ```bash
   npm run build
   ```

4. 全局安装 (可选):
   ```bash
   npm install -g .
   ```

## 使用方法

首先需要登录初始化:
```bash
rednote-agent init
```
这会打开浏览器并引导你登录小红书账号。登录后cookies会被保存，以便后续操作。

### 搜索笔记

根据关键词搜索笔记:
```bash
rednote-agent search "美食推荐"
```

限制结果数量:
```bash
rednote-agent search "美食推荐" --limit 5
```

### 获取笔记内容

获取特定笔记的详细内容:
```bash
rednote-agent get-note "https://www.xiaohongshu.com/explore/12345abcde"
```

### 获取笔记评论

获取特定笔记的评论:
```bash
rednote-agent get-comments "https://www.xiaohongshu.com/explore/12345abcde"
```

### 全流程工作

执行完整流程(搜索, 获取内容, 获取评论)一键操作:
```bash
rednote-agent full "美食推荐"
```

跳过内容获取:
```bash
rednote-agent full "美食推荐" --skip-content
```

跳过评论获取:
```bash
rednote-agent full "美食推荐" --skip-comments
```

## 注意事项

- 该工具使用Playwright浏览器自动化技术，可能会弹出浏览器窗口
- 首次使用必须完成登录流程才能正常使用其他功能
- 小红书网站更新可能会影响工具功能，如遇问题请更新到最新版本

## License

MIT
