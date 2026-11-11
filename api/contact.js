/**
 * POST /api/contact — sends the home page "Need help?" form via Resend.
 *
 * Environment variables:
 *   RESEND_API_KEY  (required)  Resend API key.
 *   CONTACT_FROM    (required)  Verified sender, e.g. "Rekindled <support@rekindledapp.com>".
 *   CONTACT_TO      (optional)  Recipient(s), comma separated. Default: support@rekindledapp.com
 *
 * Request body (JSON or urlencoded): { name, email, message }  (also accepts Name / Email / Textarea)
 * Response: { ok: true, id } on success, { ok: false, error } otherwise.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_TO = 'support@rekindledapp.com';
const LIMITS = { name: 200, email: 254, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function readBody(req) {
  // Vercel parses JSON / urlencoded bodies into req.body; fall back to reading the stream.
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    if (typeof req.body === 'string') return parseRaw(req.body, req.headers['content-type']);
    if (Buffer.isBuffer(req.body)) return parseRaw(req.body.toString('utf8'), req.headers['content-type']);
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('too_large');
    chunks.push(chunk);
  }
  return parseRaw(Buffer.concat(chunks).toString('utf8'), req.headers['content-type']);
}

function parseRaw(raw, contentType = '') {
  if (!raw) return {};
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return JSON.parse(raw);
}

function field(body, ...keys) {
  for (const key of keys) {
    if (typeof body[key] === 'string') return body[key].trim();
  }
  return '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: 'Method not allowed' });
  }

  let body;
  try {
    body = (await readBody(req)) || {};
  } catch (err) {
    return send(res, 400, { ok: false, error: 'Invalid request body' });
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return send(res, 400, { ok: false, error: 'Invalid request body' });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (field(body, 'company', 'website')) {
    return send(res, 200, { ok: true });
  }

  const name = field(body, 'name', 'Name').replace(/[\r\n\t]+/g, ' ');
  const email = field(body, 'email', 'Email');
  const message = field(body, 'message', 'Textarea', 'Message');

  if (!name && !email && !message) {
    return send(res, 422, { ok: false, error: 'None of the fields are filled in' });
  }
  if (email && (email.length > LIMITS.email || !EMAIL_RE.test(email))) {
    return send(res, 422, { ok: false, error: 'Please enter a valid email address' });
  }
  if (name.length > LIMITS.name || message.length > LIMITS.message) {
    return send(res, 422, { ok: false, error: 'Value too big' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM;
  const to = (process.env.CONTACT_TO || DEFAULT_TO).split(',').map((s) => s.trim()).filter(Boolean);
  if (!apiKey || !from || !to.length) {
    console.error('contact: RESEND_API_KEY / CONTACT_FROM / CONTACT_TO not configured');
    return send(res, 500, { ok: false, error: 'Email service is not configured' });
  }

  const subject = `Rekindled support request${name ? ` from ${name}` : ''}`.slice(0, 200);
  const text = [
    `Name: ${name || '-'}`,
    `Email: ${email || '-'}`,
    '',
    message || '(no message)',
    '',
    '— sent from the rekindledapp.com contact form',
  ].join('\n');
  const html = `
    <p><strong>Name:</strong> ${escapeHtml(name || '-')}<br>
    <strong>Email:</strong> ${escapeHtml(email || '-')}</p>
    <p style="white-space:pre-wrap">${escapeHtml(message || '(no message)')}</p>
    <p style="color:#888;font-size:12px">Sent from the rekindledapp.com contact form</p>`;

  const payload = { from, to, subject, text, html };
  if (email) payload.reply_to = email;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('contact: Resend error', response.status, data && data.message);
      return send(res, 502, { ok: false, error: 'Could not send the message' });
    }
    return send(res, 200, { ok: true, id: data.id || null });
  } catch (err) {
    console.error('contact: request failed', err && err.message);
    return send(res, 502, { ok: false, error: 'Could not send the message' });
  }
};
