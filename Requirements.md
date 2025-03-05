Beatscript: We are making a chrome extension that allows you to search lyrics for any video playing on YouTube (if it is a song).

How it works: 
1. Click on the extension icon
2. If it is a youtube watch page, fetch the YouTube Title & Channel Name using DOM Selectors
3. Concatenate and send to the backend
4. Backend will get the accurate lyrics of the song
5. We show the lyrics in a drawer on the front end that opens from the right side. 
6. When the next video plays, it automatically sends the request to the backend with accurate payload
7. When the next page that comes is not a youtube watch page, we show default text in drawer
8. When the youtube video is not a song, backend tells us that and then we show filler text in drawer


Backend: 
1. Backend will work as per the @HLD.png file. 
2. Speed and efficiency is of utmost importance.
3. We will use accurate Race conditions and parallel processing to handle the requests. 
4. Codebase is modularly structured and is compartmentalized. 

makeSearchString() generates optimized queries for each source
Each query flows to its appropriate URL generator (getURLGeniusAPI(), getURLDuckDuckGoAPI(), etc.)
validateLyrics() validates the search/URL results for each source independently
If validation passes, the appropriate scraper is triggered (geniusScrapper(), azLyricsScrapper(), etc.)
Successfully scraped lyrics pass through cleanLyrics() for standardization
The first complete path to finish provides the output via race condition

/
├── extension/                  # Frontend (Chrome Extension)
│   ├── manifest.json
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   └── content.js
│   ├── popup/
│   │   ├── popup.html
│   │   └── popup.js
│   ├── styles/
│   │   └── drawer.css
│   └── utils/
│       └── domUtils.js
│
├── server/                     # Backend
│   ├── index.js
│   ├── routes/
│   │   └── lyrics.js
│   ├── services/
│   │   ├── searchService.js
│   │   ├── validationService.js
│   │   └── cleaningService.js
│   ├── scrapers/
│   │   ├── geniusScraper.js
│   │   ├── azLyricsScraper.js
│   │   ├── jioSaavanScraper.js
│   │   └── lyricsBullScraper.js
│   ├── apis/
│   │   ├── geniusAPI.js
│   │   ├── duckDuckGoAPI.js
│   │   └── jioSaavanAPI.js
│   ├── utils/
│   │   ├── raceUtils.js
│   │   └── parallel.js
│   └── db/
│       └── firebase.js
│
├── package.json
└── README.md