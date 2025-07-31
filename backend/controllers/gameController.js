const GameRound = require('../models/GameRound');

const getCurrentRound = async (req, res) => {
  try {
    const round = await GameRound.findOne()
      .sort({ createdAt: -1 })
      .populate('bets.player', 'username')
      .populate('cashouts.player', 'username');
    
    if (!round) {
      return res.status(404).json({ message: 'No active rounds' });
    }
    
    res.json(round);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getRoundHistory = async (req, res) => {
  try {
    const rounds = await GameRound.find({ status: 'crashed' })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(rounds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCurrentRound, getRoundHistory };