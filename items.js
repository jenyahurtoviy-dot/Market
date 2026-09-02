const ITEMS = [
  { id: 'sneak', name: 'Кроссы «Полночь»', rarity: 'common', art: 'sneaker', price: 9 },
  { id: 'gem',   name: 'Осколок звезды',    rarity: 'rare',   art: 'gem',     price: 19 },
  { id: 'bolt',  name: 'Разряд',            rarity: 'rare',   art: 'bolt',    price: 22 },
  { id: 'mask',  name: 'Маска карнавала',   rarity: 'epic',   art: 'mask',    price: 38 },
  { id: 'medal', name: 'Знак старожила',    rarity: 'epic',   art: 'medal',   price: 45 },
  { id: 'crown', name: 'Корона основателя', rarity: 'legendary', art: 'crown', price: 75 }
];

function getItem(id) {
  return ITEMS.find((it) => it.id === id) || null;
}

// Актив, в котором CryptoBot будет принимать оплату (USDT, TON, BTC, ...)
const CRYPTO_ASSET = process.env.CRYPTO_ASSET || 'USDT';

module.exports = { ITEMS, getItem, CRYPTO_ASSET };
