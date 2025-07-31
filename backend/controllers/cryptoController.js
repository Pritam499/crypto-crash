const Player = require('../models/Player');
const GameRound = require('../models/GameRound');
const { getCachedPrices } = require('../services/cryptoPriceService');

const placeBet = async (req, res) => {
  try {
    const { playerId, amountUSD, currency } = req.body;
    
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const currentRound = await GameRound.findOne()
      .sort({ createdAt: -1 })
      .limit(1);
    
    if (!currentRound || currentRound.status !== 'waiting') {
      return res.status(400).json({ message: 'No active betting round' });
    }

    const prices = await getCachedPrices();
    if (!prices || !prices[currency]) {
      return res.status(500).json({ message: 'Failed to fetch crypto prices' });
    }

    const price = prices[currency];
    const cryptoAmount = amountUSD / price;

    if (player.balances[currency] < cryptoAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    player.balances[currency] -= cryptoAmount;
    await player.save();

    currentRound.bets.push({
      player: playerId,
      amount: amountUSD,
      currency,
      priceAtBet: price
    });
    await currentRound.save();

    res.json({
      cryptoAmount,
      roundNumber: currentRound.roundNumber,
      message: 'Bet placed successfully'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const cashOut = async (req, res) => {
  try {
    const { playerId, roundNumber } = req.body;
    
    const round = await GameRound.findOne({ roundNumber });
    if (!round || round.status !== 'in_progress') {
      return res.status(400).json({ message: 'No active round for cashout' });
    }

    const bet = round.bets.find(b => b.player.toString() === playerId);
    if (!bet) {
      return res.status(404).json({ message: 'No bet found for player' });
    }

    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const elapsed = (Date.now() - round.startTime) / 1000;
    const multiplier = 1 + elapsed * 0.05; // Using growth factor 0.05
    const cryptoAmount = (bet.amount / bet.priceAtBet) * multiplier;

    player.balances[bet.currency] += cryptoAmount;
    await player.save();

    round.cashouts.push({
      player: playerId,
      multiplier: parseFloat(multiplier.toFixed(2)),
      amount: cryptoAmount,
      currency: bet.currency
    });
    await round.save();

    const prices = await getCachedPrices();
    const price = prices[bet.currency];
    const usdAmount = cryptoAmount * price;

    res.json({
      multiplier: parseFloat(multiplier.toFixed(2)),
      cryptoAmount: parseFloat(cryptoAmount.toFixed(8)),
      usdAmount: parseFloat(usdAmount.toFixed(2))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { placeBet, cashOut };