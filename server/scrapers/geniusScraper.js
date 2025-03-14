const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes lyrics from a Genius URL
 * @param {string} url - The Genius URL to scrape lyrics from
 * @returns {Promise<string|null>} - The lyrics as a string or null if not found
 */
async function scrapeLyricsFromGenius(url) {
  if (!url) {
    console.error('No URL provided to Genius scraper');
    throw new Error("No URL provided to Genius scraper");
  }

  try {
    // Make request with a proper user agent to avoid being blocked
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000 // 10 second timeout
    });

    // Load HTML into cheerio
    const $ = cheerio.load(response.data);
    
    // Genius lyrics are typically in a div with data-lyrics-container attribute
    let lyrics = '';
    
    // Method 1: Look for the modern Genius lyrics container
    const lyricsContainers = $('[data-lyrics-container="true"]');
    if (lyricsContainers.length) {
      lyricsContainers.each((i, el) => {
        // Get the HTML content to preserve line breaks
        const html = $(el).html();
        if (html) {
          // Replace <br> tags with newlines and remove other HTML tags
          const text = html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>/g, '')
            .trim();
          
          lyrics += text + '\n\n';
        }
      });
    }
    
    // Method 2: If the modern container isn't found, try the legacy container
    if (!lyrics) {
      const legacyContainer = $('.lyrics');
      if (legacyContainer.length) {
        lyrics = legacyContainer.text().trim();
      }
    }
    
    // Method 3: Try to find any element with "lyrics" in its class or id
    if (!lyrics) {
      const possibleContainers = [
        '.song_body-lyrics',
        '.lyrics__content',
        '#lyrics-root',
        '[class*="Lyrics__Container"]',
        '[class*="LyricsPlaceholder"]'
      ];
      
      for (const selector of possibleContainers) {
        const container = $(selector);
        if (container.length) {
          const html = container.html();
          if (html) {
            lyrics = html
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]*>/g, '')
              .trim();
            
            if (lyrics) break;
          }
        }
      }
    }
    
    // Clean up the lyrics
    if (lyrics) {
      // Remove annotations and other non-lyrics content
      lyrics = lyrics
        .replace(/\[\w+\]/g, '') // Remove [Verse], [Chorus], etc.
        .replace(/\s{2,}/g, '\n') // Replace multiple spaces with newlines
        .trim();
      
      return lyrics;
    }
    
    console.error('No lyrics found on Genius page');
    throw new Error("No lyrics found on Genius page");
  } catch (error) {
    console.error(`Error scraping lyrics from Genius: ${error.message}`);
    throw new Error("Error scraping lyrics from Genius");
  }
}

module.exports = {
  scrapeLyricsFromGenius
};
