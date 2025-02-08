import asyncio
import sys
from main import clean_title
from genius_api import GeniusAPI

async def test_lyrics_search(title: str):
    print("\nTesting lyrics search for:", title)
    print("-" * 50)
    
    # Clean the title
    cleaned_title = clean_title(title)
    print(f"\nCleaned title: {cleaned_title}")
    
    # Initialize Genius API
    genius = GeniusAPI()
    
    print("\nSearching for lyrics...")
    print("-" * 50)
    
    # Try to get song info first
    print("Attempting to get song info...")
    song_info = await genius.get_song_info(cleaned_title)
    if song_info['artist'] != 'Unknown':
        print(f"Found song info:")
        print(f"Title: {song_info['song']}")
        print(f"Artist: {song_info['artist']}")
    else:
        print("Could not find song info directly")
    
    print("\nAttempting to find lyrics...")
    # Search for lyrics
    lyrics = await genius.search_lyrics(cleaned_title, "")
    if lyrics:
        print("\nLyrics found!")
        print("-" * 50)
        print(lyrics)
    else:
        print("\nNo lyrics found after trying:")
        print("1. Direct Genius API search")
        print("2. Search with 'lyrics' keyword")
        print("3. Artist-title split search")
        print("4. Lyrics database search")
        print("5. Web scraping fallback")
        
        # Try to help with suggestions
        print("\nSuggestions:")
        print("- Try with artist name if known (e.g. 'song - artist')")
        print("- Check if the song title is spelled correctly")
        print("- Try with the original language title if it's a translation")

def main():
    if len(sys.argv) > 1:
        # If title provided as command line argument
        title = " ".join(sys.argv[1:])
    else:
        # Otherwise prompt for input
        print("\nEnter song title (formats supported):")
        print("1. Just the title: 'Shape of You'")
        print("2. Artist - Title: 'Ed Sheeran - Shape of You'")
        print("3. Title by Artist: 'Shape of You by Ed Sheeran'")
        print("4. Full YouTube title (will be cleaned)")
        title = input("\nEnter song title: ")
    
    if not title:
        print("Please provide a song title!")
        return
    
    # Run the async test
    asyncio.run(test_lyrics_search(title))

if __name__ == "__main__":
    main() 