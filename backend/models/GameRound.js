const mongoose = require('mongoose');

const gameRoundSchema = new mongoose.Schema({
  roundNumber: {
    type: Number,
    required: true,
    unique: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  crashPoint: Number,
  status: {
    type: String,
    enum: ['waiting', 'in_progress', 'crashed'],
    default: 'waiting'
  },
  bets: [{
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    amount: Number,
    currency: String,
    priceAtBet: Number
  }],
  cashouts: [{
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    multiplier: Number,
    amount: Number,
    currency: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('GameRound', gameRoundSchema);