const mongoose = require('mongoose');
const Player = require('./models/Player');
const GameRound = require('./models/GameRound');
const connectDB = require('./config/db');
require('dotenv').config();

// Sample players
const samplePlayers = [
  { username: 'player1', balances: { BTC: 0.5, ETH: 5 } },
  { username: 'player2', balances: { BTC: 0.3, ETH: 3 } },
  { username: 'player3', balances: { BTC: 0.7, ETH: 7 } }
];

// Sample game rounds
const sampleRounds = [
  { roundNumber: 1, status: 'crashed', crashPoint: 2.5 },
  { roundNumber: 2, status: 'crashed', crashPoint: 5.7 },
  { roundNumber: 3, status: 'crashed', crashPoint: 10.2 }
];

const populateDB = async () => {
  try {
    await connectDB();
    
    // Clear existing data
    await Player.deleteMany({});
    await GameRound.deleteMany({});
    
    // Insert sample players
    const players = await Player.insertMany(samplePlayers);
    console.log(`${players.length} players inserted`);
    
    // Insert sample rounds
    const rounds = await GameRound.insertMany(sampleRounds);
    console.log(`${rounds.length} game rounds inserted`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error populating database:', error);
    process.exit(1);
  }
};

populateDB();