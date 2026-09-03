const ITEMS = [
  { id: 'sneak', name: 'Кроссы «Полночь»', rarity: 'common', price: 9,
    description: 'Городская пара для тех, кто не расстаётся с улицей даже ночью.' },
  { id: 'gem',   name: 'Осколок звезды', rarity: 'rare', price: 19,
    description: 'Кусочек метеорита, застывший в момент падения — редкая находка коллекционеров.' },
  { id: 'bolt',  name: 'Разряд', rarity: 'rare', price: 22,
    description: 'Заряд чистой энергии, зафиксированный в момент вспышки.' },
  { id: 'mask',  name: 'Маска карнавала', rarity: 'epic', price: 38,
    description: 'Ручная роспись в традициях венецианского карнавала — двух одинаковых масок не бывает.' },
  { id: 'medal', name: 'Знак старожила', rarity: 'epic', price: 45,
    description: 'Вручается тем, кто был здесь с самого начала. Тираж строго ограничен.' },
  { id: 'crown', name: 'Корона основателя', rarity: 'legendary', price: 75,
    description: 'Символ первых. Больше выпускаться не будет.',
    image: '/images/founder.jpg' }
];

function getItem(id) {
  return ITEMS.find((it) => it.id === id) || null;
}

// Актив, в котором CryptoBot будет принимать оплату (USDT, TON, BTC, ...)
const CRYPTO_ASSET = process.env.CRYPTO_ASSET || 'USDT';

module.exports = { ITEMS, getItem, CRYPTO_ASSET };
