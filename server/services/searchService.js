/**
 * Service to handle search string optimization for lyrics search
 */

// Debug mode for detailed logging
const DEBUG_MODE = true;

// Debug logger function
function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Creates an optimized search string from YouTube title and channel
 * 
 * @param {string} title - YouTube video title
 * @param {string} channel - YouTube channel name
 * @returns {Object} Object containing two search strings: with and without channel name
 */
function makeSearchString(title, channel = '') {
  if (!title) {
    debug('Empty title provided to makeSearchString');
    return { withChannel: '', withoutChannel: '' };
  }
  
  debug('Original title:', title);
  debug('Original channel:', channel);

  // Step 1: Remove content within brackets and parentheses
  let cleanTitle = title
    .replace(/\[.*?\]/g, '') // Remove [...] content
    .replace(/\(.*?\)/g, '') // Remove (...) content
    .replace(/\s*\|\|.*$/g, ''); // Remove everything after double pipes

  // Step 2: Remove common YouTube title filters and metadata
  const filters = [
    /official/ig,
    /video/ig,
    /audio/ig,
    /lyrics/ig,
    /hd/ig,
    /4k/ig,
    /8k/ig,
    /1080p/ig,
    /720p/ig,
    /full/ig,
    /aka/ig,
    /feat\.|ft\.|featuring/ig,
    /\d{4}/g, // Remove years
    /\d{2,4}k/ig, // Remove quality indicators like 4k, 8k
    /\s*[mM][vV]\s*/g, // Remove MV
    /\s*[hH][qQ]\s*/g, // Remove HQ
    /original/ig,
    /exclusive/ig,
    /premium/ig,
    /official\s*music/ig,
    /visualizer/ig,
    /high\s*quality/ig,
    /remaster(ed)?/ig,
    /extended/ig,
    /version/ig,
    /prod\s*by/ig,
    /produced\s*by/ig,
    /directed\s*by/ig,
    /music\s*video/ig,
    /performance/ig,
    /live/ig,
    /cover/ig,
    /remix/ig,
    /amv/ig,
    /slowed/ig,
    /reverb/ig,
    /\s*x\s*/ig, // Remove "x" between artist names
    /\s*&\s*/g, // Remove "&" between artist names
    /\s*\+\s*/g, // Remove "+" between artist names
    /\s*vs\s*/ig, // Remove "vs" between artist names
  ];

  // Apply all filters
  filters.forEach(filter => {
    cleanTitle = cleanTitle.replace(filter, ' ');
  });

  // Step 3: Clean up extra spaces and punctuation
  cleanTitle = cleanTitle
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  debug('Final search string without channel:', cleanTitle);
  debug('Final search string with channel:', `${cleanTitle} ${channel}`.trim());

  return {
    withChannel: `${cleanTitle} ${channel}`.trim(),
    withoutChannel: cleanTitle
  };
}

/**
 * Removes repeating phrases (groups of more than two words) from a string
 * @param {string} text - The text to process
 * @returns {string} - Text with repeating phrases removed
 */
function removeRepeatingPhrases(text) {
  if (!text || text.length < 5) return text;
  
  const words = text.split(' ');
  if (words.length < 5) return text; // Not enough words to have meaningful repeating phrases
  
  // Look for repeating phrases of 3 or more words
  for (let phraseLength = Math.min(10, Math.floor(words.length / 2)); phraseLength >= 3; phraseLength--) {
    for (let i = 0; i <= words.length - phraseLength; i++) {
      // Skip if any word in this position is already null (removed)
      if (words.slice(i, i + phraseLength).some(word => word === null)) continue;
      
      const phrase = words.slice(i, i + phraseLength).join(' ').toLowerCase();
      
      // Look for the same phrase later in the string
      for (let j = i + phraseLength; j <= words.length - phraseLength; j++) {
        // Skip if any word in this position is already null (removed)
        if (words.slice(j, j + phraseLength).some(word => word === null)) continue;
        
        const comparePhrase = words.slice(j, j + phraseLength).join(' ').toLowerCase();
        
        // If we found a repeating phrase, remove the second occurrence
        if (phrase === comparePhrase) {
          // Mark words for removal
          for (let k = 0; k < phraseLength; k++) {
            words[j + k] = null;
          }
        }
      }
    }
  }
  
  // Remove null values and join the words back
  return words.filter(word => word !== null).join(' ');
}

/**
 * Helper function to clean text by removing common filler words and special characters
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    // Remove all content inside square brackets, regardless of content
    .replace(/\[.*?\]/gi, '')
    // Remove content in parentheses that contains common filler words
    .replace(/\((?:official|music|video|audio|lyrics|remaster|lyric|visualizer|hd|4k).*?\)/gi, '')
    // Remove common filler words
    .replace(/\b(official|music|video|audio|lyrics|remaster|lyric|visualizer|hd|4k|720p|1080p)\b/gi, '')
    // Keep "feat" and "ft" as they're important for search
    // Replace special characters with spaces, but preserve non-Latin characters
    .replace(/[^\w\s\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u3000-\u9FFF]/gi, ' ')
    // Replace multiple spaces with a single space
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  makeSearchString,
  removeRepeatingPhrases
};
