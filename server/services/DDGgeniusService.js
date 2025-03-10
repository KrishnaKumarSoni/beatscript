const { getURLGeniusAPI } = require('../apis/geniusAPI');
const { scrapeLyricsFromGenius } = require('../scrapers/geniusScraper');
const { validateResults } = require('./newValidationService');
const { DDGresult } = require('./duckDuckGoService');
const DEBUG_MODE = true;

function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}
function filterGeniusResults(apiResponse) {
  const filteredResults = apiResponse.results.filter(result => result.hostname === 'genius.com');
  
  // Map each result to a new object with title, description, and URL
  const formattedResults = filteredResults.map(result => ({
    title: result.title,
    description: result.description,
    url: result.url
  })).slice(0, 3); // Limit to 3 entries

  return formattedResults;
}

async function searchAndValidateDDGGenius(searchString) {
  try {
    const ddgResults = await DDGresult(searchString);
    
    const apiResults = filterGeniusResults(ddgResults);
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
    // console.log("result",result);
    if (result.hasLyrics) {
        // console.log(result);
      return result;
    }
    throw new Error("No lyrics found in Genius");
  } catch (error) {
    debug('Error in Genius search process:', error.message);
    throw new Error("No lyrics found in Genius");
  }
}
// searchAndValidateDDGGenius("Imagine Dragons - Wrecked (Official Music Video)");
module.exports = {
  searchAndValidateDDGGenius
}; 