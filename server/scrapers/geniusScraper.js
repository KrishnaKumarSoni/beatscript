const axios = require('axios');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');

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

  // Determine if we're running on Vercel
  const isVercel = process.env.VERCEL === '1';
  console.log(`Running on Vercel: ${isVercel}`);

  try {
    // Configure request options with enhanced headers
    const requestOptions = {
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
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.google.com/'
      },
      timeout: 15000 // 15 second timeout
    };

    // If running on Vercel, try to use a proxy
    if (isVercel) {
      console.log('Using fallback method for Vercel deployment');
      
      // Try to use a public API that can fetch the HTML for us
      try {
        console.log('Attempting to use alternative method to fetch lyrics');
        return await fetchLyricsAlternative(url);
      } catch (altError) {
        console.error('Alternative method failed:', altError.message);
        throw new Error("Error scraping lyrics from Genius");
      }
    }

    // Make the request
    console.log('Making direct request to Genius');
    const response = await axios.get(url, requestOptions);

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
    throw new Error(`Error scraping lyrics from Genius: ${error.message}`);
  }
}

/**
 * Alternative method to fetch lyrics using a public API
 * @param {string} url - The Genius URL
 * @returns {Promise<string>} - The lyrics
 */
async function fetchLyricsAlternative(url) {
  console.log('Using alternative method to fetch lyrics from:', url);
  
  // Extract the song ID from the URL
  const urlParts = url.split('/');
  const songId = urlParts[urlParts.length - 1].split('-').pop();
  
  if (!songId || isNaN(parseInt(songId))) {
    console.error('Could not extract song ID from URL');
    throw new Error('Could not extract song ID from URL');
  }
  
  try {
    // Use Genius's own API to get the lyrics
    const apiUrl = `https://api.genius.com/songs/${songId}`;
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.GENIUS_ACCESS_TOKEN || 'YOUR_GENIUS_TOKEN'}`
      }
    });
    
    if (response.data && response.data.response && response.data.response.song) {
      const song = response.data.response.song;
      
      // If the song has an embed_content field with lyrics
      if (song.embed_content && song.embed_content.includes('data-lyrics-container')) {
        const $ = cheerio.load(song.embed_content);
        let lyrics = '';
        
        $('[data-lyrics-container="true"]').each((i, el) => {
          const html = $(el).html();
          if (html) {
            const text = html
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<[^>]*>/g, '')
              .trim();
            
            lyrics += text + '\n\n';
          }
        });
        
        if (lyrics) {
          return lyrics.trim();
        }
      }
      
      // If we couldn't get lyrics from embed_content, try the description
      if (song.description && song.description.dom && song.description.dom.children) {
        // Extract lyrics from the description if possible
        // This is a fallback and may not always work
        const descriptionText = JSON.stringify(song.description.dom);
        const cleanedText = descriptionText
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\"lyrics\\"/i, '')
          .replace(/[{}\[\]"]/g, '')
          .replace(/children:|tag:|attributes:/g, '')
          .trim();
        
        if (cleanedText.length > 100) { // Arbitrary length to ensure we have meaningful content
          return cleanedText;
        }
      }
    }
    
    // If we couldn't get lyrics from the API, try a different approach
    // Use a public HTML to text service as a last resort
    console.log('Trying public HTML service as last resort');
    const htmlToTextUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const htmlResponse = await axios.get(htmlToTextUrl, { timeout: 10000 });
    
    if (htmlResponse.data) {
      const $ = cheerio.load(htmlResponse.data);
      let lyrics = '';
      
      // Try all our selectors
      const selectors = [
        '[data-lyrics-container="true"]',
        '.lyrics',
        '.song_body-lyrics',
        '.lyrics__content',
        '#lyrics-root',
        '[class*="Lyrics__Container"]'
      ];
      
      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length) {
          elements.each((i, el) => {
            const html = $(el).html();
            if (html) {
              const text = html
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>/g, '')
                .trim();
              
              lyrics += text + '\n\n';
            }
          });
          
          if (lyrics) break;
        }
      }
      
      if (lyrics) {
        return lyrics.trim();
      }
    }
    
    throw new Error('Could not extract lyrics using alternative methods');
  } catch (error) {
    console.error('Alternative lyrics fetch failed:', error.message);
    throw error;
  }
}

module.exports = {
  scrapeLyricsFromGenius
};
