/**
 * Configuration file for API keys and other settings
 */

module.exports = {
  // Genius API configuration
  genius: {
    // You need to replace this with a real Genius API token
    // Get one from https://genius.com/api-clients
    accessToken: process.env.GENIUS_ACCESS_TOKEN || 'YOUR_GENIUS_API_TOKEN'
  },
  
  // OpenAI API configuration
  openai: {
    // You need to replace this with a real OpenAI API key
    // Get one from https://platform.openai.com/api-keys
    apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
    model: 'gpt-3.5-turbo',
    // Validation confidence threshold (0-100)
    validationThreshold: 60
  },
  
  // Server configuration
  server: {
    port: process.env.PORT || 3000
  }
}; 