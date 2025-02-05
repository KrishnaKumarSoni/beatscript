from crewai import Task

class MusicTasks:
    def search_task(self, agent, youtube_title):
        return Task(
            description=f"""Search for this exact query: "what is the name of this song - {youtube_title}"
            
            Your task is simple:
            1. Search using the exact query above
            2. Look at the search results to determine if this is a song
            3. Return the song information if found
            
            Important Notes:
            - If you see [Music] in the search result title, this indicates a strong match
            - Look for any mentions of musicians, singers, or music labels
            - For new releases, the song might be too recent for Google
            - If you see multiple musicians/artists in the title, this might indicate a song
            
            Return the information in this exact format:
            {{"found": true/false, "song": "Song Name", "artist": "Artist Name", "confidence": "high/medium/low"}}
            
            Guidelines:
            - found: true if:
              a) Search results indicate this is a song
              b) Title format and content strongly suggest this is a song
            - confidence levels:
              high: Clear music results or strong musical indicators
              medium: Some musical indicators but not definitive
              low: Limited indicators or unclear results
            
            If no search results but the title strongly indicates a song 
            (e.g., contains multiple artists, music-related terms, or follows song title patterns),
            analyze the title structure to extract likely song and artist information.""",
            agent=agent,
            expected_output="""A JSON object containing whether a song was found and its details."""
        )

    def extract_info_task(self, agent, youtube_title, search_results):
        return Task(
            description=f"""Analyze this YouTube video title: "{youtube_title}"
            along with these search results: {search_results}
            
            Compare the YouTube title with the search results to accurately extract the song name and artist.
            If the search results show a different song name than what you'd extract from the title,
            prefer the search results if they have high confidence.
            
            Return the information in this exact format:
            {{"song": "Song Name", "artist": "Artist Name"}}
            
            If you can't determine either the song name or artist name with confidence,
            use "Unknown Song" or "Unknown Artist" respectively.
            
            Make sure to:
            1. Handle featuring artists appropriately
            2. Remove any extra information like "(Official Video)", "(Lyrics)", etc.
            3. Clean up any special characters
            4. Return only the JSON response, nothing else""",
            agent=agent,
            expected_output="""A JSON object containing the final song and artist information."""
        ) 