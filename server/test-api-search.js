/**
 * Test file for the makeSearchString function with real API calls
 */

const { makeSearchString } = require('./services/searchService');
const { getURLGeniusAPI } = require('./apis/geniusAPI');
const config = require('./config');

// Test cases for rare English and Hindi songs
const testCases = [
  // Hindi song with complex title
  {
    title: "'Gandi Aulaad' (Official Lyric Video) | Seedhe Maut x Sez on the Beat | Nayaab",
    artist: 'THE MVMNT / SEZ ON THE BEAT'
  },
  // Hindi song with non-Latin characters
  {
    title: "Tabia (तबिया) - Prabh Deep | Full Album | Official Audio",
    artist: 'Prabh Deep'
  },
  // English song with complex title
  {
    title: "Radiohead - Weird Fishes / Arpeggi (In Rainbows)",
    artist: 'Radiohead'
  },
  // English song with quotes
  {
    title: "Sufjan Stevens, \"Mystery of Love\" (From \"Call Me By Your Name\" Soundtrack)",
    artist: 'Sufjan Stevens'
  }
];

// Run the tests
async function runTests() {
  console.log('Testing makeSearchString function with real API calls...\n');
  
  for (const [index, test] of testCases.entries()) {
    const { title, artist } = test;
    const searchString = makeSearchString(title, artist);
    
    console.log(`Test ${index + 1}: ${title}`);
    console.log(`Artist: ${artist}`);
    console.log(`Search string: "${searchString}"`);
    
    try {
      // Make a real API call to Genius
      const results = await getURLGeniusAPI(searchString, config.genius.accessToken);
      
      if (results && results.length > 0) {
        console.log(`✅ SUCCESS: Found ${results.length} results on Genius`);
        console.log(`Top result: "${results[0].title}" by ${results[0].artist}`);
      } else {
        console.log('❌ FAILURE: No results found on Genius');
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
    
    console.log('\n');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
}); 