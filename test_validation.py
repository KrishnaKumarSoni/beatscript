from playwright.sync_api import sync_playwright
import requests
import json
from typing import Dict, List
import time
import logging
import asyncio
from urllib.parse import quote
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def extract_youtube_titles() -> List[str]:
    """Extract a mix of established and new song titles"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        titles = []
        
        # List of playlists to get a good mix of songs
        playlists = [
            # Popular/Established Songs
            'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI',  # Top Global All-Time
            'https://www.youtube.com/playlist?list=PLFgquLnL59akA2PflFpeQG9L01VFg90wS',  # Popular Bollywood
            
            # Recent Releases (but not too new)
            'https://www.youtube.com/playlist?list=PLFgquLnL59alW3xmYiWRaoz0oM3H17Lth',  # Recent Hits
        ]
        
        for playlist_url in playlists:
            try:
                page.goto(playlist_url)
                page.wait_for_load_state('networkidle')
                page.wait_for_selector('#video-title')
                
                # Extract titles from this playlist
                song_elements = page.query_selector_all('#video-title')
                for element in song_elements:
                    try:
                        title = element.get_attribute('title')
                        if title and ' - ' in title and len(title.strip()) > 10:
                            clean_title = title.strip()
                            # Remove common YouTube additions
                            clean_title = re.sub(r'\(Official.*?\)', '', clean_title)
                            clean_title = re.sub(r'\[Official.*?\]', '', clean_title)
                            clean_title = re.sub(r'\(Audio.*?\)', '', clean_title)
                            clean_title = re.sub(r'\(Lyric.*?\)', '', clean_title)
                            clean_title = re.sub(r'\(Music.*?\)', '', clean_title)
                            clean_title = re.sub(r'\(Video.*?\)', '', clean_title)
                            clean_title = clean_title.strip()
                            if clean_title not in titles:  # Avoid duplicates
                                titles.append(clean_title)
                        if len(titles) >= 25:  # Get 25 titles total
                            break
                    except Exception as e:
                        logger.error(f"Error extracting title: {str(e)}")
                        continue
                
                if len(titles) >= 25:
                    break
                    
            except Exception as e:
                logger.error(f"Error processing playlist {playlist_url}: {str(e)}")
                continue
        
        browser.close()
        return titles[:25]  # Return max 25 titles

def test_song(title: str) -> Dict:
    """Test a single song title against our lyrics API"""
    url = "http://localhost:8000/api/search"
    headers = {"Content-Type": "application/json"}
    payload = {"title": title}
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        result = {
            "title": title,
            "status_code": response.status_code,
            "response": response.json() if response.status_code == 200 else None,
            "success": response.status_code == 200 and response.json().get("lyrics") is not None
        }
        
        # Add more detailed information for analysis
        if result["success"]:
            result["found_title"] = result["response"]["song"]
            result["found_artist"] = result["response"]["artist"]
            result["source"] = result["response"].get("source", "unknown")
        
        return result
        
    except Exception as e:
        logger.error(f"Error testing song {title}: {str(e)}")
        return {
            "title": title,
            "status_code": None,
            "response": str(e),
            "success": False
        }

def test_duplicacy(lyrics: str) -> Dict:
    """Test if lyrics contain duplicated content"""
    if not lyrics:
        return {
            "has_duplicates": False,
            "details": "No lyrics to test"
        }
    
    # Split lyrics into sections
    sections = [s.strip() for s in lyrics.split('\n\n') if s.strip()]
    
    # Check for duplicate sections
    duplicates = []
    seen_sections = {}
    
    for i, section in enumerate(sections):
        # Normalize section for comparison
        normalized = ' '.join(section.lower().split())
        if normalized in seen_sections:
            duplicates.append({
                'section': section,
                'first_occurrence': seen_sections[normalized],
                'duplicate_at': i
            })
        else:
            seen_sections[normalized] = i
    
    # Check for duplicate lines within sections
    duplicate_lines = []
    for section in sections:
        lines = [line.strip() for line in section.split('\n') if line.strip()]
        seen_lines = {}
        for i, line in enumerate(lines):
            normalized = ' '.join(line.lower().split())
            if normalized in seen_lines:
                duplicate_lines.append({
                    'line': line,
                    'first_occurrence': seen_lines[normalized],
                    'duplicate_at': i,
                    'section': section[:50] + '...' if len(section) > 50 else section
                })
            else:
                seen_lines[normalized] = i
    
    return {
        "has_duplicates": bool(duplicates or duplicate_lines),
        "duplicate_sections": duplicates,
        "duplicate_lines": duplicate_lines,
        "total_sections": len(sections),
        "details": f"Found {len(duplicates)} duplicate sections and {len(duplicate_lines)} duplicate lines"
    }

def analyze_results(results: List[Dict]) -> None:
    """Analyze test results in detail"""
    # Overall statistics
    total = len(results)
    successful = sum(1 for r in results if r['success'])
    failed = total - successful
    
    print("\n=== Test Results Analysis ===")
    print(f"\nOverall Statistics:")
    print(f"Total tests: {total}")
    print(f"Successful: {successful} ({(successful/total)*100:.1f}%)")
    print(f"Failed: {failed} ({(failed/total)*100:.1f}%)")
    
    # Analyze failures
    if failed > 0:
        print("\nFailure Analysis:")
        for result in results:
            if not result['success']:
                print(f"\nTitle: {result['title']}")
                print(f"Status: {result['status_code']}")
                if result['response']:
                    if isinstance(result['response'], dict):
                        error = result['response'].get('error', 'Unknown error')
                        print(f"Error: {error}")
                    else:
                        print(f"Error: {result['response']}")
    
    # Analyze successful matches
    if successful > 0:
        print("\nSuccessful Matches Analysis:")
        duplicates_found = 0
        for result in results:
            if result['success']:
                print(f"\nOriginal: {result['title']}")
                print(f"Matched Title: {result['found_title']}")
                print(f"Matched Artist: {result['found_artist']}")
                print(f"Source: {result.get('source', 'unknown')}")
                
                # Add duplicacy analysis
                if 'duplicacy_test' in result:
                    dup_test = result['duplicacy_test']
                    if dup_test['has_duplicates']:
                        duplicates_found += 1
                        print("⚠️ Duplicates found:")
                        print(f"  - {dup_test['details']}")
                        if dup_test['duplicate_sections']:
                            print("  - Duplicate sections found")
                        if dup_test['duplicate_lines']:
                            print("  - Duplicate lines found")
        
        if duplicates_found > 0:
            print(f"\nDuplicates Summary:")
            print(f"Songs with duplicates: {duplicates_found} ({(duplicates_found/successful)*100:.1f}% of successful matches)")

def get_test_titles() -> List[str]:
    """Get a curated list of test titles"""
    return [
        # Indian Hip Hop (Underrated/Underground)
        "Nanchaku - Seedhe Maut",
        "Namastute - Seedhe Maut",
        "101 - Seedhe Maut",
        "Amar - DIVINE",
        "Satya - DIVINE",
        "Rider - DIVINE",
        "Kohinoor - DIVINE",
        "Jungli Sher - DIVINE",
        "Azaad Hu Mai - MC STAN",
        "Tadipaar - MC STAN",
        "Batti - MC STAN",
        "Mera Bhai - MC STAN",
        "Sab Chahiye - Karma",
        "1 Se 23 - Karma",
        "Bhagwaan Aur Khuda - Raftaar",
        
        # Global Hits (Easy to Find)
        "Shape of You - Ed Sheeran",
        "Someone Like You - Adele",
        "Rolling in the Deep - Adele",
        "Uptown Funk - Mark Ronson ft. Bruno Mars",
        "Despacito - Luis Fonsi ft. Daddy Yankee",
        "See You Again - Wiz Khalifa ft. Charlie Puth",
        "Counting Stars - OneRepublic",
        "Believer - Imagine Dragons",
        "Perfect - Ed Sheeran",
        "Stay With Me - Sam Smith"
    ]

def run_tests():
    """Run tests with predefined song titles"""
    try:
        # Get test titles
        titles = get_test_titles()
        
        logger.info(f"Testing {len(titles)} songs")
        print("\nTesting with the following songs:")
        print("\nIndian Hip Hop:")
        for title in titles[:15]:  # First 15 are Indian
            print(f"- {title}")
        print("\nGlobal Hits:")
        for title in titles[15:]:  # Rest are global
            print(f"- {title}")
        
        # Run tests
        results = []
        for title in titles:
            logger.info(f"\nTesting: {title}")
            result = test_song(title)
            
            # Add duplicacy test for successful results
            if result['success'] and result['response'].get('lyrics'):
                result['duplicacy_test'] = test_duplicacy(result['response']['lyrics'])
            
            results.append(result)
            
            # Print immediate result
            status = "✅" if result['success'] else "❌"
            print(f"{status} {title}")
            
            if not result['success']:
                print(f"   Error: {result['response']}")
            elif result.get('duplicacy_test', {}).get('has_duplicates'):
                print(f"   ⚠️ {result['duplicacy_test']['details']}")
            
            time.sleep(1)  # Rate limiting
        
        # Analyze results
        analyze_results(results)
        
    except Exception as e:
        logger.error(f"Error running tests: {str(e)}")

if __name__ == "__main__":
    run_tests() 