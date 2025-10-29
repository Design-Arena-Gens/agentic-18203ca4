export default async function handler(req, res) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  try {
    const webhookUrl = `${process.env.VERCEL_URL || req.headers.host}/api/webhook`;
    const fullWebhookUrl = webhookUrl.startsWith('http') ? webhookUrl : `https://${webhookUrl}`;

    // Set webhook
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: fullWebhookUrl
        })
      }
    );

    const data = await response.json();

    if (data.ok) {
      return res.status(200).json({
        success: true,
        message: 'Webhook set successfully',
        webhook_url: fullWebhookUrl,
        telegram_response: data
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to set webhook',
        telegram_response: data
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
