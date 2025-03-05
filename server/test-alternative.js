const { getURLGeniusAPI } = require('./apis/geniusAPI');
const { getURLJioSaavnAPI } = require('./apis/jioSaavnAPI');
const config = require('./config');

// Alternative search strings to test
const searchStrings = [
  'Seedhe Maut Anaadi',
  'Anadi Seedhe Maut',
  'Seedhe Maut Nayaab',
  'Seedhe Maut',
  'Anaadi'
];

// Test the Genius API with multiple search strings
async function testGeniusAPI() {
  console.log('Testing Genius API with alternative search strings');
  
  for (const searchString of searchStrings) {
    console.log(`\nTrying search string: "${searchString}"`);
    
    try {
      const results = await getURLGeniusAPI(searchString, config.genius.accessToken);
      
      if (!results || !Array.isArray(results) || results.length === 0) {
        console.log('No results found from Genius API');
      } else {
        console.log(`Found ${results.length} results from Genius API`);
        results.forEach((result, index) => {
          console.log(`Result #${index + 1}: ${result.title} by ${result.artist}`);
        });
      }
    } catch (error) {
      console.error('Error testing Genius API:', error.message);
    }
  }
}

// Test the JioSaavn API with multiple search strings
async function testJioSaavnAPI() {
  console.log('\nTesting JioSaavn API with alternative search strings');
  
  for (const searchString of searchStrings) {
    console.log(`\nTrying search string: "${searchString}"`);
    
    try {
      const result = await getURLJioSaavnAPI(searchString);
      
      if (!result || !result.url) {
        console.log('No results found from JioSaavn API');
      } else {
        console.log('Found result from JioSaavn API:');
        console.log(`Title: ${result.title}`);
        console.log(`Artist: ${result.artist}`);
      }
    } catch (error) {
      console.error('Error testing JioSaavn API:', error.message);
    }
  }
}

// Run the tests
async function runTests() {
  await testGeniusAPI();
  await testJioSaavnAPI();
}

runTests(); 