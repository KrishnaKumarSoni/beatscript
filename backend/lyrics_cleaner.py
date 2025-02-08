import re
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LyricsCleaner:
    def __init__(self):
        # Only patterns for obvious non-lyrics content
        self.non_lyrics_patterns = [
            r'You might also like.*$',
            r'See upcoming.*$',
            r'Get tickets.*$',
            r'PDF Download.*$',
            r'Print PDF.*$',
            r'Download PDF.*$',
            r'Share.*$',
            r'Embed.*$',
            r'More from.*$',
            r'\d+ Contributors.*$',
            r'Next up.*$',
            r'Popular Songs.*$',
            r'Similar Artists.*$',
            r'Read More.*$',
            r'Featured on.*$',
            r'Lyrics to.*$'
        ]

    def clean(self, lyrics: str) -> str:
        """Only remove obvious non-lyrics content"""
        if not lyrics:
            return ""
            
        # Split into lines
        lines = lyrics.split('\n')
        
        # Remove obvious non-lyrics lines
        cleaned_lines = []
        for line in lines:
            # Skip if line matches any non-lyrics pattern
            if any(re.search(pattern, line, re.IGNORECASE) for pattern in self.non_lyrics_patterns):
                continue
            cleaned_lines.append(line)
        
        # Join back with original line breaks
        return '\n'.join(cleaned_lines).strip() 