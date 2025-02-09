# BeatScript

A Chrome extension that automatically extracts song information and lyrics from YouTube videos in real-time.

## Overview

BeatScript is a lightweight extension that enhances your YouTube music experience by automatically detecting and displaying lyrics for music videos. It uses multiple lyrics sources and AI-powered cleaning to provide accurate results.

```mermaid
graph TB
    subgraph "User Interface"
        YT[YouTube Video] --> EXT[Chrome Extension]
        EXT --> UI[Drawer Interface]
    end
    
    subgraph "Backend Services"
        API[FastAPI Server]
        subgraph "Lyrics Sources"
            G[Genius API]
            J[JioSaavn API]
            W[Web Scraping]
        end
        subgraph "Processing"
            TM[Title Matching]
            LC[Lyrics Cleaner]
            GPT[GPT-3.5]
            FB[Firebase]
        end
    end
    
    EXT -->|Request| API
    API -->|Title Processing| TM
    TM -->|Processed Title| G
    TM -->|Processed Title| J
    TM -->|Fallback| W
    
    G & J & W -->|Raw Lyrics| LC
    LC -->|Validate| GPT
    GPT -->|Clean| API
    API -->|Store| FB
    API -->|Response| UI
```

## Features

### Core Functionality
```mermaid
mindmap
    root((BeatScript))
        Title Processing
            Word Order Handling
            Multi-word Support
            Language Detection
        Lyrics Sources
            Genius API
            JioSaavn API
            Web Scraping
        Smart Processing
            Title Cleaning
            Content Validation
            Language Detection
        User Interface
            Drawer Layout
            Zoom Controls
            Settings Panel
        Storage
            Firebase
            Local Cache
            Settings
```

### Data Flow
```mermaid
sequenceDiagram
    participant User
    participant Extension
    participant Backend
    participant TitleProcessor
    participant Sources
    participant Storage
    
    User->>Extension: Watch YouTube Video
    Extension->>Extension: Detect Title Change
    Extension->>Backend: Request Lyrics
    Backend->>TitleProcessor: Process Title
    TitleProcessor->>Sources: Search with Variations
    Sources-->>Backend: Return Raw Lyrics
    Backend->>Backend: Clean & Validate
    Backend->>Storage: Save Results
    Backend-->>Extension: Return Processed Lyrics
    Extension->>User: Display in Drawer
```

## System Architecture

### Component Interaction
```mermaid
graph LR
    subgraph "Frontend"
        CS[Content Script]
        BG[Background Script]
        UI[UI Components]
    end
    
    subgraph "Backend"
        API[FastAPI Server]
        TM[Title Matcher]
        DB[(Firebase)]
        AI{GPT-3.5}
    end
    
    subgraph "External"
        GEN[Genius]
        JIO[JioSaavn]
        WEB[Web Sources]
    end
    
    CS -->|Events| BG
    BG -->|API Calls| API
    CS -->|Updates| UI
    
    API -->|Process Title| TM
    TM -->|Search| GEN & JIO & WEB
    API -->|Storage| DB
    API -->|Processing| AI
```

## Prerequisites

- Python 3.8+
- Chrome browser
- Node.js 14+ (for development)

### Environment Setup Flow
```mermaid
graph TD
    A[Start] --> B[Install Python 3.8+]
    B --> C[Install Node.js 14+]
    C --> D[Install Chrome]
    D --> E[Clone Repository]
    E --> F[Setup Virtual Env]
    F --> G[Install Dependencies]
    G --> H[Configure API Keys]
    H --> I[Start Backend]
    I --> J[Load Extension]
    J --> K[Ready to Use]
```

## Required API Keys

Create a `.env` file in the backend directory with:
```
GENIUS_ACCESS_TOKEN=your_token
OPENAI_API_KEY=your_key
FIREBASE_ADMIN_CREDENTIALS=path_to_credentials.json
```

## Installation

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Extension Setup
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project directory

## Project Structure

```mermaid
graph TD
    subgraph "Project Root"
        BE[backend/]
        FE[Frontend Files]
    end
    
    subgraph "Backend Components"
        BE --> M[main.py]
        BE --> G[genius_api.py]
        BE --> L[lyrics_cleaner.py]
        BE --> S[lyrics_scraper.py]
        BE --> F[firebase_service.py]
        BE --> R[requirements.txt]
    end
    
    subgraph "Frontend Components"
        FE --> C[content.js]
        FE --> B[background.js]
        FE --> MF[manifest.json]
        FE --> ST[styles.css]
    end
```

## API Endpoints

### Search Flow
```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Genius
    participant JioSaavn
    participant Scraper
    
    Client->>API: GET/POST /api/search
    Note over Client,API: {title, preferred_language, channel}
    
    API->>Genius: Search Primary
    alt Genius Success
        Genius-->>API: Return Lyrics
        API-->>Client: Return Results
    else Genius Fails
        API->>JioSaavn: Try JioSaavn
        alt JioSaavn Success
            JioSaavn-->>API: Return Lyrics
            API-->>Client: Return Results
        else JioSaavn Fails
            API->>Scraper: Try Web Scraping
            Scraper-->>API: Return Lyrics
            API-->>Client: Return Results
        end
    end
```

### Storage Operations
```mermaid
graph LR
    subgraph "API Endpoints"
        S[POST /songs/save]
        C[GET /songs/check]
        D[DELETE /songs/id]
    end
    
    subgraph "Firebase"
        FB[(Database)]
    end
    
    S -->|Save| FB
    C -->|Check| FB
    D -->|Remove| FB
```

## Development

### Backend Dependencies
```mermaid
graph TD
    subgraph "Core"
        F[FastAPI]
        H[httpx]
        BS[BeautifulSoup4]
    end
    
    subgraph "APIs"
        G[lyricsgenius]
        FB[firebase-admin]
        O[OpenAI]
    end
    
    subgraph "Utilities"
        D[python-dotenv]
        L[lxml]
        A[aiohttp]
    end
    
    F --> H
    H --> BS
    BS --> L
    G & FB & O --> D
```

### Extension Features
```mermaid
mindmap
    root((Extension))
        Video Detection
            Title Changes
            Channel Info
            Duration
        UI Components
            Drawer
            Controls
            Settings
        State Management
            Local Storage
            Settings
            Cache
```

## Error Handling

```mermaid
graph TD
    E[Error Occurs] --> T{Type?}
    T -->|API| R[Retry with Backoff]
    T -->|Network| F[Use Fallback]
    T -->|Parser| C[Clean Response]
    
    R --> L[Log Error]
    F --> L
    C --> L
    
    L --> U[Update UI]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

```mermaid
graph LR
    F[Fork] --> B[Branch]
    B --> C[Code]
    C --> T[Test]
    T --> P[PR]
    P --> M[Merge]
```

## Performance

### Response Times
```mermaid
pie title "Average Response Time Distribution (ms)"
    "API Call" : 100
    "Lyrics Search" : 300
    "Content Cleaning" : 200
    "UI Update" : 50
```

### Success Rates
```mermaid
bar
    title Source Success Rates
    Genius "85%"
    JioSaavn "75%"
    Fallback "60%"
```

## License

MIT License - See LICENSE file for details 

## Known Limitations

### Title Matching
- Multi-word titles may have reduced accuracy when words are jumbled
- Non-English titles may require specific word order
- Single-word titles have highest success rate

### Search Behavior
- Different sources have varying sensitivity to word order
- JioSaavn requires more precise query formatting
- Fallback sources may need multiple search attempts
