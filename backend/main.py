from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import re
from typing import List, Optional, Tuple, Callable, Dict, Any
import asyncio
from urllib.parse import quote_plus, unquote
import random
from lyrics_scraper import LyricsScraper
from genius_api import GeniusAPI
from utils import get_random_headers
from bs4 import BeautifulSoup
import os
import logging
import json
from lyrics_cleaner import LyricsCleaner
from firebase_service import firebase_service
from fastapi.responses import JSONResponse
from itertools import permutations

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize components
app = FastAPI()
genius_api = GeniusAPI()
lyrics_cleaner = LyricsCleaner()
lyrics_scraper = LyricsScraper()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Common filler words in YouTube titles
FILLER_WORDS = [
    r"\(Official\s+(?:Video|Audio)\)",
    r"\[Official\s+(?:Video|Audio)\]",
    r"\(Lyric\s*(?:Video|Audio)?\)",
    r"\[Lyric\s*(?:Video|Audio)?\]",
    r"\(Lyrics\)",
    r"\[Lyrics\]",
    r"\(Official\s+Music\s+Video\)",
    r"\[Official\s+Music\s+Video\]",
    r"\(Official\s+Lyric\s+Video\)",
    r"\[Official\s+Lyric\s+Video\]",
    r"\(Audio\)",
    r"\[Audio\]",
    r"\(Visualizer\)",
    r"\[Visualizer\]",
    r"\(Official\)",
    r"\[Official\]",
    r"\(Music\s+Video\)",
    r"\[Music\s+Video\]",
    r"HD",
    r"HQ",
    r"4K",
    r"Official\s+Version",
    r"Full\s+Version",
    r"Extended\s+Version",
    r"ft\.",
    r"feat\.",
    r"featuring",
    r"Official\s+Video",
    r"Official\s+Audio",
    r"Official\s+Music",
    r"Official",
    r"Video",
    r"Audio",
    r"Music",
    r"Live",
    r"Performance",
    r"Cover",
]

# Browser-like headers with rotating User-Agents
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
]


def get_random_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }


# Lyrics websites to search with their search patterns and direct URL templates
LYRICS_SITES = [
    (
        "genius.com",
        [
            r'href="(https://genius\.com/[^"]+)"',
            r'<a[^>]+href="(https://genius\.com/[^"]+)"',
        ],
    ),
    (
        "azlyrics.com",
        [
            r'href="(https://www\.azlyrics\.com/lyrics/[^"]+)"',
            r'<a[^>]+href="(https://www\.azlyrics\.com/lyrics/[^"]+)"',
        ],
    ),
    (
        "lyrics.com",
        [
            r'href="(https://www\.lyrics\.com/lyric/[^"]+)"',
            r'<a[^>]+href="(https://www\.lyrics\.com/lyric/[^"]+)"',
        ],
    ),
    (
        "musixmatch.com",
        [
            r'href="(https://www\.musixmatch\.com/lyrics/[^"]+)"',
            r'<a[^>]+href="(https://www\.musixmatch\.com/lyrics/[^"]+)"',
        ],
    ),
    (
        "lyricsfreak.com",
        [
            r'href="(https://www\.lyricsfreak\.com/[^"]+/[^"]+\.html)"',
            r'<a[^>]+href="(https://www\.lyricsfreak\.com/[^"]+/[^"]+\.html)"',
        ],
    ),
]


class LyricsError(Exception):
    """Custom exception for lyrics-related errors"""
    def __init__(self, source: str, stage: str, message: str):
        self.source = source
        self.stage = stage
        self.message = message
        super().__init__(f"{source} error at {stage}: {message}")

class SearchRequest(BaseModel):
    title: str

class SongResponse(BaseModel):
    song: str
    artist: str
    type: str = "lyrical"  # can be "lyrical", "instrumental", or "error"
    lyrics: Optional[str] = None
    error: Optional[str] = None
    source: Optional[str] = None  # indicates which source provided the lyrics


def clean_title(title: str) -> str:
    """Remove filler words and clean up YouTube title"""
    # Convert to lowercase for better matching
    cleaned = title.lower()

    # Remove filler words
    for pattern in FILLER_WORDS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    # Remove brackets and parentheses and their contents
    cleaned = re.sub(r"\[.*?\]|\(.*?\)", "", cleaned)

    # Remove special characters except spaces and alphanumeric
    cleaned = re.sub(r"[^\w\s-]", "", cleaned)

    # Remove extra whitespace and trim
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    print(f"Cleaned title: {cleaned}")
    return cleaned


async def check_url_accessibility(url: str, client: httpx.AsyncClient) -> bool:
    """Check if a URL is accessible with retries"""
    max_retries = 3
    for _ in range(max_retries):
        try:
            response = await client.head(
                url, follow_redirects=True, timeout=5.0, headers=get_random_headers()
            )
            if response.status_code == 200:
                return True
            await asyncio.sleep(1)
        except Exception as e:
            print(f"Error checking URL {url}: {str(e)}")
            await asyncio.sleep(1)
    return False


def construct_direct_urls(song: str, artist: str) -> List[str]:
    """Construct direct URLs for lyrics sites based on song and artist"""
    # Clean and format song and artist for URLs
    song_slug = re.sub(r"[^\w\s-]", "", song.lower()).replace(" ", "-")
    artist_slug = re.sub(r"[^\w\s-]", "", artist.lower()).replace(" ", "-")

    urls = []

    # Genius.com format
    urls.append(f"https://genius.com/{artist_slug}-{song_slug}-lyrics")

    # AZLyrics format
    urls.append(f"https://www.azlyrics.com/lyrics/{artist_slug}/{song_slug}.html")

    # Musixmatch format
    urls.append(f"https://www.musixmatch.com/lyrics/{artist_slug}/{song_slug}")

    return urls


async def search_lyrics_site(
    title: str, site_info: Tuple[str, List[str]], client: httpx.AsyncClient
) -> Optional[str]:
    """Search for lyrics on a specific site"""
    site, patterns = site_info

    # First try direct URL construction
    parts = title.split("-") if "-" in title else title.split()
    if len(parts) >= 2:
        if "-" in title:
            song, artist = parts[0].strip(), parts[1].strip()
        else:
            artist = parts[-1].strip()
            song = " ".join(parts[:-1]).strip()

        direct_urls = construct_direct_urls(song, artist)
        for url in direct_urls:
            if site in url and await check_url_accessibility(url, client):
                return url

    # If direct URLs fail, try search
    search_query = f"{title} lyrics {site}"
    encoded_query = quote_plus(search_query)

    search_urls = [
        f"https://www.google.com/search?q={encoded_query}",
        f"https://html.duckduckgo.com/html?q={encoded_query}",
        f"https://lite.duckduckgo.com/lite?q={encoded_query}",
    ]

    for search_url in search_urls:
        try:
            response = await client.get(
                search_url,
                headers=get_random_headers(),
                follow_redirects=True,
                timeout=10.0,
            )
            
            if response.status_code == 200:
                text = response.text

                for pattern in patterns:
                    urls = re.findall(pattern, text, re.IGNORECASE)
                    if urls:
                        for url in urls:
                            url = unquote(url).split("&amp;")[0].split("?")[0]
                            if await check_url_accessibility(url, client):
                                return url

            await asyncio.sleep(random.uniform(1, 2))
        except Exception as e:
            print(f"Error searching {site} via {search_url}: {str(e)}")
            continue

    return None


def is_likely_instrumental(title: str) -> bool:
    """Check if the song is likely instrumental"""
    instrumental_indicators = [
        "instrumental",
        "karaoke",
        "backing track",
        "no vocals",
        "music only",
        "beat",
        "bgm",
        "background music",
    ]
    title_lower = title.lower()
    return any(indicator in title_lower for indicator in instrumental_indicators)


async def search_general_lyrics(title: str, client: httpx.AsyncClient) -> Optional[Tuple[str, str]]:
    """Final backup method to search for lyrics on any website"""
    try:
        # Prioritized search queries for Indian content
        search_queries = [
            # Direct site searches
            f"{title} lyrics site:hindilyrics.net",
            f"{title} lyrics site:lyricsmint.com",
            f"{title} lyrics site:lyricsbogie.com",
            f"{title} lyrics site:lyricsted.com",
            f"{title} lyrics site:bollywoodlyrics.com",
            
            # Specialized searches
            f"{title} hindi lyrics",
            f"{title} bollywood lyrics",
            f"{title} indian lyrics",
            f"{title} lyrics with translation",
            
            # Word permutations for Indian songs
            *[f"{' '.join(p)} hindi lyrics" for p in permutations(title.split(), len(title.split()))],
            *[f"{' '.join(p)} bollywood lyrics" for p in permutations(title.split(), len(title.split()))]
        ]

        for query in search_queries:
            try:
                # Try both Google and DuckDuckGo for each query
                search_urls = [
                    f"https://www.google.com/search?q={quote_plus(query)}",
                    f"https://html.duckduckgo.com/html?q={quote_plus(query)}"
                ]

                for search_url in search_urls:
                    logger.info(f"Trying search URL: {search_url}")
                    response = await client.get(
                        search_url,
                        headers=get_random_headers(),
                        follow_redirects=True,
                        timeout=10.0
                    )

                    if response.status_code == 200:
                        soup = BeautifulSoup(response.text, 'lxml')
                        
                        # Extract links based on search engine
                        links = []
                        if "google.com" in search_url:
                            links = soup.select('a[href^="/url?q="]')  # Google links
                        else:
                            links = soup.select('.result__a')  # DuckDuckGo links

                        for link in links:
                            href = link.get('href', '')
                            
                            # Clean up Google redirect URLs
                            if "google.com" in search_url and href.startswith('/url?q='):
                                href = href.split('/url?q=')[1].split('&')[0]
                            
                            # Skip non-lyrics sites
                            if not any(site in href.lower() for site in [
                                'lyrics', 'song', 'gaana', 'saavn', 
                                'hindi', 'bollywood', 'hindilyrics',
                                'lyricsmint', 'lyricsbogie', 'lyricsted'
                            ]):
                                continue

                            try:
                                logger.info(f"Attempting to fetch lyrics from: {href}")
                                page_response = await client.get(
                                    href,
                                    headers=get_random_headers(),
                                    follow_redirects=True,
                                    timeout=10.0
                                )

                                if page_response.status_code == 200:
                                    lyrics_soup = BeautifulSoup(page_response.text, 'lxml')
                                    
                                    # Comprehensive list of lyrics selectors
                                    selectors = [
                                        # Common lyrics containers
                                        '.lyrics-content', '.entry-content',
                                        '.lyric-content', '.song-lyrics',
                                        '#lyrics', '[class*="lyrics"]',
                                        '.main-content', '.song-content',
                                        
                                        # Indian lyrics specific selectors
                                        '.hindi-lyrics', '.english-lyrics',
                                        '.lyrics-translation', '.lyrics_text',
                                        '#lyric_text', '#songLyricsDiv',
                                        '.bollywood-lyrics', '.indian-lyrics',
                                        
                                        # Generic content selectors
                                        'article', '.post-content',
                                        '.content-area', '.main-content'
                                    ]

                                    for selector in selectors:
                                        lyrics_div = lyrics_soup.select_one(selector)
                                        if lyrics_div:
                                            # Remove unwanted elements
                                            for unwanted in lyrics_div.select(
                                                'script, style, .ad, .ads, .share-buttons, ' +
                                                '.video, .comment, .breadcrumb, .navigation, ' +
                                                '.social, .related, .sidebar'
                                            ):
                                                unwanted.decompose()
                                            
                                            # Get text with better formatting
                                            lyrics_text = ''
                                            for elem in lyrics_div.children:
                                                if isinstance(elem, str):
                                                    lyrics_text += elem + '\n'
                                                elif elem.name == 'br':
                                                    lyrics_text += '\n'
                                                elif elem.name in ['p', 'div']:
                                                    lyrics_text += elem.get_text('\n') + '\n\n'
                                                else:
                                                    lyrics_text += elem.get_text() + '\n'
                                            
                                            # Clean up the text
                                            lines = [line.strip() for line in lyrics_text.split('\n')]
                                            lines = [line for line in lines if line and len(line) > 1]
                                            
                                            # Validate content
                                            if len(lines) > 5 and any(len(line) > 20 for line in lines):
                                                logger.info(f"Found valid lyrics at: {href}")
                                                return href, '\n'.join(lines)

                                await asyncio.sleep(1)  # Rate limiting
                            except Exception as e:
                                logger.error(f"Error processing URL {href}: {str(e)}")
                                continue

                    await asyncio.sleep(1)  # Rate limiting between search engines
            except Exception as e:
                logger.error(f"Error in search query {query}: {str(e)}")
                continue

            await asyncio.sleep(1)  # Rate limiting between queries

    except Exception as e:
        logger.error(f"Error in general lyrics search: {str(e)}")
    
    return None


async def analyze_lyrics_with_gpt(lyrics: str) -> dict:
    """Use GPT to analyze lyrics content and structure"""
    try:
        prompt = f"""Analyze these song lyrics and provide information in this format:
Lyrics:
{lyrics[:1000]}  # Send first 1000 chars for analysis

Analyze and return a JSON with:
1. Main language
2. If multiple versions exist (e.g. Hindi + English)
3. Identify sections (verse, chorus, etc.)
4. Remove any non-lyrics content (ads, metadata, etc.)

Return ONLY valid JSON."""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": "You are a lyrics analysis assistant. Analyze lyrics structure and content."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                analysis = response.json()['choices'][0]['message']['content']
                return json.loads(analysis)
        
    except Exception as e:
        logger.error(f"Error in GPT lyrics analysis: {str(e)}")
    
        return None


async def clean_lyrics_with_gpt(lyrics: str, preferred_language: str = "en") -> str:
    """Use GPT to clean and format lyrics intelligently"""
    try:
        # First clean and remove duplicates using LyricsCleaner
        lyrics_cleaner = LyricsCleaner()
        cleaned_lyrics = lyrics_cleaner.clean(lyrics)
        
        analysis = await analyze_lyrics_with_gpt(cleaned_lyrics)
        if not analysis:
            return cleaned_lyrics  # Return cleaned version even if GPT fails

        prompt = f"""Clean and format these lyrics based on the analysis:
Lyrics: {cleaned_lyrics[:2000]}  # Send first 2000 chars for cleaning

Rules:
1. Keep the {preferred_language} version if multiple exist
2. Remove all non-lyrics content (ads, metadata)
3. Maintain proper verse/chorus structure
4. Keep section headers in square brackets
5. Do not repeat sections or parts
6. Preserve original formatting and language
7. Keep empty lines between sections
8. Remove any duplicate verses or choruses

Return ONLY the cleaned lyrics, no extra text."""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": "You are a lyrics cleaning assistant. Format and clean lyrics accurately while preserving structure and removing duplicates."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 10000
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                gpt_cleaned = response.json()['choices'][0]['message']['content'].strip()
                # Run through lyrics cleaner one more time to ensure proper formatting
                final_cleaned = lyrics_cleaner.clean(gpt_cleaned)
                return final_cleaned
            
    except Exception as e:
        logger.error(f"Error in GPT lyrics cleaning: {str(e)}")
        return cleaned_lyrics  # Return the basic cleaned version if GPT fails
    
    return cleaned_lyrics  # Return the basic cleaned version if GPT fails


async def clean_title_with_gpt(title: str) -> str:
    """Use GPT to intelligently clean and extract song information from title"""
    try:
        prompt = f"""Analyze this YouTube video title and extract the actual song title and artist:
Title: {title}
Rules:
1. Remove common YouTube title extras (Official Video, Lyric Video, etc.)
2. Identify the main artist and song name
3. Format as 'Artist - Song Title'
4. Keep language-specific characters intact
5. Preserve featuring artists if important

Return ONLY the cleaned title, nothing else."""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [
                        {"role": "system", "content": "You are a music title cleaning assistant. Extract and format song titles accurately."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1000
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                cleaned = response.json()['choices'][0]['message']['content'].strip()
                logger.info(f"GPT cleaned title: {cleaned}")
                return cleaned
            
    except Exception as e:
        logger.error(f"Error in GPT title cleaning: {str(e)}")
    
    # Fallback to regex cleaning if GPT fails
    return clean_title(title)


async def safe_search_with_logging(title: str, source: str, search_func: Callable, *args) -> Optional[Dict[str, Any]]:
    """Execute search function with error handling and logging"""
    try:
        logger.info(f"Starting {source} search for: {title}")
        result = await search_func(*args)
        if result:
            logger.info(f"Successfully found lyrics through {source}")
            return {
                'success': True,
                'data': result,
                'source': source
            }
        logger.info(f"No lyrics found through {source}")
        return None
    except Exception as e:
        logger.error(f"{source} search failed: {str(e)}")
        raise LyricsError(source, "search", str(e))


async def genius_search(title: str) -> Optional[str]:
    """Primary search using Genius API - returns raw lyrics without cleaning"""
    lyrics = await genius_api.search_lyrics(title)
    if lyrics:
        return lyrics  # Return raw lyrics without cleaning for Genius
    return None


async def jiosaavn_search(title: str) -> Optional[str]:
    """Secondary search using JioSaavn API"""
    try:
        # Step 1: Search for the song
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First try direct search
            search_url = f"https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query={quote_plus(title)}"
            headers = {
                **get_random_headers(),
                'Accept': 'application/json',
                'Host': 'www.jiosaavn.com',
                'Origin': 'https://www.jiosaavn.com',
                'Referer': 'https://www.jiosaavn.com/'
            }
            
            response = await client.get(search_url, headers=headers)
            response.raise_for_status()
            
            search_data = response.json()
            if not search_data or 'songs' not in search_data:
                # Try alternative search endpoint
                search_url = f"https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&q={quote_plus(title)}&n=10"
                response = await client.get(search_url, headers=headers)
                response.raise_for_status()
                search_data = response.json()

            songs = search_data.get('songs', {}).get('data', []) or search_data.get('results', [])
            if not songs:
                return None

            # Step 2: Get first matching song's details
            for song in songs:
                song_id = song.get('id')
                if not song_id:
                    continue

                # Get song details
                details_url = f"https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids={song_id}"
                details_response = await client.get(details_url, headers=headers)
                details_response.raise_for_status()
                
                song_details = details_response.json()
                if not song_details or song_id not in song_details:
                    continue

                # Step 3: Get lyrics if available
                lyrics_id = song_details[song_id].get('lyrics_snippet_id') or song_details[song_id].get('lyrics_id')
                if not lyrics_id:
                    continue

                lyrics_url = f"https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&ctx=web6dot0&_format=json&_marker=0&lyrics_id={lyrics_id}"
                lyrics_response = await client.get(lyrics_url, headers=headers)
                lyrics_response.raise_for_status()
                
                lyrics_data = lyrics_response.json()
                if lyrics_data and 'lyrics' in lyrics_data:
                    return lyrics_data['lyrics']

        return None
    except Exception as e:
        logger.error(f"Error in JioSaavn search: {str(e)}")
        return None


async def web_search(title: str) -> Optional[str]:
    """Last resort web search for lyrics"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            lyrics = await lyrics_scraper.scrape_lyrics(title, client)
            if lyrics:
                return lyrics
        return None
    except Exception as e:
        logger.error(f"Error in web search: {str(e)}")
        return None


@app.get("/api/search")
@app.post("/api/search")
async def search_song(
    title_query: Optional[str] = Query(None, alias="title"),
    search_body: Optional[SearchRequest] = None,
    preferred_language: str = Query("en", description="Preferred lyrics language (en, hi, etc.)")
) -> SongResponse:
    """Main endpoint for lyrics search following the three-step flow"""
    try:
        # Get title from either query param or body
        title = title_query or (search_body.title if search_body else None)
        if not title:
            raise HTTPException(status_code=400, detail="Title is required")

        # Clean title using GPT
        cleaned_title = await clean_title_with_gpt(title)
        logger.info(f"Processed title: {title} -> {cleaned_title}")

        # 1. Primary: Genius Search (return raw)
        genius_result = await safe_search_with_logging(cleaned_title, "Genius", genius_search, cleaned_title)
        if genius_result and genius_result['data']:
            # Get song info from Genius
            song_info = await genius_api.get_song_info(cleaned_title)
            return SongResponse(
                song=song_info['song'],
                artist=song_info['artist'],
                type="lyrical",
                lyrics=genius_result['data'],
                source="Genius"
            )

        # 2. Secondary: JioSaavn Search (with GPT cleaning)
        jiosaavn_result = await safe_search_with_logging(cleaned_title, "JioSaavn", jiosaavn_search, cleaned_title)
        if jiosaavn_result and jiosaavn_result['data']:
            cleaned_lyrics = await clean_lyrics_with_gpt(jiosaavn_result['data'], preferred_language)
            return SongResponse(
                song=cleaned_title,
                artist=jiosaavn_result.get('artist', 'Unknown'),
                type="lyrical",
                lyrics=cleaned_lyrics,
                source="JioSaavn"
            )

        # 3. Last Resort: Web Search (with GPT cleaning)
        web_result = await safe_search_with_logging(cleaned_title, "Web", web_search, cleaned_title)
        if web_result and web_result['data']:
            cleaned_lyrics = await clean_lyrics_with_gpt(web_result['data'], preferred_language)
            return SongResponse(
                song=cleaned_title,
                artist=web_result.get('artist', 'Unknown'),
                type="lyrical",
                lyrics=cleaned_lyrics,
                source=web_result.get('source', 'Web')
            )

        # No lyrics found
        return SongResponse(
            song=cleaned_title,
            artist="Unknown",
            type="error",
            error="No lyrics found from any source",
            source=None
        )

    except LyricsError as e:
        logger.error(f"Lyrics search error: {str(e)}")
        return SongResponse(
            song=title,
            artist="Unknown",
            type="error",
            error=f"Error searching lyrics: {str(e)}",
            source=None
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/save")
async def save_song(song_data: dict):
    """Save a song to Firebase"""
    try:
        result = await firebase_service.save_song(song_data)
        if result['success']:
            return {"success": True, "id": result['id']}
        else:
            if 'existing_id' in result:
                return JSONResponse(
                    status_code=409,  # Conflict
                    content={"success": False, "error": result['error'], "existing_id": result['existing_id']}
                )
            return JSONResponse(
                status_code=400,
                content={"success": False, "error": result['error']}
            )
    except Exception as e:
        logger.error(f"Error saving song: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
