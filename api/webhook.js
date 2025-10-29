import Anthropic from '@anthropic-ai/sdk';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// In-memory session storage (Note: Vercel functions are stateless, so this resets)
const userSessions = new Map();

function getUserSession(chatId) {
  if (!userSessions.has(chatId)) {
    userSessions.set(chatId, {
      messages: []
    });
  }
  return userSessions.get(chatId);
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: options.parse_mode || 'Markdown',
      ...options
    })
  });

  return response.json();
}

async function sendChatAction(chatId, action) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      action: action
    })
  });
}

// Simplified AI handler without MCP (Vercel serverless limitations)
async function handleAIRequest(chatId, userMessage) {
  const session = getUserSession(chatId);

  session.messages.push({
    role: 'user',
    content: userMessage
  });

  try {
    const apiMessages = session.messages.slice(-10); // Keep last 10 messages for context

    const claudeResponse = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: apiMessages,
      system: `You are a helpful AI personal assistant integrated with Notion.

While direct Notion integration is limited in this serverless environment, you can:
- Help users draft content for their Notion pages
- Provide guidance on organizing their Notion workspace
- Answer questions about productivity and task management
- Assist with planning and brainstorming
- Generate structured content that can be added to Notion

Be conversational, helpful, and proactive. When users ask about Notion-specific actions, acknowledge the limitation and offer to help them prepare the content they need.`
    });

    const textContent = claudeResponse.content.filter(block => block.type === 'text');
    const response = textContent.map(block => block.text).join('\n');

    session.messages.push({
      role: 'assistant',
      content: claudeResponse.content
    });

    return response;

  } catch (error) {
    console.error('Error processing AI request:', error);
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ message: 'Telegram bot webhook endpoint' });
  }

  try {
    const update = req.body;

    if (!update.message || !update.message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;

    // Handle commands
    if (text === '/start') {
      await sendTelegramMessage(chatId, `Welcome! 🤖

I'm your AI personal assistant. I can help you:

💡 Brainstorm and plan ideas
📝 Draft content for your Notion pages
🎯 Organize tasks and projects
✍️ Generate structured content
💬 Answer questions and provide guidance

Just chat with me naturally!

Commands:
/start - Show this welcome message
/clear - Clear conversation history
/help - Get help

Try asking me: "Help me plan a project" or "Draft a meeting agenda"`);

      return res.status(200).json({ ok: true });
    }

    if (text === '/clear') {
      userSessions.delete(chatId);
      await sendTelegramMessage(chatId, '🔄 Conversation history cleared!');
      return res.status(200).json({ ok: true });
    }

    if (text === '/help') {
      await sendTelegramMessage(chatId, `🤖 AI Personal Agent Help

I'm here to help you with:

✨ Ideas & Planning
- Brainstorm project ideas
- Create task lists
- Plan workflows

📝 Content Creation
- Draft meeting agendas
- Write documentation outlines
- Generate templates

🎯 Productivity
- Task prioritization
- Time management tips
- Organization strategies

💬 Just chat naturally! Examples:
- "Help me organize my weekly tasks"
- "Create a project template"
- "I need ideas for team building"

Commands:
/start - Welcome message
/clear - Clear conversation
/help - This message`);

      return res.status(200).json({ ok: true });
    }

    // Skip if it's another command
    if (text.startsWith('/')) {
      return res.status(200).json({ ok: true });
    }

    // Show typing indicator (non-blocking)
    sendChatAction(chatId, 'typing').catch(console.error);

    // Process with AI
    const response = await handleAIRequest(chatId, text);
    await sendTelegramMessage(chatId, response);

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error handling webhook:', error);

    // Try to notify user
    if (req.body.message && req.body.message.chat) {
      await sendTelegramMessage(
        req.body.message.chat.id,
        `❌ Sorry, I encountered an error. Please try again.`
      ).catch(console.error);
    }

    return res.status(200).json({ ok: true });
  }
}
