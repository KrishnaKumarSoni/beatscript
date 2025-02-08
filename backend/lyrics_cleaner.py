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
            r'.*?Artist:.*$'
        ]

    def clean(self, lyrics: str) -> str:
        """Clean lyrics by removing metadata and formatting"""
        if not lyrics:
            return ""

        # First remove duplicate sections
        lyrics = self._remove_duplicate_sections(lyrics)
        
        # Split into sections
        sections = self._split_into_sections(lyrics)
        
        # Remove metadata sections
        cleaned_sections = self._remove_metadata_sections(sections)
        
        # Join sections with double newline
        return '\n\n'.join(cleaned_sections).strip()

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