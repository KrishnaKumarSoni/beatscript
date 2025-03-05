const express = require('express');
const cors = require('cors');
const lyricRoutes = require('./routes/lyrics');
const config = require('./config');

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/lyrics', lyricRoutes);

// For testing
app.get('/', (req, res) => {
  res.send('Beatscript Lyrics API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
