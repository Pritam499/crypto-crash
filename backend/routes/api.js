const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const walletController = require('../controllers/walletController');
const cryptoController = require('../controllers/cryptoController');

// Game routes
router.get('/rounds/current', gameController.getCurrentRound);
router.get('/rounds/history', gameController.getRoundHistory);

// Wallet routes
router.get('/wallet/:playerId', walletController.getWalletBalance);

// Crypto routes
router.post('/bet', cryptoController.placeBet);
router.post('/cashout', cryptoController.cashOut);

module.exports = router;