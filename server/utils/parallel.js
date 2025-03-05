/**
 * Utility functions for parallel processing of validation tasks
 */
const { validateLyricsMetadata } = require('../services/validationService');
const config = require('../config');

// Enable debug mode for detailed logging
const DEBUG_MODE = true;

// Debug logger function
function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Validates API results in parallel
 * 
 * @param {string} originalQuery - The original search query
 * @param {Array} apiResults - Array of API results to validate
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Array>} - Array of validated results
 */
async function validateInParallel(originalQuery, apiResults, timeout = 10000) {
  if (!apiResults || apiResults.length === 0) {
    debug('No API results to validate');
    return [];
  }
  
  debug(`Starting parallel validation for ${apiResults.length} results`);
  
  // Create validation functions for each result
  const validationFunctions = apiResults.map((result, index) => async () => {
    try {
      // Skip validation if already validated
      if (result.validation) {
        debug(`Skipping validation for ${result.source} - already validated with confidence ${result.validation.confidence}`);
        return result;
      }
      
      // Ensure metadata is valid
      if (!result.metadata || typeof result.metadata !== 'object') {
        debug(`Invalid metadata for result #${index} (${result.source})`);
        return {
          ...result,
          validation: {
            isValid: false,
            confidence: 0,
            source: 'error'
          }
        };
      }
      
      // Validate the result
      const validationResult = await validateLyricsMetadata(
        originalQuery, 
        result.metadata, 
        result.source
      );
      
      debug(`Validation result for ${result.source} - ${result.metadata.title || 'Unknown'}: confidence=${validationResult.confidence}, isValid=${validationResult.isValid}`);
      
      // Return the result with validation info
      return {
        ...result,
        validation: {
          isValid: validationResult.isValid,
          confidence: validationResult.confidence,
          source: validationResult.source
        }
      };
    } catch (error) {
      debug(`Error validating ${result.source} result:`, error.message);
      return {
        ...result,
        validation: {
          isValid: false,
          confidence: 0,
          source: 'error'
        }
      };
    }
  });
  
  // Execute validation functions in parallel with limited concurrency
  const results = await executeInParallel(validationFunctions, 3, timeout);
  
  // Filter out null results and ensure we have a valid array
  return Array.isArray(results) ? results.filter(Boolean) : [];
}

/**
 * Executes an array of functions in parallel with limited concurrency
 * 
 * @param {Array<Function>} functions - Array of async functions to execute
 * @param {number} concurrency - Maximum number of concurrent executions
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Array>} - Array of results
 */
async function executeInParallel(functions, concurrency = 3, timeout = 10000) {
  if (!functions || !Array.isArray(functions) || functions.length === 0) {
    return [];
  }
  
  const results = new Array(functions.length);
  const executing = new Set();
  
  // Create a promise that resolves when all functions have completed
  return new Promise((resolve) => {
    // Function to execute the next function in the queue
    async function executeNext(fn, index) {
      // Create a promise that executes the function with a timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
      });
      
      try {
        // Race the function execution against the timeout
        const result = await Promise.race([fn(), timeoutPromise]);
        results[index] = result;
      } catch (error) {
        debug(`Error executing function ${index}:`, error.message);
        results[index] = null;
      }
      
      executing.delete(index);
      
      // If all functions have completed, resolve the promise
      if (executing.size === 0 && index === functions.length - 1) {
        resolve(results);
      }
    }
    
    // Start executing functions with limited concurrency
    let nextIndex = 0;
    
    // Helper function to start the next batch of functions
    function startNextBatch() {
      while (executing.size < concurrency && nextIndex < functions.length) {
        const index = nextIndex++;
        executing.add(index);
        executeNext(functions[index], index).then(() => {
          // Start the next function when one completes
          if (nextIndex < functions.length) {
            startNextBatch();
          }
        });
      }
      
      // If we've started all functions and none are executing, resolve
      if (executing.size === 0 && nextIndex === functions.length) {
        resolve(results);
      }
    }
    
    // Start the first batch of functions
    startNextBatch();
  });
}

module.exports = {
  validateInParallel,
  executeInParallel
};
