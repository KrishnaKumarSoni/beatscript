import os
import httpx
from typing import Optional
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class GPTValidator:
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.api_url = "https://api.openai.com/v1/chat/completions"
        if self.api_key:
            logger.info("GPTValidator initialized with API key")
        else:
            logger.warning("No OpenAI API key found, will use fallback validation")
        
    async def validate_lyrics_page(self, search_title: str, page_info: dict) -> bool:
        """
        Use GPT-3.5 to validate if we're on the correct lyrics page
        """
        logger.info(f"Validating lyrics page for search title: {search_title}")
        logger.info(f"Page info: {page_info}")
        
        if not self.api_key:
            logger.warning("No API key, using fallback validation")
            return self._fallback_validation(search_title, page_info)
        
        try:
            # Prepare the prompt
            prompt = self._create_validation_prompt(search_title, page_info)
            logger.info(f"Generated prompt: {prompt}")
            
            # Call GPT-3.5 API
            async with httpx.AsyncClient() as client:
                logger.info("Making API request to OpenAI")
                response = await client.post(
                    self.api_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-3.5-turbo",
                        "messages": [
                            {"role": "system", "content": "You are a lyrics validation assistant. Your task is to determine if a webpage contains the correct lyrics for a given song search. Consider title similarity, artist match, and song name match. Respond with ONLY 'yes' or 'no'."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.3,
                        "max_tokens": 10
                    },
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    result = response.json()
                    answer = result['choices'][0]['message']['content'].lower().strip()
                    logger.info(f"GPT response: {answer}")
                    
                    # Log the validation decision
                    is_valid = answer == 'yes'
                    logger.info(f"Validation result: {'VALID' if is_valid else 'INVALID'} page")
                    return is_valid
                else:
                    logger.error(f"API request failed with status {response.status_code}")
                    logger.error(f"Response content: {response.text}")
                    return self._fallback_validation(search_title, page_info)
                
        except Exception as e:
            logger.error(f"Error calling GPT API: {str(e)}", exc_info=True)
            return self._fallback_validation(search_title, page_info)
    
    def _create_validation_prompt(self, search_title: str, page_info: dict) -> str:
        """Create a prompt for GPT validation"""
        return f"""Determine if this webpage contains the correct lyrics for the search.

Search Title: "{search_title}"
Page Title: "{page_info['title']}"
Artist: "{page_info['artist']}"
Song: "{page_info['song']}"
URL: {page_info['url']}

Rules for validation:
1. The page title or song name should closely match the search title
2. If artist name is present in search, it must match the page artist
3. The URL should be from a legitimate lyrics website
4. Ignore minor differences in formatting or special characters

Is this the correct lyrics page? Respond with ONLY 'yes' or 'no'."""
    
    def _fallback_validation(self, search_title: str, page_info: dict) -> bool:
        """Fallback validation method when GPT is unavailable"""
        try:
            logger.info("Using fallback validation")
            
            # Normalize strings for comparison
            search_terms = set(search_title.lower().split())
            page_terms = set(page_info['title'].lower().split())
            
            # Calculate basic similarity
            title_similarity = len(search_terms.intersection(page_terms)) / len(search_terms)
            logger.info(f"Title similarity: {title_similarity}")
            
            # Check URL structure
            url_valid = '/lyrics' in page_info['url'].lower()
            logger.info(f"URL valid: {url_valid}")
            
            # Check if artist or song name is present in search title
            artist_match = page_info['artist'].lower() in search_title.lower()
            song_match = page_info['song'].lower() in search_title.lower()
            logger.info(f"Artist match: {artist_match}, Song match: {song_match}")
            
            # Combined validation
            is_valid = (title_similarity > 0.7 and url_valid) or (artist_match and song_match)
            logger.info(f"Fallback validation result: {'VALID' if is_valid else 'INVALID'} page")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Error in fallback validation: {str(e)}", exc_info=True)
            return False 