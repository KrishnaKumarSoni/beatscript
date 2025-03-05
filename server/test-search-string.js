/**
 * Test file for the makeSearchString function
 */

const { makeSearchString } = require('./services/searchService');

// Test cases for rare English and Hindi songs
const testCases = [
  // Hindi songs with complex titles
  {
    title: "'Gandi Aulaad' (Official Lyric Video) | Seedhe Maut x Sez on the Beat | Nayaab",
    artist: 'THE MVMNT / SEZ ON THE BEAT',
    expected: 'Gandi Aulaad Seedhe Maut x Sez on the Beat THE MVMNT / SEZ ON THE BEAT'
  },
  {
    title: "Tabia (तबिया) - Prabh Deep | Full Album | Official Audio",
    artist: 'Prabh Deep',
    expected: 'Tabia तबिया Prabh Deep'
  },
  {
    title: "Karan Aujla - Softly (Official Video) | Ikky | Yeah Proof",
    artist: 'Karan Aujla',
    expected: 'Softly Karan Aujla'
  },
  {
    title: "Ritviz - Sage [Official Music Video]",
    artist: 'Ritviz',
    expected: 'Sage Ritviz'
  },
  
  // English songs with complex titles
  {
    title: "Radiohead - Weird Fishes / Arpeggi (In Rainbows)",
    artist: 'Radiohead',
    expected: 'Weird Fishes Arpeggi Radiohead'
  },
  {
    title: "Bon Iver - 'Hey, Ma' (Official Video)",
    artist: 'Bon Iver',
    expected: 'Hey Ma Bon Iver'
  },
  {
    title: "Sufjan Stevens, \"Mystery of Love\" (From \"Call Me By Your Name\" Soundtrack)",
    artist: 'Sufjan Stevens',
    expected: 'Mystery of Love Sufjan Stevens'
  },
  {
    title: "Fleet Foxes - Mykonos [Sub Español/Lyrics]",
    artist: 'Fleet Foxes',
    expected: 'Mykonos Fleet Foxes'
  }
];

// Run the tests
function runTests() {
  console.log('Testing makeSearchString function with rare songs...\n');
  
  let passCount = 0;
  
  testCases.forEach((test, index) => {
    const { title, artist, expected } = test;
    const result = makeSearchString(title, artist);
    
    console.log(`Test ${index + 1}: ${title}`);
    console.log(`Artist: ${artist}`);
    console.log(`Result: "${result}"`);
    
    // Check if the result contains the essential parts
    const containsExpectedParts = expected.split(' ')
      .every(part => result.toLowerCase().includes(part.toLowerCase()));
    
    if (containsExpectedParts) {
      console.log('✅ PASS: Contains all expected parts\n');
      passCount++;
    } else {
      console.log(`❌ FAIL: Missing some expected parts`);
      console.log(`Expected to contain: "${expected}"\n`);
    }
  });
  
  console.log(`Results: ${passCount}/${testCases.length} tests passed`);
}

// Run the tests
runTests(); 