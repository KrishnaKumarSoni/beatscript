const { getURLGeniusAPI } = require('../apis/geniusAPI');
const { scrapeLyricsFromGenius } = require('../scrapers/geniusScraper');
const { validateResults } = require('./newValidationService');
const DEBUG_MODE = true;

function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

async function searchAndValidateGenius(searchString) {
  try {
    const apiResults = await getURLGeniusAPI(searchString);
    // console.log(apiResults);
    const validatedResultsBeforeScraping = await validateResults(apiResults,searchString, 'genius');

    
    const lyrics = await scrapeLyricsFromGenius(validatedResultsBeforeScraping.url);

    // console.log("lyrics",lyrics);
    const result = {
      source: 'Genius',
      metadata: validatedResultsBeforeScraping,
      url: validatedResultsBeforeScraping.url,
      lyrics,
      hasLyrics: Boolean(lyrics)
    }
    if (result.hasLyrics) {
      // console.log("result",result);
      return result;
    }
    throw new Error("No lyrics found in Genius");
  } catch (error) {
    debug('Error in Genius search process:', error.message);
    throw new Error("No lyrics found in Genius");
  }
}
// searchAndValidateGenius("honey singh blue eyes");
module.exports = {
  searchAndValidateGenius
}; 