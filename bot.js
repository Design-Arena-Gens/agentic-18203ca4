import TelegramBot from 'node-telegram-bot-api';
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;

if (!TELEGRAM_TOKEN || !ANTHROPIC_API_KEY || !NOTION_TOKEN) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

let mcpClient = null;
let mcpTools = [];

// Initialize MCP client for Notion
async function initializeMCP() {
  try {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-notion'],
      env: {
        ...process.env,
        NOTION_API_KEY: NOTION_TOKEN
      }
    });

    mcpClient = new Client({
      name: 'telegram-bot-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);

    const toolsList = await mcpClient.listTools();
    mcpTools = toolsList.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));

    console.log('MCP Notion tools initialized:', mcpTools.map(t => t.name).join(', '));
  } catch (error) {
    console.error('Failed to initialize MCP:', error);
    throw error;
  }
}

// User sessions to maintain conversation history
const userSessions = new Map();

function getUserSession(chatId) {
  if (!userSessions.has(chatId)) {
    userSessions.set(chatId, {
      messages: []
    });
  }
  return userSessions.get(chatId);
}

// Process tool calls from Claude
async function processToolCalls(toolCalls) {
  const results = [];

  for (const toolCall of toolCalls) {
    try {
      const result = await mcpClient.callTool({
        name: toolCall.name,
        arguments: toolCall.input
      });

      results.push({
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: JSON.stringify(result.content)
      });
    } catch (error) {
      results.push({
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: JSON.stringify({ error: error.message }),
        is_error: true
      });
    }
  }

  return results;
}

// Handle AI conversation with Claude and MCP tools
async function handleAIRequest(chatId, userMessage) {
  const session = getUserSession(chatId);

  session.messages.push({
    role: 'user',
    content: userMessage
  });

  let conversationActive = true;
  let response = '';

  while (conversationActive) {
    try {
      const apiMessages = session.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const claudeResponse = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        tools: mcpTools,
        messages: apiMessages,
        system: `You are a helpful AI assistant integrated with Notion via MCP. You can help users:
- Search and query their Notion databases
- Create, update, and manage Notion pages
- Retrieve database information
- Append content to pages
- List and search databases

When users ask about their Notion data, use the available tools to help them. Be proactive and helpful.`
      });

      // Check if Claude wants to use tools
      const hasToolUse = claudeResponse.content.some(block => block.type === 'tool_use');

      if (hasToolUse) {
        const toolCalls = claudeResponse.content.filter(block => block.type === 'tool_use');
        const textContent = claudeResponse.content.filter(block => block.type === 'text');

        if (textContent.length > 0) {
          response += textContent.map(block => block.text).join('\n');
        }

        // Execute tool calls
        const toolResults = await processToolCalls(toolCalls);

        // Add assistant message with tool use
        session.messages.push({
          role: 'assistant',
          content: claudeResponse.content
        });

        // Add tool results
        session.messages.push({
          role: 'user',
          content: toolResults
        });

        // Continue conversation loop to get final response
      } else {
        // No tool use, extract text response
        const textContent = claudeResponse.content.filter(block => block.type === 'text');
        response = textContent.map(block => block.text).join('\n');

        session.messages.push({
          role: 'assistant',
          content: claudeResponse.content
        });

        conversationActive = false;
      }

    } catch (error) {
      console.error('Error processing AI request:', error);
      throw error;
    }
  }

  return response;
}

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Welcome! 🤖

I'm your AI personal assistant with Notion integration. I can help you:

📝 Search and query your Notion databases
✍️ Create and update Notion pages
📊 Retrieve database information
➕ Append content to pages
🔍 List and search your databases

Just chat with me naturally, and I'll use my Notion tools to help you!

Commands:
/start - Show this welcome message
/clear - Clear conversation history
/help - Get help

Try asking me: "What databases do I have in Notion?" or "Create a new page in my tasks database"`);
});

bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  userSessions.delete(chatId);
  bot.sendMessage(chatId, '🔄 Conversation history cleared!');
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `🤖 AI Personal Agent Help

I can help you with your Notion workspace. Available capabilities:

🔧 Notion Tools:
${mcpTools.map(tool => `• ${tool.name}: ${tool.description}`).join('\n')}

💬 Just chat naturally! Examples:
- "List my Notion databases"
- "Create a new task page"
- "Search for pages about project X"
- "What's in my tasks database?"

Commands:
/start - Welcome message
/clear - Clear conversation
/help - This message`);
});

// Handle all text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Skip if it's a command
  if (text && text.startsWith('/')) {
    return;
  }

  if (!text) {
    return;
  }

  try {
    // Show typing indicator
    await bot.sendChatAction(chatId, 'typing');

    const response = await handleAIRequest(chatId, text);

    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error handling message:', error);
    await bot.sendMessage(chatId, `❌ Sorry, I encountered an error: ${error.message}`);
  }
});

// Initialize and start
async function start() {
  try {
    console.log('Initializing MCP Notion client...');
    await initializeMCP();
    console.log('✅ MCP initialized successfully');

    console.log('🤖 Telegram bot is running...');
    console.log('Bot username:', (await bot.getMe()).username);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

start();
