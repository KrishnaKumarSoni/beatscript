const { stringSimilarity } = require( "string-similarity-js");
const OpenAI = require('openai');
const config = require('../config')
const DEBUG_MODE = true;

function debug(...args) {
  if (DEBUG_MODE) {
    console.log('[DEBUG]', ...args);
  }
}

const formPrompt = (originalQuery, metadata) => {
  
  const titleLine = metadata.title ? `- Title: "${metadata.title}"` : '';
  const artistLine = metadata.artist ? `- Artist: "${metadata.artist}"` : '';

  const prompt1 = `
    You are a music metadata validation system. Your task is to determine if the provided metadata matches the search query.

    Search Query: "${originalQuery}"

    Title: ${titleLine}

    Analyze the search query and metadata to determine:
    1. "confidence": a score from 0-100 indicating how confident you are that the metadata matches the search query

    Respond with a JSON object containing only these fields. Example:
    {
      "confidence": 85
    }
  `;
  const prompt2 = `
    You are a music metadata validation system. Your task is to determine if the provided metadata matches the search query, ensure that the script (Roman , Devnagri etc) of the search should be same as the metadata.

    Search Query: "${originalQuery}"
    Metadata:
    ${metadata.title}
    Lyrics URL: ${metadata.url}

    Analyze the search query and metadata to determine:
    1. "confidence": a score from 0-100 indicating how confident you are that the metadata matches the search query

    Respond with a JSON object containing only these fields. Example:
    {
      "confidence": 85
    }
    
    Ensure language of the search query and metadata are same. Else return 0 confidence.
  `;
  
  
  return prompt2;
}

// Function to extract valid JSON from a string using regex
function extractJsonFromString(str) {
  try {
    // Look for patterns that match JSON objects
    const jsonRegex = /{[\s\S]*?}/;
    const match = str.match(jsonRegex);
    
    if (match && match[0]) {
      return match[0];
    }
    return str; // Return original string if no JSON object found
  } catch (error) {
    debug('Error extracting JSON with regex:', error.message);
    return str; // Return original string on error
  }
}

async function validateLyricsMetadataUsingOpenAI(originalQuery, metadata, source) {
  // Validate inputs
  // debug(originalQuery, metadata, source);
  if (!originalQuery || !metadata) {
    debug(`Invalid inputs to validateLyricsMetadata: query=${!!originalQuery}, metadata=${!!metadata}, source=${source}`);
    return {
      isValid: false,
      confidence: 0,
      source: 'error'
    };
  }
  
  // Log metadata for debugging
  debug(`Validating metadata for ${source}:`, {
    metadata
  });
  // debug("validateLyricsMetadataUsingOpenAI", config.openai.apiKey);
  // If OpenAI API key is not available, use fallback validation
  if (!config.openai.apiKey || config.openai.apiKey.startsWith('sk-') === false) {
    debug('No valid OpenAI API key, using fallback validation');
    throw new Error("No valid OpenAI API key");
  }
  
  try {
    // Prepare the prompt for OpenAI
    const prompt = formPrompt(originalQuery, metadata);
    
    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
    // debug("openai",openai);
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: 'You are a music metadata validation assistant that responds only with JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 50
    });
    // If we got a valid response from OpenAI
    if (response && response.choices && response.choices.length > 0) {
      try {
        const resultText = response.choices[0].message.content.trim();
        // debug('OpenAI validation response:', resultText);
        
        debug(resultText)
        // Extract JSON from the response text using regex before parsing
        const cleanedJsonText = extractJsonFromString(resultText);
        // Parse the result
        const resultJson = JSON.parse(cleanedJsonText);
        const confidenceScore = resultJson.confidence || 0;
        const isValid = confidenceScore >= config.openai.validationThreshold;
        // debug("isValid",isValid);
        // debug("Set confidenceScore",config.openai.validationThreshold);
        return {
          isValid,
          confidence: confidenceScore,
          source: source
        };
      } catch (parseError) {
        debug('Error parsing OpenAI response:', parseError.message);
        throw new Error("Error parsing OpenAI response");
        // return fallbackValidation(originalQuery, metadata, source);
      }
    } else {
      debug('Invalid response from OpenAI');
      throw new Error("Invalid response from OpenAI");
    }
  } catch (error) {
    debug('Error calling OpenAI API:', error.message);
    throw new Error("Error calling OpenAI API");
  }
}

function levenshteinSim(str1, str2) {
    const lenStr1 = str1.length;
    const lenStr2 = str2.length;
  
    let dp = new Array(lenStr1 + 1);
    for (let i = 0; i <= lenStr1; i++) {
      dp[i] = new Array(lenStr2 + 1);
      dp[i][0] = i;
    }
    for (let j = 0; j <= lenStr2; j++) {
      dp[0][j] = j;
    }
  
    for (let i = 1; i <= lenStr1; i++) {
      for (let j = 1; j <= lenStr2; j++) {
        let cost = 0;
        if (str1[i - 1] !== str2[j - 1]) cost = 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    levenshteinDistance =dp[lenStr1][lenStr2] 
    const maxLength = Math.max(lenStr1, lenStr2)
    return 1 - (levenshteinDistance / maxLength);
}
function isSubset(str1, str2) {
    // Convert both strings to lowercase to ignore case sensitivity
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
  
    // Check if str1 is a subset of str2
    if (str1.split('').every(char => str2.includes(char))) {
      return true;
    }
  
    // Check if str2 is a subset of str1
    if (str2.split('').every(char => str1.includes(char))) {
      return true;
    }
  
    return false;
}


const validateLyricsMetadata =  async (result,searchString, source) => {
    console.log("from validateLyricsMetadata",searchString , "source", source);
    // const resultTitle = result.title;
    // const resultArtist = result.artist;    
    // console.log(resultTitle);
    // const stringSim = stringSimilarity(resultTitle,searchString);
    // const levenshteinS = levenshteinSim(resultTitle,searchString);
    // const isSub = isSubset(resultTitle,searchString);
    const gptValidation = await validateLyricsMetadataUsingOpenAI(searchString, result, source);
    // console.log(resultTitle,searchString);
    // console.log(`stringSim:${stringSim.toFixed(2)},levenshteinS:${levenshteinS.toFixed(2)},isSub:${isSub}`);
    // console.log("stringSim",stringSim.toFixed(2));
    // return result;
    console.log("gptValidation",gptValidation);
    console.log("result url",result.url);
    if(gptValidation.isValid){  
        return result;
    }
    
    // if(stringSim > 0.0 || levenshteinS > 0.0|| isSub  ){
    //     return result;
    // }
    throw new Error("No valid result found");
}



const validateResults  = async (results,searchString, source) => {
    
    const validatedResults = await Promise.any(
        results.map((result)=>{
            // console.log("from validateResults",searchString);
            return validateLyricsMetadata(result,searchString, source)
        })
    );
    return validatedResults;
}

module.exports = { validateResults };

