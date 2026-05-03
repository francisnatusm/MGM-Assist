/**
 * Vercel @vercel/node entry when Root Directory is repo root (see root vercel.json).
 */
let app;
try {
  app = require('../server.js');
} catch (err) {
  console.error('api/index: failed to load server.js', err);
  const express = require('express');
  app = express();
  app.all('*', (req, res) => {
    res.status(500).json({
      error: 'Server failed to start',
      message: err && err.message,
      name: err && err.name
    });
  });
}
module.exports = app;
