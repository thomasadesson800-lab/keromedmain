const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!token || !chatId) {
    console.error('Missing Telegram environment variables.');
    return Response.json({ error: 'Telegram configuration is incomplete.' }, { status: 503, headers: corsHeaders });
  }

  let body;
  try { 
    body = await request.json(); 
  } catch { 
    return Response.json({ error: 'Invalid JSON.' }, { status: 400, headers: corsHeaders }); 
  }

  const message = String(body.message || '').trim();
  if (!message || message.length > 2000) {
    return Response.json({ error: 'Message is required.' }, { status: 400, headers: corsHeaders });
  }

  const text = [
    '<b>New Kiromed support message</b>',
    `<b>Name:</b> ${escapeHtml(body.name || 'Website visitor')}`,
    `<b>Contact:</b> ${escapeHtml(body.contact || 'Not provided')}`,
    `<b>Message:</b> ${escapeHtml(message)}`,
    `<b>Page:</b> ${escapeHtml(body.page || 'Unknown')}`,
    `<b>Received:</b> ${escapeHtml(body.sentAt || new Date().toISOString())}`
  ].join('\n');

  // Add an AbortController timeout so it never hangs for 300 seconds again
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second max timeout

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const telegramResult = await telegramResponse.json();
    if (!telegramResponse.ok) {
      console.error('Telegram API error response:', telegramResult);
      return Response.json({ error: 'Telegram notification failed.', details: telegramResult }, { status: 502, headers: corsHeaders });
    }

    return Response.json({ ok: true }, { status: 200, headers: corsHeaders });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Fetch to Telegram failed or timed out:', error);
    return Response.json({ error: 'Telegram request failed.', details: error.message }, { status: 502, headers: corsHeaders });
  }
}