from bs4 import BeautifulSoup
import httpx
import re
from typing import Optional, Dict, Callable
import asyncio
from urllib.parse import unquote
import random
from utils import get_random_headers

class LyricsScraper:
    def __init__(self):
        self.scrapers: Dict[str, Callable] = {
            "genius.com": self._scrape_genius,
            "azlyrics.com": self._scrape_azlyrics,
            "musixmatch.com": self._scrape_musixmatch,
            "lyrics.com": self._scrape_lyrics_com,
            "lyricsfreak.com": self._scrape_lyricsfreak
        }
    
    async def scrape_lyrics(self, url: str, client: httpx.AsyncClient) -> Optional[str]:
        """Main method to scrape lyrics from any supported site"""
        try:
            # Determine which scraper to use based on URL
            for domain, scraper in self.scrapers.items():
                if domain in url:
                    # Add delay to respect rate limits
                    await asyncio.sleep(random.uniform(1, 2))
                    
                    # Fetch the page with retries and exponential backoff
                    max_retries = 3
                    last_error = None
                    
                    for attempt in range(max_retries):
                        try:
                            # Rotate headers and add cookies support
                            headers = get_random_headers()
                            headers['Accept-Language'] = 'en-US,en;q=0.9'
                            headers['Referer'] = 'https://www.google.com/'
                            
                            response = await client.get(
                                url, 
                                headers=headers,
                                follow_redirects=True,
                                timeout=10.0
                            )
                            
                            if response.status_code == 200:
                                # Check if we got a valid HTML response
                                content_type = response.headers.get('content-type', '')
                                if 'text/html' not in content_type.lower():
                                    print(f"Invalid content type: {content_type}")
                                    continue
                                
                                # Parse with BeautifulSoup using lxml for better performance
                                soup = BeautifulSoup(response.text, 'lxml')
                                
                                # Check for common anti-bot measures
                                if any(marker in response.text.lower() for marker in ['captcha', 'security check', 'access denied']):
                                    print(f"Anti-bot measure detected on attempt {attempt + 1}")
                                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                                    continue
                                
                                # Use the appropriate scraper
                                lyrics = await scraper(soup)
                                if lyrics:
                                    # Validate lyrics content
                                    if len(lyrics.strip()) > 10:  # Minimum reasonable length
                                        return self._clean_lyrics(lyrics)
                                    else:
                                        print("Lyrics too short, might be invalid")
                                        continue
                                
                            elif response.status_code == 429:  # Too Many Requests
                                print(f"Rate limited on attempt {attempt + 1}")
                                await asyncio.sleep(2 ** attempt)  # Exponential backoff
                                continue
                            else:
                                print(f"HTTP {response.status_code} on attempt {attempt + 1}")
                                await asyncio.sleep(1)
                                continue
                                
                        except Exception as e:
                            last_error = e
                            print(f"Attempt {attempt + 1} failed for {url}: {str(e)}")
                            if attempt < max_retries - 1:
                                await asyncio.sleep(2 ** attempt)
                                continue
                            break
                    
                    if last_error:
                        print(f"All attempts failed for {url}: {str(last_error)}")
            
            return None
        
        except Exception as e:
            print(f"Error scraping lyrics from {url}: {str(e)}")
            return None
    
    def _clean_lyrics(self, lyrics: str) -> str:
        """Clean up scraped lyrics"""
        try:
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
                r'[0-9]+ views'
            ]
            
            for pattern in unwanted_patterns:
                lyrics = re.sub(pattern, '', lyrics)
            
            # Remove non-lyrics annotations while preserving important ones
            lyrics = re.sub(r'\[(verse|chorus|bridge|intro|outro)[^\]]*\]', '', lyrics, flags=re.IGNORECASE)
            
            # Final cleanup of whitespace
            lyrics = re.sub(r'\n\s*\n\s*\n+', '\n\n', lyrics)
            lyrics = re.sub(r'[ \t]+$', '', lyrics, flags=re.MULTILINE)
            
            return lyrics.strip()
            
        except Exception as e:
            print(f"Error cleaning lyrics: {str(e)}")
            return lyrics.strip()
    
    async def _scrape_genius(self, soup: BeautifulSoup) -> Optional[str]:
        """Scrape lyrics from Genius"""
        try:
            # Try multiple possible selectors for lyrics container
            selectors = [
                '[class*="Lyrics__Container"]',
                '[class*="lyrics__Container"]',
                '[class*="LyricsPlaceholder__Container"]',
                '#lyrics-root',
                '.lyrics',
                '[data-lyrics-container="true"]'
            ]
            
            lyrics_container = None
            for selector in selectors:
                lyrics_container = soup.select_one(selector)
                if lyrics_container:
                    break
            
            if not lyrics_container:
                # Try finding by common text patterns
                for div in soup.find_all('div'):
                    if div.get_text() and any(marker in div.get_text().lower() for marker in ['verse', 'chorus', 'bridge']):
                        lyrics_container = div
                        break
            
            if not lyrics_container:
                return None
            
            # Remove script tags and unwanted elements
            for unwanted in lyrics_container.select('script, style, .ad, .share, .SongHeader'):
                unwanted.decompose()
            
            # Handle line breaks properly
            for br in lyrics_container.find_all('br'):
                br.replace_with('\n')
            
            # Get text while preserving all formatting
            text = lyrics_container.get_text('\n')
            
            return text.strip()
        
        except Exception as e:
            print(f"Error scraping Genius: {str(e)}")
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