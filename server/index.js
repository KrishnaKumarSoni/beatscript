const express = require('express');
const cors = require('cors');
const lyricRoutes = require('./routes/lyrics');
const config = require('./config');

const app = express();
const PORT = config.server.port;

// CORS configuration
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/lyrics', lyricRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Beatscript Lyrics API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;