import os
import logging
from typing import Optional, Dict, Any, Tuple
import lyricsgenius
from difflib import SequenceMatcher
from dotenv import load_dotenv
from lyrics_cleaner import LyricsCleaner
import httpx
from bs4 import BeautifulSoup
import re
import json
from urllib.parse import urlparse, parse_qs

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeniusAPI:
    def __init__(self):
        self.access_token = os.getenv('GENIUS_ACCESS_TOKEN')
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.lyrics_cleaner = LyricsCleaner()
        
        if not self.openai_api_key:
            logger.warning("No OpenAI API key found, GPT-4O processing will be skipped")
        
        if self.access_token:
            # Initialize with API token if available
            self.genius = lyricsgenius.Genius(
                self.access_token,
                timeout=15,
                sleep_time=0.5,
                retries=3,
                verbose=True,
                remove_section_headers=False,
                skip_non_songs=True
            )
            self.genius.excluded_terms = [
                "(Remix)", "(Live)", "(Cover)",
                "Karaoke", "Instrumental", "Extended",
                "VIP Mix", "Club Mix", "Radio Edit"
            ]
            logger.info("Initialized Genius API with token")
        else:
            self.genius = None
            logger.warning("No Genius API token found")
    
    async def _extract_lyrics_from_html(self, html: str) -> Optional[str]:
        """Extract lyrics from Genius HTML content"""
        try:
            logger.info("=== GENIUS SCRAPING DEBUG ===")
            soup = BeautifulSoup(html, 'html.parser')
            
            # Try different selectors in order of preference
            selectors = [
                ("div", {"data-lyrics-container": "true"}),  # New Genius format
                ("div", {"class_": "lyrics"}),  # Old Genius format
                ("div", {"class_": "Lyrics__Container"}),  # Alternative format
            ]
            
            lyrics_parts = []
            for tag, attrs in selectors:
                containers = soup.find_all(tag, attrs)
                if containers:
                    logger.info(f"Found {len(containers)} containers with {tag} {attrs}")
                    for container in containers:
                        # Remove script and button elements
                        for unwanted in container.find_all(['script', 'button']):
                            unwanted.decompose()
                        
                        # Get text while preserving line breaks
                        text = container.get_text('\n').strip()
                        if text:
                            lyrics_parts.append(text)
            
            if lyrics_parts:
                lyrics = '\n\n'.join(lyrics_parts)
                logger.info(f"Extracted lyrics length: {len(lyrics)}")
                logger.info("=== END GENIUS SCRAPING DEBUG ===")
                return lyrics
            
            logger.warning("No lyrics found in HTML")
            return None
            
        except Exception as e:
            logger.error(f"Error extracting lyrics from HTML: {str(e)}")
            return None
    
    async def _fetch_lyrics_from_url(self, url: str) -> Optional[str]:
        """Fetch and extract lyrics from a Genius URL"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    headers={'User-Agent': 'Mozilla/5.0'},
                    follow_redirects=True,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    return await self._extract_lyrics_from_html(response.text)
                
                logger.error(f"Failed to fetch URL {url}: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching lyrics URL: {str(e)}")
            return None

    def _string_similarity(self, str1: str, str2: str) -> float:
        """Calculate string similarity ratio"""
        # Clean strings for comparison
        s1 = re.sub(r'[^\w\s]', '', str1.lower().strip())
        s2 = re.sub(r'[^\w\s]', '', str2.lower().strip())
        return SequenceMatcher(None, s1, s2).ratio()
    
    def _validate_song_match(self, search_title: str, song: Any) -> bool:
        """Validate if the found song matches our search criteria"""
        if not song:
            return False
            
        # Clean strings for comparison
        search_clean = re.sub(r'[^\w\s]', '', search_title.lower().strip())
        title_clean = re.sub(r'[^\w\s]', '', song.title.lower().strip())
        artist_clean = re.sub(r'[^\w\s]', '', song.artist.lower().strip())
        
        logger.info(f"Comparing search='{search_clean}' with title='{title_clean}' by artist='{artist_clean}'")
        
        # Extract main components from search title
        main_parts = search_clean.split('-', 1)
        if len(main_parts) == 2:
            search_artist = main_parts[0].strip()
            search_rest = main_parts[1].strip()
            
            # Handle featured artists in search
            if any(feat in search_rest for feat in ['feat', 'ft', 'featuring']):
                for feat in ['feat', 'ft', 'featuring']:
                    if feat in search_rest:
                        song_parts = search_rest.split(feat, 1)
                        search_song = song_parts[0].strip()
                        search_featured = song_parts[1].strip()
                        
                        # Calculate similarities
                        song_similarity = self._string_similarity(search_song, title_clean)
                        artist_similarity = self._string_similarity(search_artist, artist_clean)
                        featured_in_result = any(
                            self._string_similarity(search_featured, part) > 0.6 
                            for part in artist_clean.split()
                        )
                        
                        logger.info(f"Featured artist song - Song similarity: {song_similarity}, Artist similarity: {artist_similarity}")
                        logger.info(f"Featured artist found in result: {featured_in_result}")
                        
                        # Accept if we have good matches
                        if song_similarity > 0.6 and (artist_similarity > 0.6 or featured_in_result):
                            logger.info("Accepted based on featured artist match")
                            return True
                        break
        
        # Calculate overall title similarity
        similarity = self._string_similarity(search_clean, title_clean)
        logger.info(f"Overall title similarity: {similarity}")
        
        # Accept if title similarity is high enough
        if similarity > 0.7:
            logger.info("Accepted based on high title similarity")
            return True
        
        # Accept if search terms are found in title and artist
        search_terms = set(search_clean.split())
        result_terms = set(title_clean.split() + artist_clean.split())
        common_terms = search_terms.intersection(result_terms)
        if len(common_terms) >= min(2, len(search_terms)):
            logger.info(f"Accepted based on common terms: {common_terms}")
            return True
            
        logger.info("No match found")
        return False
    
    async def _process_with_gpt4o(self, text: str, youtube_title: str = "") -> Tuple[bool, Optional[Dict[str, Any]]]:
        """Process text with GPT-4 to validate and clean lyrics, and extract song/artist info"""
        if not self.openai_api_key or not text:
            logger.warning("No OpenAI API key or empty text, skipping GPT processing")
            return True, {"lyrics": text}

        try:
            # Pre-validate text before sending to GPT
            if len(text.strip().split('\n')) < 3:  # Too few lines
                logger.warning("Text too short to be lyrics")
                return False, None

            # Log the text being processed
            logger.info(f"Processing text length: {len(text)}")
            logger.info(f"First few lines: {text.split('\\n')[:3]}")

            system_prompt = {
                "role": "system",
                "content": """You are a lyrics validation and cleaning expert. Your task is to analyze text and return ONLY a JSON response in the following format:
{
    "is_lyrics": boolean,
    "cleaned_lyrics": string or null,
    "language": string,
    "structure": array of strings,
    "song_name": string,
    "artist_name": string
}

Guidelines for lyrics validation:
- Text should have multiple lines
- Should have a song-like structure
- May contain section markers like [Verse], [Chorus], etc.
- May be in any language
- Should not be just a list of songs or article text

Guidelines for cleaning:
- Remove advertising and metadata
- Keep section headers in [brackets]
- Preserve original line breaks and structure
- Keep language-specific characters and formatting

Guidelines for song/artist extraction:
- Extract song name and artist from the YouTube title if provided
- Remove common YouTube title elements (Official Video, Lyric Video, etc.)
- Handle featuring artists appropriately
- If no YouTube title, try to infer from lyrics content

Remember to ONLY return the JSON object, no other text."""
            }

            # Take more text for analysis but limit to avoid token limits
            text_for_analysis = text[:4000] if len(text) > 4000 else text
            
            user_prompt = {
                "role": "user",
                "content": f"Analyze and clean this text (return ONLY JSON).\n\nYouTube Title: {youtube_title}\n\nLyrics Text:\n{text_for_analysis}"
            }

            logger.info("Sending request to GPT-4")
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-4o",
                        "messages": [system_prompt, user_prompt],
                        "temperature": 0.3
                    },
                    timeout=30.0
                )

                logger.info(f"GPT-4 response status: {response.status_code}")
                if response.status_code == 200:
                    result = response.json()['choices'][0]['message']['content']
                    logger.info(f"GPT-4 raw response: {result[:200]}...")  # Log first 200 chars
                    
                    try:
                        # Clean the response string to ensure it's valid JSON
                        result = result.strip()
                        if result.startswith('```json'):  # Remove markdown if present
                            result = result.split('```json')[1].split('```')[0].strip()
                        elif result.startswith('```'):
                            result = result.split('```')[1].strip()
                            
                        parsed = json.loads(result)
                        
                        # More lenient validation
                        if parsed.get('is_lyrics', False):
                            cleaned = parsed.get('cleaned_lyrics')
                            if cleaned and len(cleaned.strip()) > 0:
                                logger.info(f"GPT-4 cleaned lyrics. Language: {parsed.get('language')}")
                                logger.info(f"Structure: {', '.join(parsed.get('structure', []))}")
                                return True, {
                                    'lyrics': cleaned,
                                    'song': parsed.get('song_name', 'Unknown'),
                                    'artist': parsed.get('artist_name', 'Unknown'),
                                    'language': parsed.get('language', 'unknown')
                                }
                            
                        # If GPT-4 says it's not lyrics, do a final check
                        if text and len(text.strip().split('\n')) > 5:  # If it has enough lines
                            logger.info("GPT-4 rejected but text looks like lyrics, using original")
                            return True, {'lyrics': text}
                            
                        logger.warning("Content determined not to be lyrics")
                        return False, None
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse GPT-4 response: {str(e)}")
                        if text:  # Fallback to original if we can't parse GPT response
                            return True, {'lyrics': text}
                        return False, None
                else:
                    logger.error(f"GPT-4 API error: {response.status_code}")
                    logger.error(f"Error response: {response.text}")
                    # Fallback to original text on API error
                    return True, {'lyrics': text}

            logger.warning("GPT-4 processing failed, checking original text")
            # Final fallback - if text looks like lyrics, use it
            if text and len(text.strip().split('\n')) > 5:
                return True, {'lyrics': text}
            return False, None

        except Exception as e:
            logger.error(f"Error in GPT-4 processing: {str(e)}")
            if text:  # Fallback to original text if there's any error
                return True, {'lyrics': text}
            return False, None

    async def search_lyrics(self, title: str, _: str = "") -> Optional[Dict[str, Any]]:
        """Search for lyrics using LyricsGenius with fallback to custom scraping"""
        if not self.genius:
            logger.error("Genius API not initialized")
            return None
            
        try:
            logger.info(f"Original title: {title}")
            
            # Clean title once for all searches
            clean_title = re.sub(r'\s*\([^)]*\)', '', title)
            clean_title = re.sub(r'\s*\[[^\]]*\]', '', clean_title)
            clean_title = re.sub(r'\s*\|.*$', '', clean_title)
            clean_title = clean_title.strip()
            
            # 1. Try direct Genius search
            logger.info(f"Trying LyricsGenius search with: {clean_title}")
            song = self.genius.search_song(clean_title)
            
            if song and self._validate_song_match(title, song):
                logger.info(f"Found song match: {song.title} by {song.artist}")
                
                # Fetch lyrics from song URL
                lyrics = await self._fetch_lyrics_from_url(song.url)
                if lyrics:
                    # First clean with basic cleaner
                    cleaned = self.lyrics_cleaner.clean(lyrics)
                    # Then process with GPT-4O
                    is_lyrics, result = await self._process_with_gpt4o(cleaned, title)
                    
                    if not is_lyrics:
                        logger.warning("GPT-4O determined content is not valid lyrics")
                        return None
                        
                    if result:
                        return {
                            'lyrics': result.get('lyrics', ''),
                            'song': result.get('song', song.title),
                            'artist': result.get('artist', song.artist),
                            'language': result.get('language', 'unknown')
                        }
            
            # 2. If no results or no match, try custom scraping
            logger.info("No Genius results found, trying custom scraping")
            scraped_lyrics = await self._scrape_lyrics_fallback(title)
            if scraped_lyrics:
                # Validate and clean with GPT-4O
                is_lyrics, result = await self._process_with_gpt4o(scraped_lyrics, title)
                
                if not is_lyrics:
                    logger.warning("GPT-4O determined scraped content is not valid lyrics")
                    return None
                    
                if result:
                    logger.info("Found lyrics through custom scraping")
                    return {
                        'lyrics': result.get('lyrics', ''),
                        'song': result.get('song', title),
                        'artist': result.get('artist', 'Unknown'),
                        'language': result.get('language', 'unknown')
                    }
            
            # 3. Nothing found
            logger.info("No lyrics found through any method")
            return None
            
        except Exception as e:
            logger.error(f"Error searching lyrics: {str(e)}")
            return None
    
    async def _scrape_lyrics_fallback(self, title: str) -> Optional[str]:
        """Custom scraping fallback for when LyricsGenius fails"""
        try:
            # List of search patterns for Indian songs
            search_patterns = [
                f"{title} lyrics",
                f"{title} song lyrics",
                f"{title} bollywood lyrics",
                f"{title} hindi lyrics"
            ]
            
            async with httpx.AsyncClient() as client:
                for search_query in search_patterns:
                    logger.info(f"Trying search pattern: {search_query}")
                    # Try DuckDuckGo search
                    encoded_query = search_query.replace(" ", "+")
                    search_url = f"https://html.duckduckgo.com/html?q={encoded_query}"
                    
                    response = await client.get(
                        search_url,
                        headers={'User-Agent': 'Mozilla/5.0'},
                        follow_redirects=True
                    )
                    
                    if response.status_code != 200:
                        continue
                    
                    soup = BeautifulSoup(response.text, 'lxml')
                    
                    # Look for common lyrics sites in results
                    lyrics_sites = [
                        'lyricsbell.com',
                        'lyricsmint.com',
                        'hindilyrics.net',
                        'lyricsted.com',
                        'lyricsbogie.com',
                        'lyricsindia.net',
                        'gaana.com',
                        'jiosaavn.com'
                    ]
                    
                    # Extract and process URLs from DuckDuckGo results
                    for link in soup.select('.result__a'):
                        href = link.get('href', '')
                        if not href:
                            continue
                            
                        # Extract actual URL from DuckDuckGo redirect
                        if 'duckduckgo.com/l/?' in href:
                            try:
                                # Parse the URL parameters to get the actual destination
                                parsed = urlparse(href)
                                params = parse_qs(parsed.query)
                                if 'uddg' in params:
                                    href = params['uddg'][0]
                            except Exception as e:
                                logger.error(f"Error parsing DuckDuckGo URL: {str(e)}")
                                continue
                        
                        # Ensure URL is absolute
                        if href.startswith('//'):
                            href = 'https:' + href
                        elif not href.startswith('http'):
                            continue
                        
                        # Check if URL is from a lyrics site
                        if any(site in href.lower() for site in lyrics_sites):
                            logger.info(f"Found lyrics site URL: {href}")
                            try:
                                # Try to fetch lyrics from the site
                                lyrics_response = await client.get(
                                    href,
                                    headers={'User-Agent': 'Mozilla/5.0'},
                                    follow_redirects=True,
                                    timeout=10.0
                                )
                                
                                if lyrics_response.status_code == 200:
                                    lyrics_soup = BeautifulSoup(lyrics_response.text, 'lxml')
                                    
                                    # Try common lyrics container patterns
                                    lyrics_selectors = [
                                        '.lyrics-content',
                                        '.entry-content',
                                        '.lyric-content',
                                        '.song-lyrics',
                                        '#lyrics',
                                        '[class*="lyrics"]',
                                        '.main-content',
                                        '.song-content',
                                        '[class*="Lyrics"]'
                                    ]
                                    
                                    for selector in lyrics_selectors:
                                        lyrics_div = lyrics_soup.select_one(selector)
                                        if lyrics_div:
                                            # Remove unwanted elements
                                            for unwanted in lyrics_div.select('script, style, .ad, .ads, .share-buttons'):
                                                unwanted.decompose()
                                                
                                            lyrics_text = lyrics_div.get_text('\n')
                                            # Basic validation
                                            if len(lyrics_text) > 100 and '\n' in lyrics_text:
                                                cleaned_lyrics = self.lyrics_cleaner.clean(lyrics_text)
                                                if cleaned_lyrics:
                                                    logger.info(f"Successfully found lyrics at {href}")
                                                    return cleaned_lyrics
                            
                            except Exception as e:
                                logger.error(f"Error fetching lyrics from {href}: {str(e)}")
                                continue
            
            logger.warning("No lyrics found in custom scraping")
            return None
            
        except Exception as e:
            logger.error(f"Error in custom scraping: {str(e)}")
            return None
    
    async def get_song_info(self, title: str) -> Dict[str, str]:
        """Get song and artist information"""
        if not self.genius:
            return {'song': title, 'artist': 'Unknown'}
            
        try:
            song = self.genius.search_song(title)
            if song and self._validate_song_match(title, song):
                return {
                    'song': song.title,
                    'artist': song.artist
                }
            
            return {'song': title, 'artist': 'Unknown'}
            
        except Exception as e:
            logger.error(f"Error getting song info: {str(e)}")
            return {'song': title, 'artist': 'Unknown'} 