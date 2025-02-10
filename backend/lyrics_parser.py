import logging
from typing import Optional, Dict, Any
from bs4 import BeautifulSoup
import httpx
import re

logger = logging.getLogger(__name__)

class LyricsParser:
    @staticmethod
    async def extract_lyrics_from_search(html: str, source: str) -> Optional[Dict[str, Any]]:
        """Extract lyrics from search result pages"""
        try:
            soup = BeautifulSoup(html, 'lxml')
            
            if source == 'genius':
                # Find song hits in Genius search results
                hits = soup.select('.mini_card, .search_result, .song_card')
                for hit in hits:
                    link = hit.select_one('a[href*="/lyrics/"]')
                    if not link:
                        continue
                    
                    url = link.get('href')
                    if not url:
                        continue
                    
                    # Get song info
                    title_elem = hit.select_one('.title_with_artists, .search_result_title, .song_title')
                    artist_elem = hit.select_one('.artist_name, .search_result_subtitle, .song_artist')
                    
                    if not title_elem or not artist_elem:
                        continue
                    
                    title = title_elem.get_text().strip()
                    artist = artist_elem.get_text().strip()
                    
                    # Try to get lyrics from the song page
                    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                        headers = {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        }
                        response = await client.get(url, headers=headers)
                        if response.status_code == 200:
                            lyrics = await LyricsParser.extract_lyrics_from_html(response.text, source)
                            if lyrics:
                                return {
                                    'lyrics': lyrics,
                                    'song': title,
                                    'artist': artist,
                                    'source': url,
                                    'source_favicon': 'https://genius.com/favicon.ico'
                                }
            
            elif source == 'azlyrics':
                # Find song hits in AZLyrics search results
                hits = soup.select('.table-condensed td a[href*="/lyrics/"]')
                for hit in hits:
                    url = hit.get('href')
                    if not url:
                        continue
                    
                    if not url.startswith('http'):
                        url = f'https://www.azlyrics.com{url}'
                    
                    # Try to get lyrics from the song page
                    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                        headers = {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                        }
                        response = await client.get(url, headers=headers)
                        if response.status_code == 200:
                            lyrics = await LyricsParser.extract_lyrics_from_html(response.text, source)
                            if lyrics:
                                # Extract title and artist from URL
                                parts = url.split('/')
                                if len(parts) >= 5:
                                    artist = parts[-2].replace('-', ' ').title()
                                    title = parts[-1].replace('.html', '').replace('-', ' ').title()
                                    return {
                                        'lyrics': lyrics,
                                        'song': title,
                                        'artist': artist,
                                        'source': url,
                                        'source_favicon': 'https://www.azlyrics.com/favicon.ico'
                                    }
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting lyrics from search results: {str(e)}")
            return None
    
    @staticmethod
    async def extract_lyrics_from_html(html: str, source: str) -> Optional[str]:
        """Extract lyrics from HTML content"""
        try:
            soup = BeautifulSoup(html, 'lxml')
            
            if source == 'genius':
                # Find lyrics containers
                lyrics_containers = soup.find_all('div', {'data-lyrics-container': 'true'})
                if not lyrics_containers:
                    lyrics_containers = soup.find_all('div', {'class': 'lyrics'})
                
                if not lyrics_containers:
                    return None
                
                # Process each container
                all_lyrics = []
                for container in lyrics_containers:
                    # Remove unwanted elements
                    for unwanted in container.find_all(['script', 'button', 'ads']):
                        unwanted.decompose()
                    
                    # Replace <br> tags with newlines
                    for br in container.find_all('br'):
                        br.replace_with('\n')
                    
                    # Get text content
                    text = container.get_text(separator='\n', strip=True)
                    lines = [line.strip() for line in text.split('\n')]
                    all_lyrics.append('\n'.join(lines))
                
                return '\n\n'.join(all_lyrics).strip()
            
            elif source == 'azlyrics':
                # Find main lyrics div
                lyrics_div = soup.find('div', {'class': None, 'id': None}, text=True)
                if not lyrics_div:
                    return None
                
                # Clean up the text
                text = lyrics_div.get_text(separator='\n', strip=True)
                lines = [line.strip() for line in text.split('\n')]
                return '\n'.join(lines).strip()
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting lyrics from HTML: {str(e)}")
            return None 