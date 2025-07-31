const axios = require('axios');

const API_URL = 'https://api.coingecko.com/api/v3/simple/price';
const CACHE_DURATION = 10000; // 10 seconds

let priceCache = {
  timestamp: 0,
  data: null
};

const fetchCryptoPrices = async () => {
  try {
    const response = await axios.get(API_URL, {
      params: {
        ids: 'bitcoin,ethereum',
        vs_currencies: 'usd'
      }
    });
    
    return {
      BTC: response.data.bitcoin.usd,
      ETH: response.data.ethereum.usd
    };
  } catch (error) {
    console.error('Failed to fetch crypto prices:', error.message);
    return null;
  }
};

const getCachedPrices = async () => {
  const now = Date.now();
  
  if (now - priceCache.timestamp > CACHE_DURATION || !priceCache.data) {
    const prices = await fetchCryptoPrices();
    if (prices) {
      priceCache = {
        data: prices,
        timestamp: now
      };
    }
  }
  
  return priceCache.data;
};

module.exports = { getCachedPrices };