const crypto = require('crypto');
const GameRound = require('../models/GameRound');
const Player = require('../models/Player');
const Transaction = require('../models/Transaction');
const { generateCrashPoint } = require('../utils/provablyFair');
const { getCachedPrices } = require('./cryptoPriceService');

const GROWTH_FACTOR = 0.05;
const ROUND_INTERVAL = 10000; // 10 seconds
const MULTIPLIER_UPDATE_INTERVAL = 100; // ms

class GameEngine {
  constructor(io) {
    this.io = io;
    this.currentRound = null;
    this.roundInterval = null;
    this.multiplierInterval = null;
    this.activeConnections = new Set();
  }

  async start() {
    await this.cleanupIncompleteRounds();
    await this.createNewRound();
    this.roundInterval = setInterval(() => this.createNewRound(), ROUND_INTERVAL);
  }

  async cleanupIncompleteRounds() {
    // Clean up any rounds that might have been left in progress due to server restart
    const incompleteRounds = await GameRound.find({
      status: { $in: ['waiting', 'in_progress'] }
    });
    
    for (const round of incompleteRounds) {
      round.status = 'crashed';
      await round.save();
    }
  }

  async createNewRound() {
    try {
      // Clear any existing intervals
      if (this.multiplierInterval) {
        clearInterval(this.multiplierInterval);
        this.multiplierInterval = null;
      }

      // Force crash any existing round
      if (this.currentRound && this.currentRound.status !== 'crashed') {
        this.currentRound.status = 'crashed';
        await this.currentRound.save();
        this.io.emit('crash', {
          roundNumber: this.currentRound.roundNumber,
          crashPoint: this.currentRound.crashPoint || 1.0
        });
      }

      const roundNumber = await GameRound.countDocuments() + 1;
      const newRound = new GameRound({ 
        roundNumber,
        startTime: new Date(Date.now() + ROUND_INTERVAL) // Future start time
      });
      await newRound.save();
      
      this.currentRound = newRound;
      this.io.emit('round_start', { 
        roundNumber,
        startTime: newRound.startTime
      });

      // Start the round after 10 seconds
      setTimeout(() => this.startRound(newRound._id), ROUND_INTERVAL);
    } catch (error) {
      console.error('Error creating new round:', error);
    }
  }

  async startRound(roundId) {
    try {
      const round = await GameRound.findById(roundId);
      if (!round || round.status !== 'waiting') return;

      round.status = 'in_progress';
      round.crashPoint = generateCrashPoint(
        round.roundNumber, 
        process.env.SERVER_SEED
      );
      await round.save();

      this.currentRound = round;
      
      // Emit the hash of the server seed + round number for provable fairness
      const hash = crypto.createHash('sha256')
        .update(process.env.SERVER_SEED + round.roundNumber.toString())
        .digest('hex');
      
      this.io.emit('round_started', {
        roundNumber: round.roundNumber,
        crashHash: hash,
        serverSeedHash: crypto.createHash('sha256')
          .update(process.env.SERVER_SEED)
          .digest('hex')
      });

      const startTime = Date.now();
      let elapsed = 0;
      
      this.multiplierInterval = setInterval(async () => {
        try {
          elapsed = (Date.now() - startTime) / 1000;
          const multiplier = 1 + elapsed * GROWTH_FACTOR;
          
          if (multiplier >= round.crashPoint) {
            clearInterval(this.multiplierInterval);
            round.status = 'crashed';
            await round.save();
            
            this.io.emit('crash', {
              roundNumber: round.roundNumber,
              crashPoint: round.crashPoint,
              serverSeed: process.env.SERVER_SEED // Only reveal seed after crash
            });
            return;
          }
          
          this.io.emit('multiplier_update', {
            roundNumber: round.roundNumber,
            multiplier: parseFloat(multiplier.toFixed(2)),
            elapsed: parseFloat(elapsed.toFixed(1))
          });
        } catch (error) {
          console.error('Error in multiplier interval:', error);
          clearInterval(this.multiplierInterval);
        }
      }, MULTIPLIER_UPDATE_INTERVAL);
    } catch (error) {
      console.error('Error starting round:', error);
    }
  }

  async placeBet(playerId, roundNumber, amountUSD, currency) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const round = await GameRound.findOne({ roundNumber, status: 'waiting' }).session(session);
      if (!round) throw new Error('No active round available for betting');

      const player = await Player.findById(playerId).session(session);
      if (!player) throw new Error('Player not found');

      const prices = await getCachedPrices();
      if (!prices || !prices[currency]) throw new Error('Failed to fetch crypto prices');

      const price = prices[currency];
      if (price <= 0) throw new Error('Invalid price for currency');

      const cryptoAmount = amountUSD / price;
      if (cryptoAmount <= 0) throw new Error('Invalid bet amount');

      if (player.balances[currency] < cryptoAmount) {
        throw new Error('Insufficient balance');
      }

      player.balances[currency] -= cryptoAmount;
      await player.save({ session });

      round.bets.push({
        player: playerId,
        amount: amountUSD,
        currency,
        priceAtBet: price
      });
      await round.save({ session });

      const transaction = new Transaction({
        player: playerId,
        round: round._id,
        type: 'bet',
        currency,
        cryptoAmount,
        usdAmount: amountUSD,
        priceAtTime: price
      });
      await transaction.save({ session });

      await session.commitTransaction();
      
      return {
        cryptoAmount,
        transactionId: transaction._id,
        roundNumber: round.roundNumber
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async cashOut(playerId, roundNumber) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const round = await GameRound.findOne({ 
        roundNumber, 
        status: 'in_progress' 
      }).session(session);
      
      if (!round) throw new Error('No active round for cashout');

      const bet = round.bets.find(b => b.player.toString() === playerId.toString());
      if (!bet) throw new Error('No bet found for player in this round');

      const player = await Player.findById(playerId).session(session);
      if (!player) throw new Error('Player not found');

      const elapsed = (Date.now() - round.startTime) / 1000;
      const multiplier = 1 + elapsed * GROWTH_FACTOR;
      const cryptoAmount = (bet.amount / bet.priceAtBet) * multiplier;

      if (cryptoAmount <= 0) throw new Error('Invalid cashout amount');

      player.balances[bet.currency] += cryptoAmount;
      await player.save({ session });

      round.cashouts.push({
        player: playerId,
        multiplier: parseFloat(multiplier.toFixed(2)),
        amount: cryptoAmount,
        currency: bet.currency
      });
      await round.save({ session });

      const prices = await getCachedPrices();
      const price = prices[bet.currency];
      const usdAmount = cryptoAmount * price;

      const transaction = new Transaction({
        player: playerId,
        round: round._id,
        type: 'cashout',
        currency: bet.currency,
        cryptoAmount,
        usdAmount,
        priceAtTime: price
      });
      await transaction.save({ session });

      await session.commitTransaction();

      this.io.emit('cashout', {
        roundNumber,
        playerId,
        multiplier: parseFloat(multiplier.toFixed(2)),
        cryptoAmount: parseFloat(cryptoAmount.toFixed(8)),
        usdAmount: parseFloat(usdAmount.toFixed(2))
      });

      return {
        multiplier: parseFloat(multiplier.toFixed(2)),
        cryptoAmount: parseFloat(cryptoAmount.toFixed(8)),
        usdAmount: parseFloat(usdAmount.toFixed(2))
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  stop() {
    if (this.roundInterval) clearInterval(this.roundInterval);
    if (this.multiplierInterval) clearInterval(this.multiplierInterval);
  }
}

module.exports = GameEngine;