import os
import logging
from typing import Optional, Dict, Any, List
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
                timeout=30,        # Increased from 15s to 30s for reliability
                sleep_time=1.5,    # Increased from 0.5s to 1.5s to avoid rate limits
                retries=5,         # Increased from 3 to 5 for better reliability
                verbose=False,
                remove_section_headers=False,  # Keep structure
                skip_non_songs=True  # Skip non-songs
            )
            # Expanded excluded terms
            self.genius.excluded_terms = [
                "(Remix)", "(Live)", "(Cover)", "Karaoke", 
                "Instrumental", "Extended", "VIP Mix", 
                "Club Mix", "Radio Edit", "Acoustic",
                "Reprise", "Version", "Edit", "Mix",
                "Remaster", "Demo", "Bonus"
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
        """Validate if the found song matches our search criteria with improved handling"""
        if not song:
            return False
            
        # Clean strings for comparison
        search_clean = self._smart_clean_title(search_title)
        title_clean = self._smart_clean_title(song.title)
        artist_clean = self._smart_clean_title(song.artist)
        
        logger.info(f"Validating match - Search: {search_clean}, Found Title: {title_clean}, Artist: {artist_clean}")
        
        # 1. Check if all search terms exist in either title or artist
        search_terms = self._extract_significant_terms(search_clean)
        combined_target = f"{title_clean} {artist_clean}"
        
        terms_found = 0
        for term in search_terms:
            # Check exact match first
            if term in combined_target:
                terms_found += 1
                continue
            
            # Check fuzzy match
            target_terms = self._extract_significant_terms(combined_target)
            for target_term in target_terms:
                if self._string_similarity(term, target_term) > 0.8:
                    terms_found += 0.8
                    break
                
        terms_coverage = terms_found / len(search_terms) if search_terms else 0
        logger.info(f"Terms coverage: {terms_coverage}")
        
        # If we found most of the search terms, this is likely a match
        if terms_coverage > 0.6:  # Lowered from 0.7 for better recall
            logger.info("Accepted based on terms coverage")
            return True
        
        # 2. Check title similarity with more lenient threshold
        title_similarity = self._string_similarity(search_clean, title_clean)
        logger.info(f"Title similarity: {title_similarity}")
        
        if title_similarity > 0.7:  # Lowered from 0.9 for better recall
            logger.info("Accepted based on title similarity")
            return True
        
        # 3. Check if the title contains all major terms from search
        # This helps with cases where order is different or artist is part of title
        search_major_terms = set(term for term in search_terms if len(term) > 3)
        title_major_terms = set(term for term in self._extract_significant_terms(title_clean) if len(term) > 3)
        artist_major_terms = set(term for term in self._extract_significant_terms(artist_clean) if len(term) > 3)
        
        # Combine title and artist terms
        target_major_terms = title_major_terms.union(artist_major_terms)
        
        # Calculate how many major terms match
        matching_terms = 0
        for search_term in search_major_terms:
            if search_term in target_major_terms:
                matching_terms += 1
                continue
            
            # Try fuzzy matching for non-exact matches
            for target_term in target_major_terms:
                if self._string_similarity(search_term, target_term) > 0.8:
                    matching_terms += 0.8
                    break
        
        major_terms_ratio = matching_terms / len(search_major_terms) if search_major_terms else 0
        logger.info(f"Major terms match ratio: {major_terms_ratio}")
        
        if major_terms_ratio > 0.6:  # Good coverage of major terms
            logger.info("Accepted based on major terms coverage")
            return True
        
        # 4. Special handling for non-English titles
        if any(self._has_non_english_chars(text) for text in [search_clean, title_clean, artist_clean]):
            # Be more lenient with matching for non-English content
            if title_similarity > 0.5 and terms_coverage > 0.5:
                logger.info("Accepted based on non-English title match criteria")
                return True
        
        logger.info("Song validation failed")
        return False
    
    def _has_non_english_chars(self, text: str) -> bool:
        """Check if text contains non-English characters"""
        # Define ranges for common non-English scripts
        ranges = [
            (0x0900, 0x097F),  # Devanagari
            (0x0980, 0x09FF),  # Bengali
            (0x0A00, 0x0A7F),  # Gurmukhi
            (0x0600, 0x06FF),  # Arabic
            (0x0400, 0x04FF),  # Cyrillic
        ]
        
        return any(any(ord(c) >= start and ord(c) <= end for start, end in ranges) for c in text)

    def _smart_clean_title(self, text: str) -> str:
        """Smart title cleaning with improved handling"""
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower().strip()
        
        # Remove common filler words
        filler_words = [
            'official', 'video', 'audio', 'lyrics', 'full', 'hd', 
            'ft.', 'feat.', 'featuring', 'prod.', 'prod by', 'music',
            'official video', 'official audio', 'lyric video',
            'with lyrics', 'high quality', '4k', '1080p'
        ]
        
        # Sort longer phrases first to prevent partial matches
        filler_words.sort(key=len, reverse=True)
        
        for word in filler_words:
            text = re.sub(rf'\b{word}\b', '', text, flags=re.IGNORECASE)
        
        # Remove special characters but preserve important ones
        text = re.sub(r'[^\w\s\-]', '', text)
        
        # Normalize whitespace
        text = ' '.join(text.split())
        
        return text

    def _is_exact_match(self, str1: str, str2: str) -> bool:
        """Check for exact match after cleaning"""
        return str1 == str2

    def _extract_significant_terms(self, text: str) -> List[str]:
        """Extract significant terms from text"""
        # Split into words
        words = text.split()
        
        # Remove very short words and common words
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'}
        return [word for word in words if len(word) > 2 and word not in common_words]

    def _calculate_term_match_score(self, search_terms: List[str], title_terms: List[str]) -> float:
        """Calculate weighted match score between term lists"""
        if not search_terms:
            return 0.0
        
        matched_terms = 0
        for search_term in search_terms:
            # Look for exact matches first
            if search_term in title_terms:
                matched_terms += 1
                continue
            
            # Look for fuzzy matches
            for title_term in title_terms:
                if self._string_similarity(search_term, title_term) > 0.8:
                    matched_terms += 0.8
                    break
        
        return matched_terms / len(search_terms)

    def _validate_term_positions(self, search_terms: List[str], title_terms: List[str]) -> bool:
        """Validate the relative positions of matched terms"""
        if not search_terms or not title_terms:
            return False
        
        # Find positions of matched terms
        matched_positions = []
        for i, search_term in enumerate(search_terms):
            for j, title_term in enumerate(title_terms):
                if search_term == title_term or self._string_similarity(search_term, title_term) > 0.8:
                    matched_positions.append((i, j))
                    break
        
        if not matched_positions:
            return False
        
        # Check if the relative ordering is preserved
        for i in range(len(matched_positions)-1):
            if matched_positions[i][0] < matched_positions[i+1][0] and \
               matched_positions[i][1] > matched_positions[i+1][1]:
                return False
        
        return True

    def _extract_artist_name(self, search_title: str) -> Optional[str]:
        """Extract artist name from search title with improved handling"""
        # Check for common separators
        separators = [' - ', ' – ', ' by ', ': ', ' _ ']
        for separator in separators:
            if separator in search_title:
                parts = search_title.split(separator, 1)
                return self._smart_clean_title(parts[0])
                            
            return None
            
    async def search_lyrics(self, title: str, _: str = "") -> Optional[str]:
        """Search for lyrics using LyricsGenius with fallback to custom scraping"""
        if not self.genius:
            logger.error("Genius API not initialized")
            return None
            
        try:
            # First try: Direct song search with LyricsGenius
            song = self.genius.search_song(title)
            if song and self._validate_song_match(title, song):
                logger.info("Found lyrics through direct song search")
                return self.lyrics_cleaner.clean(song.lyrics)  # Clean lyrics before returning
            
            # Second try: Search by title components if first try failed
            if " - " in title:
                artist, song_title = title.split(" - ", 1)
                logger.info(f"Trying search with artist: {artist}, title: {song_title}")
                song = self.genius.search_song(song_title, artist)
                if song and self._validate_song_match(title, song):
                    logger.info("Found lyrics through artist-title search")
                    return self.lyrics_cleaner.clean(song.lyrics)  # Clean lyrics before returning
            
            # Third try: Search by lyrics if still no results and title has enough words
            if len(title.split()) >= 2:
                logger.info("Trying lyrics search")
                results = self.genius.search_lyrics(title)
                if results and 'sections' in results and results['sections']:
                    for hit in results['sections'][0]['hits']:
                        song_id = hit['result']['id']
                        song = self.genius.search_song(song_id=song_id)
                        if song and self._validate_song_match(title, song):
                            logger.info("Found lyrics through lyrics search")
                            return self.lyrics_cleaner.clean(song.lyrics)  # Clean lyrics before returning
            
            # No lyrics found in Genius
            logger.info("No matches found on Genius")
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