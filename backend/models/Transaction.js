const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  round: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameRound'
  },
  type: {
    type: String,
    enum: ['bet', 'cashout'],
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  cryptoAmount: {
    type: Number,
    required: true
  },
  usdAmount: {
    type: Number,
    required: true
  },
  priceAtTime: {
    type: Number,
    required: true
  },
  transactionHash: {
    type: String,
    default: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);