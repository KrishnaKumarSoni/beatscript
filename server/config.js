/**
 * Configuration file for API keys and other settings
 */
require('dotenv').config();
module.exports = {
  // Genius API configuration
  genius: {
    // Get one from https://genius.com/api-clients
    accessToken: process.env.GENIUS_ACCESS_TOKEN || 'mygeniusaccess'
  },
  
  // OpenAI API configuration
  openai: {
    // Get one from https://platform.openai.com/api-keys
    apiKey: process.env.OPENAI_API_KEY || 'myapikey',
    model: 'gpt-3.5-turbo',
    // Validation confidence threshold (0-100)
    validationThreshold: 60
  },
  
  // Server configuration
  server: {
    port: process.env.PORT || 4000
  }
}; 