/**
 * CommonJS Vercel Node entry when project Root Directory is `frontend`.
 * Keep this .cjs so `require` works even though frontend package is ESM.
 */
let app;
try {
  app = require('../server.js');
} catch (err) {
  console.error('server-entry: failed to load ../server.js', err);
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
