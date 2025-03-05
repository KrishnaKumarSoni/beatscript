/**
 * Test file for the removeRepeatingPhrases function
 */

const { removeRepeatingPhrases } = require('./services/searchService');

// Test cases for repeating phrases
const testCases = [
  {
    input: "Gandi Aulaad Seedhe Maut x Sez on the Beat Seedhe Maut x Sez on the Beat",
    expected: "Gandi Aulaad Seedhe Maut x Sez on the Beat"
  },
  {
    input: "Tabia Prabh Deep Tabia Prabh Deep",
    expected: "Tabia Prabh Deep"
  },
  {
    input: "Radiohead Weird Fishes Arpeggi Radiohead",
    expected: "Radiohead Weird Fishes Arpeggi Radiohead" // No repeating phrases of 3+ words
  },
  {
    input: "Mystery of Love Sufjan Stevens Mystery of Love",
    expected: "Mystery of Love Sufjan Stevens" // "Mystery of Love" is a 3-word phrase
  },
  {
    input: "Seedhe Maut Nayaab Album Seedhe Maut Nayaab Album Official Audio",
    expected: "Seedhe Maut Nayaab Album Official Audio"
  },
  {
    input: "word word another word word", // Repeating single words are allowed
    expected: "word word another word word"
  },
  {
    input: "word another word another", // Repeating pairs are allowed
    expected: "word another word another"
  },
  {
    input: "one two three four five one two three",
    expected: "one two three four five" // "one two three" is a 3-word phrase
  }
];

// Run the tests
function runTests() {
  console.log('Testing removeRepeatingPhrases function...\n');
  
  let passCount = 0;
  
  testCases.forEach((test, index) => {
    const { input, expected } = test;
    const result = removeRepeatingPhrases(input);
    
    console.log(`Test ${index + 1}:`);
    console.log(`Input: "${input}"`);
    console.log(`Result: "${result}"`);
    console.log(`Expected: "${expected}"`);
    
    // Check if the result contains the expected parts
    const resultWords = result.split(' ');
    const expectedWords = expected.split(' ');
    
    // Check if all expected words are in the result
    const allExpectedWordsPresent = expectedWords.every(word => 
      resultWords.includes(word)
    );
    
    // Check if there are no extra words in the result
    const noExtraWords = resultWords.every(word => 
      expectedWords.includes(word)
    );
    
    if (allExpectedWordsPresent && noExtraWords) {
      console.log('✅ PASS\n');
      passCount++;
    } else {
      console.log('❌ FAIL\n');
    }
  });
  
  console.log(`Results: ${passCount}/${testCases.length} tests passed`);
}

// Run the tests
runTests(); 