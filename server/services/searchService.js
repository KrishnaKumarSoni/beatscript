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
  
  // Step 1: Extract potential song title and artist from common YouTube title patterns
  let songTitle = '';
  let artistName = '';
  
  // Common patterns in YouTube titles
  // Pattern 1: "Song Title - Artist Name"
  const dashPattern = title.match(/^(.+?)\s*-\s*(.+?)(?:\s*[\(\[|]|$)/);
  
  // Pattern 2: "Artist Name - Song Title"
  const reverseDashPattern = title.match(/^(.+?)\s*-\s*(.+?)(?:\s*[\(\[|]|$)/);
  
  // Pattern 3: "Song Title | Artist Name"
  const pipePattern = title.match(/^(.+?)\s*\|\s*(.+?)(?:\s*[\(\[|]|$)/);
  
  // Pattern 4: "Song Title (feat. Artist)"
  const featPattern = title.match(/^(.+?)\s*(?:\(|\[)(?:feat\.?|ft\.?|featuring)\s*(.+?)(?:\)|\])/i);
  
  // Pattern 5: "Song Title" in quotes
  const quotePattern = title.match(/["'](.+?)["']/);
  
  // Try to identify the most likely pattern
  if (quotePattern) {
    // If there are quotes, the song title is likely inside them
    songTitle = quotePattern[1];
    
    // Try to find artist after the quoted title
    const afterQuote = title.substring(title.indexOf(quotePattern[0]) + quotePattern[0].length);
    const artistMatch = afterQuote.match(/\|\s*(.+?)(?:\s*[\(\[|]|$)/);
    if (artistMatch) {
      artistName = artistMatch[1].trim();
    }
  } else if (dashPattern) {
    // Check if the first part is more likely to be the song title or artist
    const firstPart = dashPattern[1].trim();
    const secondPart = dashPattern[2].trim();
    
    // Heuristic: If the channel name matches either part, that part is likely the artist
    if (channel && firstPart.toLowerCase().includes(channel.toLowerCase())) {
      artistName = firstPart;
      songTitle = secondPart;
    } else if (channel && secondPart.toLowerCase().includes(channel.toLowerCase())) {
      songTitle = firstPart;
      artistName = secondPart;
    } else {
      // Default assumption: first part is song title, second part is artist
      songTitle = firstPart;
      artistName = secondPart;
    }
  } else if (pipePattern) {
    // For pipe pattern, first part is usually the song title
    songTitle = pipePattern[1].trim();
    
    // Check if the second part contains artist information
    const secondPart = pipePattern[2].trim();
    if (secondPart.toLowerCase().includes('official') || 
        secondPart.toLowerCase().includes('video') ||
        secondPart.toLowerCase().includes('audio')) {
      // If second part is just metadata, don't use it as artist
      artistName = '';
    } else {
      artistName = secondPart;
    }
  } else if (featPattern) {
    songTitle = featPattern[1].trim();
    artistName = featPattern[2].trim();
  } else {
    // If no clear pattern, use the whole title but remove common suffixes
    songTitle = title
      .replace(/\s*\(Official.*?\)/gi, '')
      .replace(/\s*\[Official.*?\]/gi, '')
      .replace(/\s*\(Lyric.*?\)/gi, '')
      .replace(/\s*\[Lyric.*?\]/gi, '')
      .replace(/\s*\(Audio.*?\)/gi, '')
      .replace(/\s*\[Audio.*?\]/gi, '')
      .trim();
  }
  
  debug('Extracted song title:', songTitle);
  debug('Extracted artist name:', artistName);
  
  // Step 2: Clean the extracted parts
  songTitle = cleanText(songTitle);
  artistName = cleanText(artistName);
  
  // Step 3: Build the search string without channel name
  let searchStringWithoutChannel = songTitle;
  
  // Add artist if available and not already in the song title
  if (artistName && !songTitle.toLowerCase().includes(artistName.toLowerCase())) {
    searchStringWithoutChannel = `${searchStringWithoutChannel} ${artistName}`;
  }
  
  // Step 3.5: Create a copy for the search string with channel name
  let searchStringWithChannel = searchStringWithoutChannel;
  
  // Add channel name if it's likely the artist and not already included
  if (channel && 
      !searchStringWithChannel.toLowerCase().includes(channel.toLowerCase()) && 
      !artistName.toLowerCase().includes(channel.toLowerCase())) {
    searchStringWithChannel = `${searchStringWithChannel} ${channel}`;
  }
  
  // If the search string is too short, use the original title
  if (searchStringWithoutChannel.split(' ').length < 2) {
    const cleanedTitle = cleanText(title);
    searchStringWithoutChannel = cleanedTitle;
    searchStringWithChannel = cleanedTitle;
  }
  
  // Step 4: Special handling for non-Latin scripts (Hindi, Arabic, etc.)
  const hasNonLatinChars = /[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u3000-\u9FFF]/.test(searchStringWithoutChannel);
  if (hasNonLatinChars) {
    debug('Non-Latin characters detected, simplifying search string');
    
    // For non-Latin scripts, simpler search strings often work better
    // Extract just the main title and artist name without additional text
    let simplifiedSearch = '';
    
    // Get the first word of the song title (usually the most important)
    const mainTitleWord = songTitle.split(' ')[0];
    
    // Get the first word of the artist name if available
    let mainArtistWord = '';
    if (artistName) {
      mainArtistWord = artistName.split(' ')[0];
    } else if (channel) {
      mainArtistWord = channel.split(' ')[0];
    }
    
    // Build a simplified search string
    if (mainTitleWord) {
      simplifiedSearch = mainTitleWord;
      
      // Add artist if available
      if (mainArtistWord && mainArtistWord !== mainTitleWord) {
        simplifiedSearch += ` ${mainArtistWord}`;
      }
      
      // If we have a very short search string, add more words from the title
      if (simplifiedSearch.length < 10 && songTitle.split(' ').length > 1) {
        simplifiedSearch = songTitle.split(' ').slice(0, 2).join(' ');
        
        // Add artist if available and not already included
        if (mainArtistWord && !simplifiedSearch.toLowerCase().includes(mainArtistWord.toLowerCase())) {
          simplifiedSearch += ` ${mainArtistWord}`;
        }
      }
      
      debug('Simplified search string for non-Latin script:', simplifiedSearch);
      searchStringWithoutChannel = simplifiedSearch;
      searchStringWithChannel = simplifiedSearch;
    }
  }
  
  // Step 5: Remove repeating phrases (groups of more than two words)
  searchStringWithoutChannel = removeRepeatingPhrases(searchStringWithoutChannel);
  searchStringWithChannel = removeRepeatingPhrases(searchStringWithChannel);
  
  debug('Final search string without channel:', searchStringWithoutChannel);
  debug('Final search string with channel:', searchStringWithChannel);
  
  return {
    withChannel: searchStringWithChannel,
    withoutChannel: searchStringWithoutChannel
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
