const express = require('express');
const router = express.Router();
const { makeSearchString } = require('../services/searchService');
const { getURLGeniusAPI } = require('../apis/geniusAPI');
const { getURLJioSaavnAPI } = require('../apis/jioSaavnAPI');
const { validateInParallel } = require('../utils/parallel');
const { scrapeLyricsFromGenius } = require('../scrapers/geniusScraper');
const { scrapeLyricsFromJioSaavn } = require('../scrapers/jioSaavnScraper');
const config = require('../config');

// Enable debug mode for detailed logging
const DEBUG_MODE = true;

// Debug logger function
function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

// Minimum confidence score to consider a validation result valid
const MIN_VALIDATION_CONFIDENCE = config.openai.validationThreshold || 70;

/**
 * POST /search
 * Search for lyrics based on song title and channel
 */
router.post('/search', async (req, res) => {
  try {
    // Extract search parameters
    const { title, artist } = req.body;
    if (!title) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title is required' 
      });
    }

    // Generate search strings - both with and without channel name
    const searchStrings = makeSearchString(title, artist);
    console.log('Searching for lyrics with strings:', searchStrings.withoutChannel, 'and', searchStrings.withChannel);
    debug('Search query:', { title, artist, searchStrings });

    // Try to get results from Genius API with both search strings
    let geniusResults = [];
    try {
      // Search with the string without channel name
      const apiResultsWithoutChannel = await getURLGeniusAPI(searchStrings.withoutChannel, config.genius.accessToken);
      
      // Search with the string with channel name
      const apiResultsWithChannel = await getURLGeniusAPI(searchStrings.withChannel, config.genius.accessToken);
      
      // Combine results, removing duplicates by URL
      const combinedResults = [];
      const urlSet = new Set();
      
      // Add results from search without channel
      if (apiResultsWithoutChannel && apiResultsWithoutChannel.length > 0) {
        for (const result of apiResultsWithoutChannel) {
          if (result.url && !urlSet.has(result.url)) {
            urlSet.add(result.url);
            combinedResults.push(result);
          }
        }
      }
      
      // Add results from search with channel
      if (apiResultsWithChannel && apiResultsWithChannel.length > 0) {
        for (const result of apiResultsWithChannel) {
          if (result.url && !urlSet.has(result.url)) {
            urlSet.add(result.url);
            combinedResults.push(result);
          }
        }
      }
      
      // Ensure we have a valid array
      geniusResults = combinedResults || [];
      
      if (!geniusResults.length) {
        debug('No results from Genius API with either search string');
      } else {
        console.log('GENIUS DEBUG: Got results from Genius API:', geniusResults);
        
        // Check which results have lyrics
        const resultsWithLyricCheck = await Promise.all(geniusResults.map(async (data) => {
          const hasLyrics = await scrapeLyricsFromGenius(data.url)
            .then(lyrics => Boolean(lyrics))
            .catch(() => false);
          return {
            source: 'Genius',
            metadata: data,
            url: data.url,
            hasLyrics
          };
        }));
        
        // Filter out results without lyrics
        const filteredResults = resultsWithLyricCheck.filter(result => result.hasLyrics);
        geniusResults = filteredResults;
      }
    } catch (error) {
      debug('Error fetching from Genius API:', error.message);
      geniusResults = [];
    }
    
    // Try to get results from JioSaavn API with both search strings
    let jioSaavnResults = [];
    try {
      // Search with the string without channel name
      const jioSaavnResultWithoutChannel = await getURLJioSaavnAPI(searchStrings.withoutChannel);
      
      // Search with the string with channel name
      const jioSaavnResultWithChannel = await getURLJioSaavnAPI(searchStrings.withChannel);
      
      // Combine results, removing duplicates by URL
      const combinedResults = [];
      const urlSet = new Set();
      
      // Add result from search without channel
      if (jioSaavnResultWithoutChannel && jioSaavnResultWithoutChannel.url && !urlSet.has(jioSaavnResultWithoutChannel.url)) {
        urlSet.add(jioSaavnResultWithoutChannel.url);
        combinedResults.push(jioSaavnResultWithoutChannel);
        console.log('JIO SAAVN DEBUG: Got result from JioSaavn API (without channel):', jioSaavnResultWithoutChannel);
        debug('Got result from JioSaavn API (without channel)');
      }
      
      // Add result from search with channel
      if (jioSaavnResultWithChannel && jioSaavnResultWithChannel.url && !urlSet.has(jioSaavnResultWithChannel.url)) {
        urlSet.add(jioSaavnResultWithChannel.url);
        combinedResults.push(jioSaavnResultWithChannel);
        console.log('JIO SAAVN DEBUG: Got result from JioSaavn API (with channel):', jioSaavnResultWithChannel);
        debug('Got result from JioSaavn API (with channel)');
      }
      
      jioSaavnResults = combinedResults;
      
      if (!jioSaavnResults.length) {
        debug('No results from JioSaavn API with either search string');
      }
    } catch (error) {
      debug('Error fetching from JioSaavn API:', error.message);
      jioSaavnResults = [];
    }
    
    // Combine results from both APIs - ensure both arrays are valid
    const validApiResults = [
      ...(Array.isArray(geniusResults) ? geniusResults.map(data => ({ 
        source: 'Genius', 
        metadata: data, 
        hasLyrics: true 
      })) : []),
      ...(Array.isArray(jioSaavnResults) ? jioSaavnResults.map(data => ({ 
        source: 'JioSaavn', 
        metadata: data, 
        hasLyrics: data.hasLyrics || false 
      })) : [])
    ];
    
    console.log(`API RESULTS DEBUG: Valid API results: ${validApiResults.length}`);
    validApiResults.forEach((result, index) => {
      // console.log(`API RESULTS DEBUG: Result #${index + 1}: ${result.source}, title: "${result.metadata.title}", hasLyrics: ${result.hasLyrics}`);
    });
    
    if (validApiResults.length === 0) {
      console.log('API RESULTS DEBUG: No valid API results found');
      return res.status(404).json({ 
        success: false, 
        error: 'No song URLs found from any source' 
      });
    }
    
    // Validate results in parallel
    console.log('VALIDATION DEBUG: Starting parallel validation for', validApiResults.length, 'results');
    const validatedResults = await validateInParallel(searchStrings.withoutChannel, validApiResults);
    
    if (!validatedResults || validatedResults.length === 0) {
      // console.log('VALIDATION DEBUG: No validated results returned');
      return res.status(404).json({ 
        success: false, 
        error: 'No validated results returned' 
      });
    }
    
    // Log validation results
    // console.log('VALIDATION DEBUG: All validation results:');
    validatedResults.forEach(result => {
      // console.log(`VALIDATION DEBUG: ${result.source}: isValid=${result.validation.isValid}, confidence=${result.validation.confidence}/${MIN_VALIDATION_CONFIDENCE}`);
    });
    
    // Filter for valid results
    const validResults = validatedResults.filter(result => 
      result.validation.isValid && 
      result.validation.confidence >= MIN_VALIDATION_CONFIDENCE
    );
    
    console.log(`VALIDATION DEBUG: After filtering: ${validResults.length} valid results out of ${validatedResults.length} total`);
    validResults.forEach(result => {
      // console.log(`VALIDATION DEBUG: Valid result: ${result.source}, confidence=${result.validation.confidence}`);
    });
    
    // If no results meet the threshold, return the best one we have with an error
    if (validResults.length === 0) {
      // Sort by confidence and get the best one
      const bestResult = validatedResults.sort(
        (a, b) => b.validation.confidence - a.validation.confidence
      )[0];
      
      debug(`No valid results, best invalid result: ${bestResult.source}, isValid=${bestResult.validation.isValid}, confidence=${bestResult.validation.confidence}`);
      
      return res.status(404).json({ 
        success: false, 
        error: `No results with sufficient confidence found (best score: ${bestResult.validation.confidence})`,
        metadata: bestResult.metadata,
        validation: bestResult.validation,
        source: bestResult.source
      });
    }

    // TRUE RACE: Scrape lyrics from all valid sources in parallel
    debug('Starting parallel lyrics scraping from all valid sources');
    
    // Create an array of scraping promises
    const scrapingPromises = validResults.map(async (result) => {
      try {
        let lyrics = null;
        
        if (result.source === 'Genius') {
          debug(`Attempting to scrape lyrics from Genius: ${result.metadata.url}`);
          lyrics = await scrapeLyricsFromGenius(result.metadata.url);
          debug(`Genius scraping result for ${result.metadata.title}: ${lyrics ? 'Success' : 'Failed'}`);
        } else if (result.source === 'JioSaavn') {
          debug(`Attempting to scrape lyrics from JioSaavn with songId: ${result.metadata.songId}`);
          lyrics = await scrapeLyricsFromJioSaavn(result.metadata);
          debug(`JioSaavn scraping result for ${result.metadata.title}: ${lyrics ? 'Success' : 'Failed'}`);
        }
        
        return {
          result,
          lyrics,
          success: !!lyrics
        };
      } catch (error) {
        debug(`Error scraping lyrics from ${result.source}: ${error.message}`);
        return {
          result,
          lyrics: null,
          success: false
        };
      }
    });
    
    // Race to get the first successful result
    const scrapingResults = await Promise.all(scrapingPromises);
    
    // Filter for successful results
    const successfulResults = scrapingResults.filter(item => item.success);
    
    debug(`Parallel scraping complete: ${successfulResults.length} successful results out of ${scrapingResults.length} total`);
    
    // If we have successful results, use the one with highest confidence
    if (successfulResults.length > 0) {
      // Sort by confidence score (highest first)
      successfulResults.sort((a, b) => 
        b.result.validation.confidence - a.result.validation.confidence
      );
      
      const bestResult = successfulResults[0].result;
      const lyrics = successfulResults[0].lyrics;
      
      debug(`Returning lyrics from ${bestResult.source} (${lyrics.length} chars)`);
      
      return res.json({
        success: true,
        lyrics,
        songUrl: bestResult.metadata.url,
        metadata: bestResult.metadata,
        validation: bestResult.validation,
        source: bestResult.source
      });
    }
    
    // If no successful results, return error with the highest confidence result
    const bestResult = validResults.sort(
      (a, b) => b.validation.confidence - a.validation.confidence
    )[0];
    
    debug('No lyrics found from any source');
    return res.status(404).json({ 
      success: false, 
      error: 'Lyrics could not be found from any source',
      metadata: bestResult.metadata,
      validation: bestResult.validation,
      source: bestResult.source
    });
    
  } catch (error) {
    console.error('Error in lyrics search:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
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
