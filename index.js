require('dotenv').config();
const path = require('path');
const express = require('express');
const { Telegraf } = require('telegraf');

const { ITEMS, getItem, CRYPTO_ASSET } = require('./items');
const { getStockLeft, getInventory, registerInvoice, fulfillInvoice, getInvoiceRecord } = require('./store');
const { createInvoice, getInvoiceStatus, verifySignature } = require('./cryptobot');
const { validateInitData } = require('./auth');

const RARITY_EMOJI = { common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟡' };
const WEBAPP_URL = process.env.WEBAPP_URL;

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// ---------- команды бота ----------

function shopKeyboard() {
  return { inline_keyboard: [[{ text: '🛍 Открыть витрину', web_app: { url: WEBAPP_URL } }]] };
}

bot.start((ctx) =>
  ctx.reply('Добро пожаловать в витрину лимитированных подарков!', { reply_markup: shopKeyboard() })
);

bot.command('shop', (ctx) => ctx.reply('Жми, чтобы открыть витрину:', { reply_markup: shopKeyboard() }));

bot.command('my', (ctx) => {
  const inv = getInventory(String(ctx.from.id));
  if (inv.length === 0) return ctx.reply('Пока пусто. Загляни в /shop.');
  const lines = inv.map((x) => `${RARITY_EMOJI[getItem(x.itemId).rarity]} ${getItem(x.itemId).name}`);
  ctx.reply('Твоя коллекция:\n' + lines.join('\n'));
});

// ---------- статика: сама витрина как Mini App ----------

app.get('/', (req, res) => res.redirect('/gift-market.html'));
app.get('/gift-market.html', (req, res) => res.sendFile(path.join(__dirname, 'gift-market.html')));

// ---------- API для gift-market.html ----------

app.get('/api/catalog', (req, res) => {
  res.json(ITEMS.map((it) => ({ ...it, left: getStockLeft(it.id), asset: CRYPTO_ASSET })));
});
app.use('/images', express.static(path.join(__dirname, 'images')));
app.get('/api/inventory', (req, res) => {
  const user = validateInitData(req.query.initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: 'bad_init_data' });
  res.json(getInventory(String(user.id)));
});

// Создать счёт на оплату. Фронт шлёт свою initData — так бэкенд знает,
// кто именно покупает, и никто не может купить "от чужого имени".
app.post('/api/buy', express.json(), async (req, res) => {
  const { initData, itemId } = req.body || {};
  const user = validateInitData(initData, process.env.BOT_TOKEN);
  if (!user) return res.status(401).json({ error: 'bad_init_data' });

  const item = getItem(itemId);
  if (!item) return res.status(404).json({ error: 'no_such_item' });
  if (getStockLeft(itemId) <= 0) return res.status(409).json({ error: 'sold_out' });

  try {
    const invoice = await createInvoice({
      asset: CRYPTO_ASSET,
      amount: item.price,
      description: item.name,
      payload: JSON.stringify({ userId: String(user.id), itemId })
    });
    await registerInvoice(String(invoice.invoice_id), String(user.id), itemId);
    res.json({ invoiceId: invoice.invoice_id, payUrl: invoice.pay_url });
  } catch (err) {
    console.error('createInvoice error:', err.message);
    res.status(500).json({ error: 'invoice_failed' });
  }
});

// Фронт опрашивает этот эндпоинт, пока ждёт, когда пользователь заплатит в CryptoBot.
// Работает даже без настроенного вебхука/ngrok — на всякий случай сверяемся с CryptoBot напрямую.
app.get('/api/invoice/:id/status', async (req, res) => {
  const record = getInvoiceRecord(req.params.id);
  if (!record) return res.status(404).json({ error: 'not_found' });
  if (record.status === 'paid') return res.json({ status: 'paid' });
  if (record.status === 'refund_needed') return res.json({ status: 'refund_needed' });

  try {
    const remote = await getInvoiceStatus(req.params.id);
    if (remote && remote.status === 'paid') {
      const result = await fulfillInvoice(req.params.id);
      return res.json({ status: result ? 'paid' : 'refund_needed' });
    }
  } catch (err) {
    console.error('getInvoiceStatus error:', err.message);
  }
  res.json({ status: record.status });
});

// ---------- вебхук CryptoBot: основной, надёжный путь подтверждения оплаты ----------

app.post('/cryptobot-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString('utf8');
  const signature = req.header('crypto-pay-api-signature');

  if (!verifySignature(rawBody, signature)) {
    console.warn('Отклонён вебхук с неверной подписью');
    return res.sendStatus(401);
  }

  const update = JSON.parse(rawBody);
  if (update.update_type === 'invoice_paid') {
    const invoiceId = String(update.payload.invoice_id);
    const invoice = await fulfillInvoice(invoiceId);
    if (invoice) {
      const item = getItem(invoice.itemId);
      try {
        await bot.telegram.sendMessage(
          invoice.userId,
          `Оплата получена ✅\n«${item.name}» теперь в твоей коллекции — /my`
        );
      } catch (err) {
        console.error('sendMessage error:', err.message);
      }
    } else {
      console.warn('Счёт', invoiceId, 'уже обработан или товар закончился');
    }
  }
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Сервер слушает порт', process.env.PORT || 3000);
});

bot.launch();
console.log('Бот запущен');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
