import os
import logging
from typing import Optional, Dict, Any
import lyricsgenius
from difflib import SequenceMatcher
from dotenv import load_dotenv
from lyrics_cleaner import LyricsCleaner
import httpx
from bs4 import BeautifulSoup
import re
from urllib.parse import urlparse, parse_qs

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeniusAPI:
    def __init__(self):
        self.access_token = os.getenv('GENIUS_ACCESS_TOKEN')
        self.lyrics_cleaner = LyricsCleaner()
        
        if self.access_token:
            # Initialize with API token if available
            self.genius = lyricsgenius.Genius(
                self.access_token,
                timeout=15,
                sleep_time=0.5,
                retries=3,
                verbose=False,
                remove_section_headers=False,  # Keep structure
                skip_non_songs=True  # Skip non-songs
            )
            # Configure excluded terms
            self.genius.excluded_terms = [
                "(Remix)", "(Live)", "(Cover)",
                "Karaoke", "Instrumental", "Extended",
                "VIP Mix", "Club Mix", "Radio Edit"
            ]
            logger.info("Initialized Genius API with token")
        else:
            self.genius = None
            logger.warning("No Genius API token found")
    
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
        
        # Calculate title similarity
        similarity = self._string_similarity(search_clean, title_clean)
        logger.info(f"Title similarity: {similarity} (search: {search_clean}, found: {title_clean})")
        
        # Extract potential artist name from search
        artist_name = None
        if " - " in search_title:
            parts = search_title.split(" - ")
            artist_name = re.sub(r'[^\w\s]', '', parts[0].lower().strip())
            logger.info(f"Extracted artist name: {artist_name}")
            
            # Calculate artist similarity if we have an artist name
            if artist_name:
                artist_similarity = self._string_similarity(artist_name, artist_clean)
                logger.info(f"Artist similarity: {artist_similarity}")
                
                # If we have a good artist match and decent title match, accept it
                if artist_similarity > 0.7 and similarity > 0.5:
                    logger.info("Accepted based on good artist match and decent title match")
                    return True
        
        # Accept if title similarity is very high
        if similarity > 0.8:
            logger.info("Accepted based on high title similarity")
            return True
        
        # Accept if search terms are found in title
        search_terms = set(search_clean.split())
        title_terms = set(title_clean.split())
        common_terms = search_terms.intersection(title_terms)
        if len(common_terms) >= min(2, len(search_terms)):
            logger.info("Accepted based on common terms")
            return True
        
        # If we have artist name and it's a good match, be more lenient with title
        if artist_name and self._string_similarity(artist_name, artist_clean) > 0.7:
            remaining_search = search_clean.replace(artist_name, '').strip()
            if self._string_similarity(remaining_search, title_clean) > 0.6:
                logger.info("Accepted based on artist match and partial title match")
                return True
        
        logger.info("Song validation failed")
        return False
    
    async def search_lyrics(self, title: str, _: str = "") -> Optional[str]:
        """Search for lyrics using LyricsGenius with fallback to custom scraping"""
        if not self.genius:
            logger.error("Genius API not initialized")
            return None
            
        try:
            # Track if we've found lyrics to avoid multiple returns
            found_lyrics = None
            
            # First try: Direct song search with LyricsGenius
            song = self.genius.search_song(title)
            if song and self._validate_song_match(title, song):
                logger.info("Found lyrics through direct song search")
                return self.lyrics_cleaner.clean(song.lyrics)
            
            # Second try: Search by title components if first try failed
            if not found_lyrics and " - " in title:
                artist, song_title = title.split(" - ", 1)
                logger.info(f"Trying search with artist: {artist}, title: {song_title}")
                song = self.genius.search_song(song_title, artist)
                if song and self._validate_song_match(title, song):
                    logger.info("Found lyrics through artist-title search")
                    return self.lyrics_cleaner.clean(song.lyrics)
            
            # Third try: Search by lyrics if still no results and title has enough words
            if not found_lyrics and len(title.split()) >= 2:
                logger.info("Trying lyrics search")
                results = self.genius.search_lyrics(title)
                if results and 'sections' in results and results['sections']:
                    for hit in results['sections'][0]['hits']:
                        song_id = hit['result']['id']
                        song = self.genius.search_song(song_id=song_id)
                        if song and self._validate_song_match(title, song):
                            logger.info("Found lyrics through lyrics search")
                            return self.lyrics_cleaner.clean(song.lyrics)
            
            # Final fallback: Try custom scraping only if no lyrics found
            if not found_lyrics:
                logger.info("No matches found on Genius, trying custom scraping fallback")
                scraped_lyrics = await self._scrape_lyrics_fallback(title)
                if scraped_lyrics:
                    return scraped_lyrics
            
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