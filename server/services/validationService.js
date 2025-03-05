/**
 * Service to validate lyrics search results using OpenAI GPT-4o
 */
const axios = require('axios');
const config = require('../config');
const { OpenAI } = require('openai');

// Enable debug mode for detailed logging
const DEBUG_MODE = true;

// Debug logger function
function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Calculates string similarity using Levenshtein distance
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {number} - Similarity score from 0-100
 */
function getStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Normalize strings for comparison
  const s1 = String(str1).toLowerCase().trim();
  const s2 = String(str2).toLowerCase().trim();
  
  // If either string is empty, return 0
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // If strings are identical, return 100
  if (s1 === s2) return 100;
  
  // Calculate Levenshtein distance
  const track = Array(s2.length + 1).fill(null).map(() => 
    Array(s1.length + 1).fill(null));
  
  for (let i = 0; i <= s1.length; i++) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= s2.length; j++) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  const distance = track[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  // Convert distance to similarity score (0-100)
  return Math.round((1 - distance / maxLength) * 100);
}

// Sleep function for retry delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fallback validation when OpenAI is unavailable
function fallbackValidation(originalQuery, metadata, source) {
  debug(`Using fallback validation for ${source}`);
  
  // Ensure metadata is valid
  if (!metadata || typeof metadata !== 'object') {
    debug('Invalid metadata object provided to fallback validation');
    return {
      isValid: false,
      confidence: 0,
      source: 'fallback'
    };
  }
  
  // Extract title and artist from metadata
  const metadataTitle = metadata.title || '';
  const metadataArtist = metadata.artist || '';
  
  // Extract title and artist from query
  const queryTitle = originalQuery.split('-')[0].trim();
  const queryArtist = originalQuery.split('-')[1]?.trim() || '';
  
  // Get similarity scores
  const titleScore = getStringSimilarity(queryTitle, metadataTitle);
  const artistScore = queryArtist ? getStringSimilarity(queryArtist, metadataArtist) : 100;
  
  // Calculate confidence score
  const confidence = Math.round((titleScore * 0.7) + (artistScore * 0.3));
  
  debug('Fallback validation scores:', {
    source,
    titleScore,
    artistScore,
    confidence,
    threshold: config.openai.validationThreshold
  });
  
  // Return validation result
  return {
    isValid: confidence >= config.openai.validationThreshold,
    confidence,
    source: 'fallback'
  };
}

/**
 * Validates lyrics metadata against the original search query
 * @param {string} originalQuery - The original search query
 * @param {Object} metadata - The metadata to validate
 * @param {string} source - The source of the metadata (e.g., 'Genius', 'JioSaavn')
 * @returns {Promise<Object>} - Validation result with confidence score
 */
async function validateLyricsMetadata(originalQuery, metadata, source) {
  // Validate inputs
  if (!originalQuery || !metadata) {
    debug(`Invalid inputs to validateLyricsMetadata: query=${!!originalQuery}, metadata=${!!metadata}, source=${source}`);
    return {
      isValid: false,
      confidence: 0,
      source: 'error'
    };
  }
  
  // Log metadata for debugging
  debug(`Validating metadata for ${source}:`, {
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album
  });
  
  // If OpenAI API key is not available, use fallback validation
  if (!config.openai.apiKey || config.openai.apiKey.startsWith('sk-') === false) {
    debug('No valid OpenAI API key, using fallback validation');
    return fallbackValidation(originalQuery, metadata, source);
  }
  
  try {
    // Prepare the prompt for OpenAI
    const prompt = `
You are a music metadata validation system. Your task is to determine if the provided metadata matches the search query.

Search Query: "${originalQuery}"
Metadata:
- Title: "${metadata.title || 'Unknown'}"
- Artist: "${metadata.artist || 'Unknown'}"
- Album: "${metadata.album || 'Unknown'}"
- Source: ${source}

Analyze the search query and metadata to determine:
1. "confidence": a score from 0-100 indicating how confident you are that the metadata matches the search query

Respond with a JSON object containing only these fields. Example:
{
  "confidence": 85
}
`;
    
    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: 'You are a music metadata validation assistant that responds only with JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 150
    });
    
    // If we got a valid response from OpenAI
    if (response && response.choices && response.choices.length > 0) {
      try {
        const resultText = response.choices[0].message.content.trim();
        debug('OpenAI validation response:', resultText);
        
        // Parse the result
        const resultJson = JSON.parse(resultText);
        const confidenceScore = resultJson.confidence || 0;
        const isValid = confidenceScore >= config.openai.validationThreshold;
        
        return {
          isValid,
          confidence: confidenceScore,
          source: 'openai'
        };
      } catch (parseError) {
        debug('Error parsing OpenAI response:', parseError.message);
        return fallbackValidation(originalQuery, metadata, source);
      }
    } else {
      debug('Invalid response from OpenAI');
      return fallbackValidation(originalQuery, metadata, source);
    }
  } catch (error) {
    debug('Error calling OpenAI API:', error.message);
    return fallbackValidation(originalQuery, metadata, source);
  }
}

module.exports = {
  validateLyricsMetadata,
  getStringSimilarity,
  fallbackValidation
};
