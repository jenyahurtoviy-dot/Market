const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

function load() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Простая очередь: гарантирует, что "прочитать data.json -> изменить -> записать"
// не пересечётся с другой такой же операцией, если два человека жмут "купить" одновременно.
// Для реальной нагрузки замени на нормальную БД (Postgres/SQLite) с транзакциями —
// сама эта функция и есть то самое узкое место, которое стоит доделать перед продакшеном.
let queue = Promise.resolve();
function locked(fn) {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
}

function getStockLeft(itemId) {
  const data = load();
  return data.stock[itemId] ?? 0;
}

function getInventory(userId) {
  const data = load();
  return data.inventories[userId] || [];
}

function registerInvoice(invoiceId, userId, itemId) {
  return locked(() => {
    const data = load();
    data.invoices[invoiceId] = { userId, itemId, status: 'pending' };
    save(data);
  });
}

function getInvoiceRecord(invoiceId) {
  const data = load();
  return data.invoices[invoiceId] || null;
}

// Вызывается и из вебхука, и из ручного опроса — должна быть идемпотентной,
// поэтому если счёт уже 'paid', второй раз товар не выдаём.
function fulfillInvoice(invoiceId) {
  return locked(() => {
    const data = load();
    const invoice = data.invoices[invoiceId];
    if (!invoice) return null;
    if (invoice.status === 'paid') return null;

    if ((data.stock[invoice.itemId] ?? 0) <= 0) {
      // Деньги пришли, а товар успели раскупить, пока счёт висел неоплаченным.
      // Дальше нужен ручной/автоматический возврат через CryptoBot (transfer).
      invoice.status = 'refund_needed';
      save(data);
      return null;
    }

    data.stock[invoice.itemId] -= 1;
    invoice.status = 'paid';
    if (!data.inventories[invoice.userId]) data.inventories[invoice.userId] = [];
    data.inventories[invoice.userId].push({ itemId: invoice.itemId, at: Date.now() });
    save(data);
    return invoice;
  });
}

module.exports = { getStockLeft, getInventory, registerInvoice, fulfillInvoice, getInvoiceRecord };
