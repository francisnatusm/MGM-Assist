/**
 * Vercel Node bundle entry when the project's Root Directory is `frontend`.
 * The parent `server.js` and its dependencies are included via this require.
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
