const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.CRYPTO_PAY_BASE_URL || 'https://pay.crypt.bot/api';
const TOKEN = process.env.CRYPTO_PAY_TOKEN;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Crypto-Pay-API-Token': TOKEN }
});

async function createInvoice({ asset, amount, description, payload }) {
  const { data } = await api.post('/createInvoice', {
    asset,
    amount: String(amount),
    description,
    payload
  });
  if (!data.ok) throw new Error('CryptoBot: ' + JSON.stringify(data.error));
  return data.result; // { invoice_id, pay_url, ... }
}

// Спрашиваем статус счёта напрямую у CryptoBot — подстраховка на случай,
// если вебхук ещё не настроен или не дошёл (например, при локальной разработке).
async function getInvoiceStatus(invoiceId) {
  const { data } = await api.get('/getInvoices', { params: { invoice_ids: String(invoiceId) } });
  if (!data.ok || !data.result.items.length) return null;
  return data.result.items[0]; // { status: 'active' | 'paid' | 'expired', ... }
}

// Проверка подписи вебхука от CryptoBot (см. Crypto Pay API docs).
function verifySignature(rawBody, signature) {
  if (!signature) return false;
  const secret = crypto.createHash('sha256').update(TOKEN).digest();
  const check = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(check, 'hex');
  const b = Buffer.from(signature, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createInvoice, getInvoiceStatus, verifySignature };
