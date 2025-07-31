module.exports = (io, gameEngine) => {
  io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('cashout_request', async (data) => {
      try {
        const { playerId, roundNumber } = data;
        const result = await gameEngine.cashOut(playerId, roundNumber);
        socket.emit('cashout_success', result);
      } catch (error) {
        socket.emit('cashout_error', { message: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
};