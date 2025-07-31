const Player = require('../models/Player');
const { getCachedPrices } = require('../services/cryptoPriceService');

const getWalletBalance = async (req, res) => {
  try {
    const player = await Player.findById(req.params.playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const prices = await getCachedPrices();
    if (!prices) {
      return res.status(500).json({ message: 'Failed to fetch prices' });
    }

    const balances = {
      BTC: {
        crypto: player.balances.BTC,
        usd: player.balances.BTC * prices.BTC
      },
      ETH: {
        crypto: player.balances.ETH,
        usd: player.balances.ETH * prices.ETH
      }
    };

    res.json(balances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getWalletBalance };