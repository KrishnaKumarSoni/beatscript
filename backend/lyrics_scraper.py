from bs4 import BeautifulSoup
import httpx
import re
from typing import Optional, Dict, Callable
import asyncio
from urllib.parse import unquote
import random
from utils import get_random_headers
import time
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

class LyricsScraper:
    def __init__(self):
        self.scrapers: Dict[str, Callable] = {
            "genius.com": self._scrape_genius,
            "azlyrics.com": self._scrape_azlyrics,
            "musixmatch.com": self._scrape_musixmatch,
            "lyrics.com": self._scrape_lyrics_com,
            "lyricsfreak.com": self._scrape_lyricsfreak,
            # Add Indian lyrics sites
            "hindilyrics.net": self._scrape_hindi_lyrics,
            "lyricsmint.com": self._scrape_lyrics_mint,
            "lyricsbogie.com": self._scrape_lyrics_bogie,
            "lyricsted.com": self._scrape_lyrics_ted,
            "bollywoodlyrics.com": self._scrape_bollywood_lyrics,
            "jiosaavn.com": self._scrape_jiosaavn  # Add JioSaavn scraper
        }
        
        # Rate limiting configuration with exponential backoff
        self.rate_limits = {
            "genius.com": {"base_delay": 1.5, "max_retries": 3},
            "azlyrics.com": {"base_delay": 2.0, "max_retries": 3},
            "musixmatch.com": {"base_delay": 2.0, "max_retries": 3},
            "lyrics.com": {"base_delay": 1.5, "max_retries": 3},
            "lyricsfreak.com": {"base_delay": 1.5, "max_retries": 3},
            "hindilyrics.net": {"base_delay": 1.0, "max_retries": 3},
            "lyricsmint.com": {"base_delay": 1.0, "max_retries": 3},
            "lyricsbogie.com": {"base_delay": 1.0, "max_retries": 3},
            "lyricsted.com": {"base_delay": 1.0, "max_retries": 3},
            "bollywoodlyrics.com": {"base_delay": 1.0, "max_retries": 3},
            "jiosaavn.com": {"base_delay": 1.0, "max_retries": 3}
        }
        
        # Last request timestamps and retry counts
        self.last_requests = {}
        self.retry_counts = {}

    async def _respect_rate_limit(self, domain: str) -> None:
        """Enhanced rate limiting with exponential backoff"""
        current_time = time.time()
        rate_config = self.rate_limits.get(domain, {"base_delay": 1.0, "max_retries": 3})
        
        if domain in self.last_requests:
            time_since_last = current_time - self.last_requests[domain]
            retry_count = self.retry_counts.get(domain, 0)
            
            # Calculate delay with exponential backoff
            delay = rate_config["base_delay"] * (2 ** retry_count)
            if time_since_last < delay:
                await asyncio.sleep(delay - time_since_last)
        
        self.last_requests[domain] = time.time()

    async def _handle_rate_limit(self, domain: str) -> None:
        """Handle rate limit violation"""
        self.retry_counts[domain] = self.retry_counts.get(domain, 0) + 1
        if self.retry_counts[domain] >= self.rate_limits[domain]["max_retries"]:
            raise Exception(f"Max retries exceeded for {domain}")
        
        # Exponential backoff
        await asyncio.sleep(self.rate_limits[domain]["base_delay"] * (2 ** self.retry_counts[domain]))

    async def scrape_lyrics(self, url: str, client: httpx.AsyncClient) -> Optional[str]:
        """Main method to scrape lyrics from any supported site"""
        try:
            # Extract domain from URL
            domain = urlparse(url).netloc.replace('www.', '')
            
            # Find matching scraper
            scraper = None
            for site_domain, site_scraper in self.scrapers.items():
                if site_domain in domain:
                    scraper = site_scraper
                    break
            
            if not scraper:
                logger.warning(f"No scraper found for domain: {domain}")
                return None

            # Respect rate limits
            await self._respect_rate_limit(domain)
            
            # Fetch the page with retries and exponential backoff
            max_retries = 3
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    headers = get_random_headers()
                    headers['Accept-Language'] = 'en-US,en;q=0.9,hi;q=0.8'
                    headers['Referer'] = 'https://www.google.com/'
                    
                    response = await client.get(
                        url, 
                        headers=headers,
                        follow_redirects=True,
                        timeout=10.0
                    )
                    
                    if response.status_code == 200:
                        content_type = response.headers.get('content-type', '')
                        if 'text/html' not in content_type.lower():
                            logger.warning(f"Invalid content type: {content_type}")
                            continue
                        
                        # Clean HTML content before parsing
                        html_content = response.text
                        if 'genius.com' in domain:
                            # Remove everything after 1Embed
                            if '1Embed' in html_content:
                                html_content = html_content.split('1Embed')[0]
                            # Remove other embedded content markers
                            html_content = re.sub(r'<[^>]*embed[^>]*>.*?</[^>]*>', '', html_content, flags=re.IGNORECASE|re.DOTALL)
                        
                        soup = BeautifulSoup(html_content, 'lxml')
                        
                        if any(marker in response.text.lower() for marker in ['captcha', 'security check', 'access denied']):
                            logger.warning(f"Anti-bot measure detected on attempt {attempt + 1}")
                            await asyncio.sleep(2 ** attempt)
                            continue
                        
                        lyrics = await scraper(soup)
                        if lyrics and len(lyrics.strip()) > 10:
                            return self._clean_lyrics(lyrics)
                        else:
                            logger.warning("Lyrics too short or invalid")
                            
                    elif response.status_code == 429:
                        logger.warning(f"Rate limited on attempt {attempt + 1}")
                        await asyncio.sleep(2 ** attempt)
                        continue
                    else:
                        logger.warning(f"HTTP {response.status_code} on attempt {attempt + 1}")
                        await asyncio.sleep(1)
                        continue
                        
                except Exception as e:
                    last_error = e
                    logger.error(f"Attempt {attempt + 1} failed for {url}: {str(e)}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    break
            
            if last_error:
                logger.error(f"All attempts failed for {url}: {str(last_error)}")
            
            return None
        
        except Exception as e:
            logger.error(f"Error scraping lyrics from {url}: {str(e)}")
            return None

    def _clean_lyrics(self, lyrics: str) -> str:
        """Clean up scraped lyrics"""
        try:
            # Remove embedded section if present
            if '1Embed' in lyrics:
                lyrics = lyrics.split('1Embed')[0]
            
            # Initial whitespace cleanup
            lyrics = lyrics.strip()
            
            # Remove HTML entities
            lyrics = re.sub(r'&\w+;', ' ', lyrics)
            
            # Remove multiple spaces and normalize whitespace
            lyrics = re.sub(r'\s+', ' ', lyrics)
            
            # Preserve intentional line breaks while removing excessive ones
            lyrics = re.sub(r'\n\s*\n\s*\n+', '\n\n', lyrics)
            
            # Remove leading/trailing whitespace from each line while preserving indentation
            lines = []
            for line in lyrics.split('\n'):
                stripped = line.rstrip()
                if stripped:  # Keep empty lines for formatting
                    # Preserve intentional indentation for chorus/verses
                    indent = len(line) - len(line.lstrip())
                    lines.append(' ' * indent + stripped)
                else:
                    lines.append('')
            
            lyrics = '\n'.join(lines)
            
            # Remove common ads and unwanted text
            unwanted_patterns = [
                r'(?i)(advertisement|sponsored content|lyrics licensed by|lyrics provided by)',
                r'(?i)(embed|share|copy|print|facebook|twitter)',
                r'(?i)(all rights reserved|copyright ©)',
                r'\d+ contributors',
                r'[0-9]+ views',
                r'you might also like'
            ]
            
            for pattern in unwanted_patterns:
                lyrics = re.sub(pattern, '', lyrics, flags=re.IGNORECASE)
            
            # Remove non-lyrics annotations while preserving important ones
            lyrics = re.sub(r'\[(verse|chorus|bridge|intro|outro)[^\]]*\]', '', lyrics, flags=re.IGNORECASE)
            
            # Final cleanup of whitespace
            lyrics = re.sub(r'\n\s*\n\s*\n+', '\n\n', lyrics)
            lyrics = re.sub(r'[ \t]+$', '', lyrics, flags=re.MULTILINE)
            
            return lyrics.strip()
            
        except Exception as e:
            logger.error(f"Error cleaning lyrics: {str(e)}")
            return lyrics.strip()
    
    async def _scrape_genius(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from Genius with improved duplicate handling"""
        try:
            lyrics_sections = []
            seen_content = set()
            
            # Find all lyrics containers
            containers = soup.find_all(['div', 'p'], {'data-lyrics-container': 'true'})
            if not containers:
                containers = soup.select('[class*="Lyrics__Container"], [class*="lyrics__Container"]')
            
            for container in containers:
                # Skip embedded sections
                if any(marker in str(container).lower() for marker in ['embed', '1embed']):
                    continue
                
                # Clean the container
                for unwanted in container.select('script, style, .ad, .share, .SongHeader'):
                    unwanted.decompose()
                
                # Process the content
                for elem in container.stripped_strings:
                    line = elem.strip()
                    # Skip empty lines and metadata
                    if not line or any(skip in line.lower() for skip in [
                        'embed', 'copyright', 'lyrics licensed', 'contributors',
                        'you might also like', 'lyrics'
                    ]):
                        continue
                    
                    # Use line hash for duplicate detection
                    line_hash = hash(line.lower())
                    if line_hash not in seen_content:
                        seen_content.add(line_hash)
                        lyrics_sections.append(line)
            
            if not lyrics_sections:
                return None
            
            # Join sections and clean
            lyrics = '\n'.join(lyrics_sections)
            lyrics = re.sub(r'\n{3,}', '\n\n', lyrics)
            lyrics = re.sub(r'[ \t]+$', '', lyrics, flags=re.MULTILINE)
            
            return lyrics.strip()
            
        except Exception as e:
            logger.error(f"Error scraping Genius: {str(e)}")
            return None
    
    async def _scrape_azlyrics(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from AZLyrics"""
        try:
            # Find the lyrics div (it's usually unmarked, between comment tags)
            lyrics_div = soup.find('div', {'class': None, 'id': None}, text=re.compile(r'.*'))
            if not lyrics_div:
                return None
            
            # Get text while preserving line breaks
            lyrics = lyrics_div.get_text('\n')
            
            # Clean up any javascript or unwanted text
            lyrics = re.sub(r'\/\*.*?\*\/', '', lyrics, flags=re.DOTALL)
            
            return lyrics
        
        except Exception as e:
            print(f"Error scraping AZLyrics: {str(e)}")
            return None
    
    async def _scrape_musixmatch(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from Musixmatch"""
        try:
            # Find all lyrics spans
            lyrics_spans = soup.select('span[class*="lyrics__content__"]')
            if not lyrics_spans:
                return None
            
            # Combine all spans while preserving line breaks
            lyrics = []
            for span in lyrics_spans:
                lyrics.append(span.get_text('\n'))
            
            return '\n'.join(lyrics)
        
        except Exception as e:
            print(f"Error scraping Musixmatch: {str(e)}")
            return None
    
    async def _scrape_lyrics_com(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from Lyrics.com"""
        try:
            # Find the lyrics container
            lyrics_container = soup.select_one('pre[id="lyric-body-text"]')
            if not lyrics_container:
                return None
            
            # Get text while preserving formatting
            lyrics = lyrics_container.get_text('\n')
            
            return lyrics
        
        except Exception as e:
            print(f"Error scraping Lyrics.com: {str(e)}")
            return None
    
    async def _scrape_lyricsfreak(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from LyricsFreak"""
        try:
            # Find the lyrics div
            lyrics_div = soup.select_one('div[id="content"]')
            if not lyrics_div:
                return None
            
            # Remove any ads or unwanted elements
            for unwanted in lyrics_div.select('script, style, .ad'):
                unwanted.decompose()
            
            # Get text while preserving line breaks
            lyrics = lyrics_div.get_text('\n')
            
            return lyrics
        
        except Exception as e:
            print(f"Error scraping LyricsFreak: {str(e)}")
            return None

    async def _scrape_hindi_lyrics(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from HindiLyrics.net"""
        try:
            lyrics_div = soup.select_one('.entry-content, .lyrics-content, .song-lyrics')
            if not lyrics_div:
                return None
            
            # Remove unwanted elements
            for unwanted in lyrics_div.select('script, style, .ad, .share-buttons, .navigation'):
                unwanted.decompose()
            
            # Extract lyrics with proper formatting
            lyrics = []
            for elem in lyrics_div.children:
                if isinstance(elem, str):
                    lyrics.append(elem.strip())
                elif elem.name == 'br':
                    lyrics.append('')
                elif elem.name in ['p', 'div']:
                    lyrics.append(elem.get_text('\n').strip())
            
            return '\n'.join(line for line in lyrics if line)
            
        except Exception as e:
            logger.error(f"Error scraping HindiLyrics: {str(e)}")
            return None

    async def _scrape_lyrics_mint(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from LyricsMint"""
        try:
            lyrics_div = soup.select_one('#lyrics_text, .lyrics_text, .lyric-content')
            if not lyrics_div:
                return None
            
            # Remove unwanted elements
            for unwanted in lyrics_div.select('script, style, .ad, .share'):
                unwanted.decompose()
            
            return lyrics_div.get_text('\n').strip()
            
        except Exception as e:
            logger.error(f"Error scraping LyricsMint: {str(e)}")
            return None

    async def _scrape_lyrics_bogie(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from LyricsBogie"""
        try:
            lyrics_div = soup.select_one('.lyrics-section, .entry-content')
            if not lyrics_div:
                return None
            
            # Remove unwanted elements
            for unwanted in lyrics_div.select('script, style, .ad, .share'):
                unwanted.decompose()
            
            return lyrics_div.get_text('\n').strip()
            
        except Exception as e:
            logger.error(f"Error scraping LyricsBogie: {str(e)}")
            return None

    async def _scrape_lyrics_ted(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from LyricsTed"""
        try:
            lyrics_div = soup.select_one('.lyrics-content, .song-lyrics')
            if not lyrics_div:
                return None
            
            # Remove unwanted elements
            for unwanted in lyrics_div.select('script, style, .ad, .share'):
                unwanted.decompose()
            
            return lyrics_div.get_text('\n').strip()
            
        except Exception as e:
            logger.error(f"Error scraping LyricsTed: {str(e)}")
            return None

    async def _scrape_bollywood_lyrics(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from BollywoodLyrics"""
        try:
            lyrics_div = soup.select_one('.entry-content, .lyrics-content')
            if not lyrics_div:
                return None
            
            # Remove unwanted elements
            for unwanted in lyrics_div.select('script, style, .ad, .share'):
                unwanted.decompose()
            
            return lyrics_div.get_text('\n').strip()
            
        except Exception as e:
            logger.error(f"Error scraping BollywoodLyrics: {str(e)}")
            return None

    async def _scrape_jiosaavn(self, soup: BeautifulSoup, url: str) -> Optional[str]:
        """Scrape lyrics from JioSaavn"""
        try:
            # Extract song ID from URL
            song_id = url.split('/')[-1]
            if not song_id:
                return None

            async with httpx.AsyncClient(timeout=30.0) as client:
                # Get song details
                await self._respect_rate_limit("jiosaavn.com")
                details_url = f"https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids={song_id}"
                details_response = await client.get(
                    details_url,
                    headers=get_random_headers(),
                    follow_redirects=True
                )
                
                if details_response.status_code == 429:
                    await self._handle_rate_limit("jiosaavn.com")
                    return None
                
                details_response.raise_for_status()
                song_details = details_response.json()
                
                # Get lyrics if available
                lyrics_id = song_details.get(song_id, {}).get('lyrics_id')
                if not lyrics_id:
                    return None

                await self._respect_rate_limit("jiosaavn.com")
                lyrics_url = f"https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&_format=json&_marker=0%3F_marker%3D0&lyrics_id={lyrics_id}"
                lyrics_response = await client.get(
                    lyrics_url,
                    headers=get_random_headers(),
                    follow_redirects=True
                )
                
                if lyrics_response.status_code == 429:
                    await self._handle_rate_limit("jiosaavn.com")
                    return None
                
                lyrics_response.raise_for_status()
                lyrics_data = lyrics_response.json()
                
                if lyrics_data and 'lyrics' in lyrics_data:
                    return lyrics_data['lyrics']
            
            return None
            
        except Exception as e:
            logger.error(f"Error scraping JioSaavn: {str(e)}")
            return None 