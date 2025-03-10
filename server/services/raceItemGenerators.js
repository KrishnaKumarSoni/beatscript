const DEBUG_MODE = true;

function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}
const generateRaceItems = async (searchString, MIN_VALIDATION_CONFIDENCE,searchAndValidateHandler,validateResults,providerName) => {

        try {
          const results = await searchAndValidateHandler(searchString);
          if (!results || !results.length) {
            debug(`${providerName}: No results found`);
            throw new Error('No results');
          }
          
          const validatedResults = await validateResults(
            searchString,
            results,
            MIN_VALIDATION_CONFIDENCE
          );
          
          if (!validatedResults || !validatedResults.length) {
            debug(`${providerName}: No validated results`);
            throw new Error('No validated results');
          }

          return validatedResults[0];
        } catch (error) {
          debug(`${providerName} process error:`, error.message);
          throw error;
        }
      }





module.exports = {
    generateRaceItems
}
