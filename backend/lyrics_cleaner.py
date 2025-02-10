import re
from typing import List, Dict, Tuple, Optional
import unicodedata
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LyricsCleaner:
    def __init__(self):
        # Metadata patterns to remove
        self.metadata_patterns = [
            r'PDF Download.*$',
            r'Print PDF.*$',
            r'Download PDF.*$',
            r'Lyrics PDF.*$',
            r'Share.*$',
            r'Embed.*$',
            r'Contributors.*$',
            r'\d+\s*Embed\s*$',
            r'.*?Release Date.*$',
            r'.*?Album:.*$',
            r'.*?Artist:.*$',
            r'.*?Copyright.*$',
            r'.*?All Rights Reserved.*$',
            r'.*?Lyrics submitted by.*$'
        ]
        
        # Language-specific patterns
        self.language_markers = {
            'hindi': ['हिंदी', 'देवनागरी', 'बोल'],
            'english': ['Translation', 'English', 'Lyrics'],
            'romanized': ['Romanized', 'Roman', 'Transliteration']
        }

    def clean(self, lyrics: str) -> str:
        """Clean lyrics while preserving structure and handling multiple languages"""
        if not lyrics:
            return ""

        try:
            # First, remove everything after 1Embed if present
            if '1Embed' in lyrics:
                lyrics = lyrics.split('1Embed')[0]

            # Remove common metadata markers
            metadata_patterns = [
                r'\d+\s*Contributors?',
                r'\d*\s*Embed',
                r'You might also like',
                r'[0-9]+ views',
                r'Share.*$',
                r'Print.*$',
                r'Download.*$',
                r'Lyrics\s*$',
                r'Contributors.*$',
                r'.*?Release Date.*$',
                r'.*?Album:.*$',
                r'.*?Artist:.*$',
                r'.*?Copyright.*$',
                r'.*?All Rights Reserved.*$',
                r'.*?Lyrics submitted by.*$'
            ]
            
            for pattern in metadata_patterns:
                lyrics = re.sub(pattern, '', lyrics, flags=re.IGNORECASE)

            # Split into sections and clean
            sections = []
            current_section = []
            seen_content = set()
            
            for line in lyrics.split('\n'):
                line = line.strip()
                
                # Skip empty lines and metadata
                if not line or self._is_metadata_line(line):
                    if current_section:
                        sections.append('\n'.join(current_section))
                        current_section = []
                    continue
                
                # Check for section headers
                if re.match(r'\[(.*?)\]', line):
                    if current_section:
                        sections.append('\n'.join(current_section))
                        current_section = []
                    current_section.append(line)
                    continue
                
                # Use line hash for duplicate detection
                line_hash = hash(line.lower())
                if line_hash not in seen_content:
                    seen_content.add(line_hash)
                    current_section.append(line)
            
            # Add the last section
            if current_section:
                sections.append('\n'.join(current_section))
            
            # Remove duplicate sections
            unique_sections = []
            seen_sections = set()
            
            for section in sections:
                # Normalize section for comparison
                normalized = self._normalize_section(section)
                if normalized and normalized not in seen_sections:
                    seen_sections.add(normalized)
                    unique_sections.append(section)
            
            # Join sections with proper spacing
            cleaned = '\n\n'.join(unique_sections)
            
            # Final cleanup
            cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)  # Replace 3+ newlines with 2
            cleaned = re.sub(r'[ \t]+$', '', cleaned, flags=re.MULTILINE)  # Remove trailing whitespace
            
            return cleaned.strip()
            
        except Exception as e:
            logger.error(f"Error in lyrics cleaning: {str(e)}")
            return lyrics.strip()

    def _detect_language_sections(self, lyrics: str) -> List[Tuple[str, str]]:
        """Detect and separate different language sections in lyrics"""
        sections = []
        current_section = []
        current_lang = 'unknown'
        
        lines = lyrics.split('\n')
        for line in lines:
            # Check for language markers
            detected_lang = None
            for lang, markers in self.language_markers.items():
                if any(marker.lower() in line.lower() for marker in markers):
                    if current_section:
                        sections.append(('\n'.join(current_section), current_lang))
                        current_section = []
                    detected_lang = lang
                    break
            
            if detected_lang:
                current_lang = detected_lang
            current_section.append(line)
        
        # Add the last section
        if current_section:
            sections.append(('\n'.join(current_section), current_lang))
        
        return sections

    def _clean_section(self, section: str, lang: str) -> str:
        """Clean a single language section while preserving its structure"""
        try:
            # Remove metadata
            for pattern in self.metadata_patterns:
                section = re.sub(pattern, '', section, flags=re.IGNORECASE | re.MULTILINE)
            
            # Split into lines and clean
            lines = section.split('\n')
            cleaned_lines = []
            
            for line in lines:
                line = line.strip()
                
                # Skip empty or metadata-only lines
                if not line or self._is_metadata_line(line):
                    continue
                
                # Preserve section headers
                if re.match(r'\[(.*?)\]', line):
                    cleaned_lines.append(line)
                    continue
                
                # Clean line based on language
                if lang == 'hindi':
                    # Preserve Hindi characters and formatting
                    line = re.sub(r'[^\u0900-\u097F\s\[\]\(\)।॥]', '', line)
                elif lang == 'english':
                    # Clean English text while preserving punctuation
                    line = re.sub(r'[^\w\s\[\]\(\),.!?\'"-]', '', line)
                elif lang == 'romanized':
                    # Preserve diacritics and special characters
                    line = unicodedata.normalize('NFKC', line)
                
                if line:
                    cleaned_lines.append(line)
            
            # Join lines while preserving structure
            return self._join_lines_with_structure(cleaned_lines)
            
        except Exception as e:
            logger.error(f"Error cleaning section: {str(e)}")
            return section.strip()

    def _is_metadata_line(self, line: str) -> bool:
        """Check if a line contains only metadata"""
        metadata_indicators = [
            'download', 'print', 'share', 'embed', 'copyright',
            'all rights reserved', 'lyrics provided by', 'submitted by'
        ]
        return any(indicator in line.lower() for indicator in metadata_indicators)

    def _join_lines_with_structure(self, lines: List[str]) -> str:
        """Join lines while preserving verse structure"""
        result = []
        current_verse = []
        
        for line in lines:
            # Check if line is a section header
            if re.match(r'\[(.*?)\]', line):
                # Add previous verse if exists
                if current_verse:
                    result.append('\n'.join(current_verse))
                    current_verse = []
                result.append(line)
            else:
                current_verse.append(line)
        
        # Add the last verse
        if current_verse:
            result.append('\n'.join(current_verse))
        
        return '\n\n'.join(result)

    def _remove_duplicate_sections(self, lyrics: str) -> str:
        """Remove duplicate sections while preserving structure"""
        try:
            # Split into parts if multi-part song
            parts = re.split(r'(\[Part [IV]+:.*?\]|\[Part \d+:.*?\])', lyrics)
            
            # Process each part
            processed_parts = []
            current_part = ""
            
            for i, part in enumerate(parts):
                if re.match(r'\[Part [IV]+:.*?\]|\[Part \d+:.*?\]', part):
                    # This is a part header
                    if current_part:
                        processed = self._process_single_part(current_part)
                        if processed and not any(self._is_duplicate_content(processed, existing) for existing in processed_parts):
                            processed_parts.append(processed)
                    current_part = part
                else:
                    current_part += part
            
            # Process the last part
            if current_part:
                processed = self._process_single_part(current_part)
                if processed and not any(self._is_duplicate_content(processed, existing) for existing in processed_parts):
                    processed_parts.append(processed)
            
            # Join parts with double newline
            return '\n\n'.join(filter(None, processed_parts)).strip()
            
        except Exception as e:
            logger.error(f"Error removing duplicate sections: {str(e)}")
            return lyrics

    def _is_duplicate_content(self, section1: str, section2: str) -> bool:
        """Check if two sections have substantially similar content"""
        # Clean and normalize sections for comparison
        def normalize(text):
            # Remove section headers, punctuation, and convert to lowercase
            text = re.sub(r'\[[^\]]+\]', '', text)
            text = re.sub(r'[^\w\s]', '', text.lower())
            return ' '.join(text.split())
        
        s1 = normalize(section1)
        s2 = normalize(section2)
        
        # Calculate similarity ratio
        if not s1 or not s2:
            return False
            
        # Convert to sets of words for comparison
        words1 = set(s1.split())
        words2 = set(s2.split())
        
        # Calculate Jaccard similarity
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        # If one section is completely contained within the other
        if intersection == len(words1) or intersection == len(words2):
            return True
            
        # Return true if sections are more than 80% similar
        return intersection / union > 0.8 if union > 0 else False

    def _process_single_part(self, part: str) -> str:
        """Process a single part of the lyrics to remove duplicates"""
        try:
            # Split into sections while preserving headers
            sections = re.split(r'(\[[^\]]+\])', part)
            
            # Process sections
            processed_sections = []
            current_section = ""
            seen_sections = set()
            
            for section in sections:
                if re.match(r'\[[^\]]+\]', section):
                    # This is a section header
                    if current_section:
                        normalized = self._normalize_section(current_section)
                        if normalized and normalized not in seen_sections:
                            seen_sections.add(normalized)
                            processed_sections.append(current_section)
                    current_section = section
                else:
                    current_section += section
            
            # Process the last section
            if current_section:
                normalized = self._normalize_section(current_section)
                if normalized and normalized not in seen_sections:
                    processed_sections.append(current_section)
            
            return '\n'.join(filter(None, processed_sections)).strip()
            
        except Exception as e:
            logger.error(f"Error processing part: {str(e)}")
            return part

    def _normalize_section(self, section: str) -> str:
        """Normalize a section for comparison"""
        # Remove section headers
        section = re.sub(r'\[[^\]]+\]', '', section)
        # Remove punctuation and convert to lowercase
        section = re.sub(r'[^\w\s]', '', section.lower())
        # Normalize whitespace
        section = ' '.join(section.split())
        return section

    def _split_into_sections(self, lyrics: str) -> List[str]:
        """Split lyrics into logical sections based on blank lines"""
        # Split by multiple newlines
        sections = re.split(r'\n\s*\n+', lyrics)
        return [section.strip() for section in sections if section.strip()]

    def _remove_metadata_sections(self, sections: List[str]) -> List[str]:
        """Remove sections that match metadata patterns"""
        cleaned_sections = []
        
        for section in sections:
            # Skip if section matches any metadata pattern
            if any(re.search(pattern, section, re.IGNORECASE | re.MULTILINE) 
                  for pattern in self.metadata_patterns):
                continue
                
            # Skip sections that are too short or look like metadata
            if len(section.split()) < 3 or section.count('\n') == 0:
                if any(marker in section.lower() for marker in ['download', 'print', 'share', 'embed']):
                    continue
            
            cleaned_sections.append(section)
            
        return cleaned_sections

    def _remove_duplicates(self, lines: List[str]) -> List[str]:
        """Remove duplicate verses while preserving structure"""
        if not lines:
            return []

        def normalize_line(line: str) -> str:
            """Normalize a line for comparison"""
            # Remove punctuation, convert to lowercase, and remove common filler words
            normalized = re.sub(r'[^\w\s]', '', line.lower())
            filler_words = ['oh', 'ah', 'yeah', 'mm', 'hey', 'uh', 'come on', 'baby']
            for word in filler_words:
                normalized = re.sub(rf'\b{word}\b', '', normalized)
            return ' '.join(normalized.split())  # Normalize whitespace

        def similarity_ratio(str1: str, str2: str) -> float:
            """Calculate similarity ratio between two strings"""
            if not str1 or not str2:
                return 0.0
            
            # Convert to sets of words for comparison
            set1 = set(normalize_line(str1).split())
            set2 = set(normalize_line(str2).split())
            
            if not set1 or not set2:
                return 0.0
            
            # Calculate Jaccard similarity
            intersection = len(set1.intersection(set2))
            union = len(set1.union(set2))
            return intersection / union if union > 0 else 0.0

        def is_duplicate_verse(verse1: List[str], verse2: List[str]) -> bool:
            """Check if two verses are duplicates"""
            # If verses have very different lengths, they're not duplicates
            if abs(len(verse1) - len(verse2)) > 1:
                return False
            
            # For single-line verses, be more strict
            if len(verse1) == 1 and len(verse2) == 1:
                return similarity_ratio(verse1[0], verse2[0]) > 0.9
            
            # For multi-line verses, compare each line
            similarities = []
            for i in range(min(len(verse1), len(verse2))):
                sim = similarity_ratio(verse1[i], verse2[i])
                similarities.append(sim)
            
            # Calculate average similarity
            avg_similarity = sum(similarities) / len(similarities) if similarities else 0
            return avg_similarity >= 0.8  # 80% similarity threshold

        # Split into verses (groups of non-empty lines)
        verses = []
        current_verse = []
        
        for line in lines:
            line = line.strip()
            if line:
                # Skip lines that are just repeated short phrases
                words = line.split()
                if len(words) <= 2 and len(set(words)) == 1:
                    continue
                current_verse.append(line)
            elif current_verse:
                # Only add verses that have meaningful content
                if len(current_verse) > 0 and not all(len(l.split()) <= 2 for l in current_verse):
                    verses.append(current_verse)
                current_verse = []
        
        if current_verse:
            verses.append(current_verse)

        # Remove duplicate verses while preserving order
        unique_verses = []
        for verse in verses:
            # Skip very short verses that are likely noise
            if len(verse) == 1 and len(verse[0].split()) <= 2:
                continue
                
            # Only add verse if it's not a duplicate of any existing verse
            if not any(is_duplicate_verse(verse, existing_verse) for existing_verse in unique_verses):
                unique_verses.append(verse)

        # Flatten verses back into lines
        result = []
        for verse in unique_verses:
            result.extend(verse)
            result.append('')  # Add blank line between verses
        
        # Remove trailing empty line if present
        if result and not result[-1]:
            result.pop()

        return result 