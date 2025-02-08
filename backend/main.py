from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import re
from typing import List, Optional, Tuple
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

# Initialize logger
logger = logging.getLogger(__name__)

app = FastAPI()

# Initialize scrapers
lyrics_scraper = LyricsScraper()
genius_api = GeniusAPI()

# CORS middleware
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


class SearchRequest(BaseModel):
    title: str


class SongResponse(BaseModel):
    song: str
    artist: str
    type: str = "lyrical"  # can be "lyrical", "instrumental", or "error"
    lyrics: Optional[str] = None
    error: Optional[str] = None


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
        # Construct search queries
        search_queries = [
            f"{title} lyrics",
            f"{title} song lyrics",
            f"{title} full lyrics",
        ]

        for query in search_queries:
            encoded_query = quote_plus(query)
            search_url = f"https://html.duckduckgo.com/html?q={encoded_query}"

            response = await client.get(
                search_url,
                headers=get_random_headers(),
                follow_redirects=True,
                timeout=10.0,
            )

            if response.status_code == 200:
                # Look for links that might contain lyrics
                lyrics_patterns = [
                    r'href="([^"]+lyrics[^"]*)"',
                    r'href="([^"]+song[^"]*)"',
                    r'href="([^"]*/track/[^"]*)"',
                ]

                for pattern in lyrics_patterns:
                    urls = re.findall(pattern, response.text, re.IGNORECASE)
                    for url in urls:
                        # Skip known sites that we've already tried
                        if any(site[0] in url for site in LYRICS_SITES):
                            continue
                        
                        # Clean and validate URL
                        url = unquote(url).split("&amp;")[0].split("?")[0]
                        if not url.startswith("http"):
                            continue
                        
                        try:
                            # Try to fetch the page
                            page_response = await client.get(
                                url,
                                headers=get_random_headers(),
                                follow_redirects=True,
                                timeout=10.0,
                            )

                            if page_response.status_code == 200:
                                # Check if page likely contains lyrics
                                text = page_response.text.lower()
                                if "lyrics" in text and len(text) > 500:
                                    # Use BeautifulSoup to extract main content
                                    soup = BeautifulSoup(page_response.text, 'lxml')
                                    
                                    # Remove common non-lyrics elements
                                    for elem in soup.select('script, style, header, footer, nav, iframe, .ad, .ads, .advertisement'):
                                        elem.decompose()

                                    # Try to find the lyrics container
                                    lyrics_container = None
                                    
                                    # Common lyrics container patterns
                                    selectors = [
                                        '[class*="lyrics"]',
                                        '[class*="Lyrics"]',
                                        '[id*="lyrics"]',
                                        '[id*="Lyrics"]',
                                        'pre',
                                        '.song-text',
                                        '.track-text',
                                        'article',
                                        '.main-content'
                                    ]

                                    for selector in selectors:
                                        containers = soup.select(selector)
                                        for container in containers:
                                            text = container.get_text()
                                            # Check if this looks like lyrics
                                            if len(text.split('\n')) > 5 and len(text) > 200:
                                                lyrics_container = container
                                                break
                                        if lyrics_container:
                                            break
                                    
                                    if lyrics_container:
                                        lyrics_text = lyrics_container.get_text('\n')
                                        # Basic validation of lyrics content
                                        lines = [line.strip() for line in lyrics_text.split('\n')]
                                        lines = [line for line in lines if line]
                                        
                                        if len(lines) > 5:  # Minimum reasonable length for lyrics
                                            return url, lyrics_text
                        
                        except Exception as e:
                            print(f"Error processing URL {url}: {str(e)}")
                            continue
        
            await asyncio.sleep(random.uniform(1, 2))
        
    except Exception as e:
        print(f"Error in general lyrics search: {str(e)}")
    
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


@app.get("/api/search")
@app.post("/api/search")
async def search_song(
    title_query: Optional[str] = Query(None, alias="title"),
    search_body: Optional[SearchRequest] = None,
    preferred_language: str = Query("en", description="Preferred lyrics language (en, hi, etc.)")
):
    try:
        title = title_query or (search_body.title if search_body else None)

        if not title:
            raise HTTPException(
                status_code=400,
                detail="Title is required either as query parameter or in request body",
            )

        # Use GPT for smarter title cleaning
        cleaned_title = await clean_title_with_gpt(title)
        print(f"Processing title: {title} -> {cleaned_title}")

        if len(cleaned_title) < 3:
            return SongResponse(
                song=title,
                artist="Unknown",
                type="error",
                error="Title too short after cleaning",
            )

        # Check if instrumental before proceeding
        if is_likely_instrumental(title):
            return SongResponse(
                song=cleaned_title,
                artist="Unknown",
                type="instrumental",
                lyrics=None,
                error=None,
            )

        # First try Genius API
        lyrics = await genius_api.search_lyrics(cleaned_title, "")
        if lyrics:
            # Get song and artist from Genius API response
            song_info = await genius_api.get_song_info(cleaned_title)
            return SongResponse(
                song=song_info.get("song", cleaned_title),
                artist=song_info.get("artist", "Unknown"),
                type="lyrical",
                lyrics=lyrics,
            )

        # Only try other sources if Genius API didn't find lyrics
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try known lyrics sites
            for site_info in LYRICS_SITES:
                try:
                    lyrics_url = await search_lyrics_site(cleaned_title, site_info, client)
                    if lyrics_url:
                        lyrics_text = await lyrics_scraper.scrape_lyrics(lyrics_url, client)
                        if lyrics_text:
                            # Get song and artist from the lyrics site
                            song_info = await lyrics_scraper.get_song_info(lyrics_url, client)
                            # Clean lyrics using GPT
                            cleaned_lyrics = await clean_lyrics_with_gpt(lyrics_text, preferred_language)
                            if cleaned_lyrics:
                                return SongResponse(
                                    song=song_info.get("song", cleaned_title),
                                    artist=song_info.get("artist", "Unknown"),
                                    type="lyrical",
                                    lyrics=cleaned_lyrics,
                                )
                except Exception as e:
                    logger.error(f"Error with lyrics site {site_info[0]}: {str(e)}")
                    continue

            # Only try general web search if no lyrics found from known sites
            logger.info("Trying general web search for lyrics...")
            try:
                result = await search_general_lyrics(cleaned_title, client)
                if result:
                    url, lyrics_text = result
                    # Clean the lyrics
                    cleaned_lyrics = await clean_lyrics_with_gpt(lyrics_text, preferred_language)
                    if cleaned_lyrics:
                        return SongResponse(
                            song=cleaned_title,
                            artist="Unknown",
                            type="lyrical",
                            lyrics=cleaned_lyrics,
                        )
            except Exception as e:
                logger.error(f"Error in general lyrics search: {str(e)}")

            # If no lyrics found from any source
            return SongResponse(
                song=cleaned_title,
                artist="Unknown",
                type="error",
                error=f"No lyrics found. Cleaned title: {cleaned_title}",
            )
            
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
