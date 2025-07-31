const crypto = require('crypto');

const generateCrashPoint = (roundNumber, serverSeed) => {
  const hash = crypto
    .createHash('sha256')
    .update(serverSeed + roundNumber.toString())
    .digest('hex');
  
  const intValue = parseInt(hash.substring(0, 8), 16);
  const crashPoint = 1 + (intValue % 10000) / 100.0;
  
  return Math.min(crashPoint, 100.00);
};

module.exports = { generateCrashPoint };