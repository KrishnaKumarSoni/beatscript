const express = require('express');
const router = express.Router();
const { makeSearchString } = require('../services/searchService');
const { searchAndValidateGenius } = require('../services/geniusService');
const { searchAndValidateJioSaavn } = require('../services/jioSaavnService');
// const { validateResults } = require('../services/validationService');
const { generateRaceItems } = require('../services/raceItemGenerators');
const config = require('../config');
const { searchAndValidateDDGGenius } = require('../services/DDGgeniusService');


router.use(express.urlencoded({ extended: true }));

// Minimum confidence score to consider a validation result valid
const MIN_VALIDATION_CONFIDENCE = config.openai.validationThreshold || 70;
const DEBUG_MODE = true;


function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * POST /search
 * Search for lyrics based on song title and channel
 */
router.post('/search', async (req, res) => {
  console.log("###################-------####################");
  console.log("###################STARTED####################");
  console.log("###################-------####################");
  try {
    // Extract search parameters
    const { title, artist } = req.body;
    debug('Search query:', { title, artist });
    
    if (!title) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title is required' 
      });
    }

    // Generate search strings
    const searchStrings = makeSearchString(title, artist);
    debug('Search strings:', searchStrings);

    // Race between Genius and JioSaavn for fastest valid result
    try {
      const raceResult = await Promise.any([
        searchAndValidateGenius(searchStrings.withChannel),
        searchAndValidateJioSaavn(searchStrings.withChannel),
        searchAndValidateDDGGenius(searchStrings.withChannel),
        searchAndValidateJioSaavn(searchStrings.withoutChannel),
        searchAndValidateGenius(searchStrings.withoutChannel),
        searchAndValidateDDGGenius(searchStrings.withoutChannel),
      ]);
      // const raceResult = await Promise.any([
      //   searchAndValidateGenius(title),
      //   searchAndValidateJioSaavn(title),
      //   searchAndValidateDDGGenius(title),
      // ]);
      // Now raceResult will only contain valid results, not errors
      // console.log("raceResult",raceResult);
      return res.json({
        success: true,
        result: raceResult
      });
    } catch (raceError) {
      debug('Race error:', raceError.message);
      // All promises were rejected
      return res.status(404).json({
        success: false,
        error: 'No lyrics found from any source'
      });
    }
    // need to   add fall back
  } catch (error) {
    debug('Error in lyrics search:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while searching for lyrics'
    });
  }
});

/**
 * GET /test
 * Test endpoint to verify the service is running
 */
router.get('/test', (req, res) => {
  res.json({ status: 'Lyrics service is running' });
});

module.exports = router;
