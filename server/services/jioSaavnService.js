const { getURLJioSaavnAPI } = require('../apis/jioSaavnAPI');
const { scrapeLyricsFromJioSaavn } = require('../scrapers/jioSaavnScraper');
const { validateResults } = require('./newValidationService');
const DEBUG_MODE = true;

function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

async function searchAndValidateJioSaavn(searchString) {
  try {
    const apiResults = [await getURLJioSaavnAPI(searchString)];
    // console.log("apiResults",apiResults);
    const validatedResultsBeforeScraping = await validateResults(apiResults,searchString, 'jioSaavn');

    const lyrics = await scrapeLyricsFromJioSaavn(validatedResultsBeforeScraping);
    
    const result = {
      source: 'JioSaavn',
      metadata: validatedResultsBeforeScraping,
      url: validatedResultsBeforeScraping.url,
      lyrics,
      hasLyrics: Boolean(lyrics)
    }
    if (result.hasLyrics) {
      // console.log("result from jioSaavn",result);
      return result;
    }
    throw new Error("No valid result found");
  } catch (error) {
    debug('Error in JioSaavn search process:', error.message);
    throw new Error("No valid result found");
  }
}
// searchAndValidateJioSaavn("Imagine Dragons - Wrecked (Official Music Video)");

module.exports = {
  searchAndValidateJioSaavn
}; 