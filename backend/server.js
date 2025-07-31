require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const { app, server, io } = require('./config/server');
const apiRoutes = require('./routes/api');
const GameEngine = require('./services/gameEngine');
const initSocket = require('./services/socketService');

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Initialize game engine
const gameEngine = new GameEngine(io);
gameEngine.start();

// Initialize Socket.IO
initSocket(io, gameEngine);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});