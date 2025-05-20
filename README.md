# RedNote Agent
[中文版本](./README-zh.md) 

A command-line interface (CLI) agent designed for direct interaction with Red
Note (Xiaohongshu) content.

## Features

- **Search Notes**: Search for notes by topic or keyword  
- **Get Note Content**: Retrieve detailed content from a specific note  
- **Get Note Comments**: Fetch comments from a specific note  
- **Full Workflow**: Execute a complete search-view-comment workflow with
  a single command

## Prerequisites

- Node.js version 16 or higher  
- Xiaohongshu account login is required for full functionality

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/rednote-agent.git
   cd rednote-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. (Optional) Install globally:
   ```bash
   npm install -g .
   ```

## Usage

You must initialize login first:
```bash
rednote-agent init
```
This will open a browser window and guide you through logging into your Xiaohongshu account. After login, cookies will be saved for future operations.

### Search Notes

Search for notes by keyword:
```bash
rednote-agent search "food recommendations"
```

Limit the number of results:
```bash
rednote-agent search "food recommendations" --limit 5
```

Search for notes by keyword with headless model:
```bash
rednote-agent search "food recommendations" --headless
```

### Get Note Content

Retrieve detailed content of a specific note:
```bash
rednote-agent get-note "https://www.xiaohongshu.com/explore/12345abcde"
```

### Get Note Comments

Fetch comments of a specific note:
```bash
rednote-agent get-comments "https://www.xiaohongshu.com/explore/12345abcde"
```

Fetch comments of a specific note with headless model:
```bash
rednote-agent get-comments "https://www.xiaohongshu.com/explore/12345abcde" --headless
```

### Full Workflow

Execute the full process (search, get content, get comments) in one command:
```bash
rednote-agent full "food recommendations"
```

Skip content retrieval:
```bash
rednote-agent full "food recommendations" --skip-content
```

Skip comment retrieval:
```bash
rednote-agent full "food recommendations" --skip-comments
```

Use headless model:
```bash
rednote-agent full "food recommendations" --headless
```

## Notes
- This tool uses Playwright for browser automation, which may open a browser window
- You must complete the login process on first use to access other features
- Updates to the Xiaohongshu website may affect tool functionality. Please update to the latest version if issues occur

## License

MIT
