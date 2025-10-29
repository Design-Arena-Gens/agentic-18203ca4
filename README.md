# AI Personal Agent with Notion MCP - Telegram Bot

A Telegram bot that serves as your AI personal assistant with full Notion integration using the Model Context Protocol (MCP). Powered by Claude AI.

## Features

- Natural language conversation with Claude AI
- Full Notion workspace integration via MCP
- Search and query Notion databases
- Create and update Notion pages
- Retrieve database information
- Append content to pages
- Conversational interface through Telegram

## Prerequisites

1. **Telegram Bot Token**: Create a bot via [@BotFather](https://t.me/botfather) on Telegram
2. **Anthropic API Key**: Get from [Anthropic Console](https://console.anthropic.com/)
3. **Notion Integration Token**: Create an integration at [Notion Integrations](https://www.notion.so/my-integrations)
   - After creating the integration, share your Notion pages/databases with it

## Setup

### Local Development

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ANTHROPIC_API_KEY=your_anthropic_api_key
NOTION_TOKEN=your_notion_integration_token
```

3. **Run locally (standalone)**:
```bash
npm start
```

### Deploy to Vercel

1. **Deploy**:
```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-18203ca4
```

2. **Configure environment variables in Vercel**:
Go to your Vercel project settings and add:
- `TELEGRAM_BOT_TOKEN`
- `ANTHROPIC_API_KEY`
- `NOTION_TOKEN`

3. **Setup webhook**:
After deployment, visit:
```
https://agentic-18203ca4.vercel.app/api/setup
```

This will configure the Telegram webhook to point to your Vercel deployment.

## Usage

Once the bot is running, open Telegram and:

1. Find your bot by username
2. Send `/start` to begin
3. Chat naturally! Examples:
   - "What databases do I have in Notion?"
   - "Create a new task page"
   - "Search for pages about project planning"
   - "List all pages in my tasks database"

### Commands

- `/start` - Show welcome message
- `/clear` - Clear conversation history
- `/help` - Show available tools and examples

## How It Works

1. **Telegram Integration**: Receives messages from users via Telegram Bot API
2. **Claude AI**: Processes natural language and decides when to use Notion tools
3. **MCP Notion Server**: Provides structured access to Notion API
4. **Conversational Flow**: Maintains context across messages for natural interactions

## Architecture

```
User (Telegram) → Bot → Claude AI → MCP Notion Server → Notion API
                  ↓                         ↓
              Session Storage         Tool Execution
```

## Available Notion Capabilities

The bot can access these Notion operations through MCP:

- Search databases and pages
- Create new pages
- Update existing pages
- Query database contents
- Append blocks to pages
- Retrieve page/database properties

## Development

To modify the bot behavior, edit `bot.js`:

- `handleAIRequest()`: Manages conversation with Claude
- `processToolCalls()`: Executes MCP tool calls
- Bot command handlers: `/start`, `/help`, `/clear`

## Troubleshooting

**Bot not responding?**
- Check that all environment variables are set correctly
- Verify Notion integration has access to your pages/databases
- Ensure API keys are valid

**MCP errors?**
- The Notion MCP server is installed automatically via `npx`
- Check that `NOTION_TOKEN` has proper permissions

## License

MIT