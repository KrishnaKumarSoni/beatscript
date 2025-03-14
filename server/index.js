const express = require('express');
const cors = require('cors');
const lyricRoutes = require('./routes/lyrics');
const config = require('./config');

const app = express();
const PORT = config.server.port;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://beatscript-v2-h9rb0uwms-krishnas-projects-cc548bc4.vercel.app',
    'https://beatscript-v2-e47qsibkv-krishnas-projects-cc548bc4.vercel.app',
    'https://beatscript-*.vercel.app',
    'chrome-extension://*'
  ],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/lyrics', lyricRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Beatscript Lyrics API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;