from typing import Dict, Any, Optional
import re
import logging
from langdetect import detect_langs
from .base_processor import BaseProcessor

class GeniusProcessor(BaseProcessor):
    def __init__(self):
        super().__init__()
        self.logger = logging.getLogger(__name__)
        
    async def extract_content(self, raw_content: str) -> Optional[str]:
        """Extract lyrics content from raw HTML."""
        try:
            # Remove HTML tags while preserving newlines
            content = re.sub(r'<br\s*/?>', '\n', raw_content)
            content = re.sub(r'<[^>]+>', '', content)
            # Normalize line endings
            content = content.replace('\r\n', '\n')
            return content.strip()
        except Exception as e:
            self.logger.error(f"Error extracting content: {str(e)}")
            return None
            
    async def preserve_structure(self, content: str) -> Optional[str]:
        """Preserve the structure of lyrics."""
        try:
            # Preserve section markers like [Verse], [Chorus], etc.
            content = re.sub(r'\[(.*?)\]', r'\n[\1]\n', content)
            # Remove extra blank lines
            content = re.sub(r'\n{3,}', '\n\n', content)
            return content.strip()
        except Exception as e:
            self.logger.error(f"Error preserving structure: {str(e)}")
            return None
            
    async def clean_content(self, content: str) -> Optional[str]:
        """Clean the content while maintaining important formatting."""
        try:
            # Remove annotations and embedded links
            content = re.sub(r'\{\{.*?\}\}', '', content)
            # Remove extra whitespace
            content = re.sub(r'\s+', ' ', content)
            # Restore newlines
            content = content.replace(' [', '\n[')
            return content.strip()
        except Exception as e:
            self.logger.error(f"Error cleaning content: {str(e)}")
            return None
            
    async def extract_metadata(self, content: str) -> Dict[str, Any]:
        """Extract metadata from the lyrics content."""
        try:
            metadata = {
                'source': 'genius',
                'languages': await self._detect_languages(content),
                'has_sections': bool(re.search(r'\[.*?\]', content)),
                'length': len(content)
            }
            return metadata
        except Exception as e:
            self.logger.error(f"Error extracting metadata: {str(e)}")
            return {}
            
    async def _detect_languages(self, text: str) -> list:
        """Detect languages in the text using langdetect."""
        try:
            # Remove section markers for language detection
            clean_text = re.sub(r'\[.*?\]', '', text)
            langs = detect_langs(clean_text)
            return [{'lang': lang.lang, 'confidence': lang.prob} for lang in langs]
        except Exception as e:
            self.logger.warning(f"Language detection failed: {str(e)}")
            return [{'lang': 'unknown', 'confidence': 0.0}] 