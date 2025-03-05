/**
 * Utility functions for handling race conditions and parallel processing
 */
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
 * Executes multiple promises in parallel and returns the first successful result
 * If all promises fail, returns null
 * 
 * @param {Array<Promise>} promises - Array of promises to race
 * @param {number} timeout - Timeout in milliseconds (default: 10000ms)
 * @returns {Promise<any>} - First successful result or null if all fail
 */
async function raceToSuccess(promises, timeout = 10000) {
  if (!promises || !Array.isArray(promises) || promises.length === 0) {
    debug('No promises provided to race');
    return null;
  }
  
  debug(`Racing ${promises.length} promises with ${timeout}ms timeout`);
  
  // Create a timeout promise
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => {
      debug('Race timed out');
      resolve(null);
    }, timeout);
  });
  
  // Add the timeout to the promises
  const allPromises = [...promises, timeoutPromise];
  
  // Track which promises have completed
  const pendingPromises = new Map(
    allPromises.map((promise, index) => [
      promise,
      { index, status: 'pending', result: null }
    ])
  );
  
  // Create a promise that resolves with the first successful result
  return new Promise(resolve => {
    // Process each promise
    allPromises.forEach((promise, index) => {
      promise
        .then(result => {
          // Skip the timeout promise result
          if (index === promises.length) return;
          
          // Update the status of this promise
          pendingPromises.get(promise).status = 'fulfilled';
          pendingPromises.get(promise).result = result;
          
          // If we have a valid result, resolve with it
          if (result !== null && result !== undefined) {
            debug(`Promise ${index} succeeded first`);
            resolve(result);
          }
          
          // Check if all promises have completed
          const allCompleted = Array.from(pendingPromises.values())
            .slice(0, promises.length) // Exclude the timeout promise
            .every(p => p.status !== 'pending');
            
          if (allCompleted) {
            debug('All promises completed, but none succeeded');
            resolve(null);
          }
        })
        .catch(error => {
          // Update the status of this promise
          pendingPromises.get(promise).status = 'rejected';
          pendingPromises.get(promise).error = error;
          
          // Check if all promises have completed
          const allCompleted = Array.from(pendingPromises.values())
            .slice(0, promises.length) // Exclude the timeout promise
            .every(p => p.status !== 'pending');
            
          if (allCompleted) {
            debug('All promises completed, but none succeeded');
            resolve(null);
          }
        });
    });
  });
}

module.exports = {
  raceToSuccess
};
