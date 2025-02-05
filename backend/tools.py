from crewai.tools import BaseTool
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote_plus

class GoogleSearchTool(BaseTool):
    name: str = "Search"
    description: str = "Search for information about songs and music. Use this to verify song names and artists."

    def _clean_query(self, query: str) -> str:
        """Clean the query for better search results"""
        print(f"Original query: {query}")
        
        # If query already starts with our prefix, use it as is
        if query.lower().startswith("what is the name of this song"):
            return query
            
        # Otherwise, add our prefix
        return f"what is the name of this song - {query}"

    def _run(self, query: str) -> str:
        """Execute the search and return results"""
        try:
            # Format query
            search_query = self._clean_query(query)
            print(f"\nSearching for: {search_query}")
            
            # Perform the search
            results = self._perform_search(search_query)
            
            # Format results
            formatted_results = "\n\n".join([
                f"Title: {result['title']}\nSnippet: {result['snippet']}"
                for result in results
            ])
            
            print(f"\nSearch results found: {len(results)}")
            return formatted_results if formatted_results else "No relevant results found."
            
        except Exception as e:
            print(f"\nSearch error: {str(e)}")
            return f"Error performing search: {str(e)}"
            
    def _perform_search(self, query: str) -> list:
        """Perform a single search and return results"""
        search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        print(f"Search URL: {search_url}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity'
        }
        
        try:
            response = requests.get(search_url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Debug response info
            print(f"\nResponse Status: {response.status_code}")
            print(f"Response Encoding: {response.encoding}")
            
            # Force encoding to UTF-8
            response.encoding = 'utf-8'
            content = response.text
            
            soup = BeautifulSoup(content, 'html.parser')
            
            # Debug the parsed HTML structure
            print(f"\nHTML Structure:")
            print(f"Title: {soup.title.string if soup.title else 'No title found'}")
            
            results = []
            
            # Look for search result containers
            for result in soup.select('.result'):
                title_elem = result.select_one('.result__title')
                snippet_elem = result.select_one('.result__snippet')
                
                if title_elem:
                    title = title_elem.get_text(strip=True)
                    snippet = snippet_elem.get_text(strip=True) if snippet_elem else ''
                    
                    # Include all results since we're specifically searching for song names
                    print(f"Found result: {title[:50]}...")
                    results.append({
                        'title': title,
                        'snippet': snippet
                    })
            
            return results[:5]  # Return top 5 results
            
        except Exception as e:
            print(f"Search error: {str(e)}")
            print(f"Error details: {str(type(e).__name__)}")
            import traceback
            traceback.print_exc()
            return [] 