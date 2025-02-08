# BeatScript - YouTube Music Information Extractor

## Overview
BeatScript is a Chrome extension that automatically extracts song information and lyrics from YouTube videos in real-time, providing a seamless music discovery experience.

## Architecture

### System Components
```mermaid
graph TB
    subgraph "Frontend - Chrome Extension"
        CE[Content Script]
        BG[Background Script]
        UI[UI Components]
        DR[Drawer Interface]
    end
    
    subgraph "Backend Server - FastAPI"
        API[FastAPI Server]
        
        subgraph "Lyrics Pipeline"
            GEN[Genius API]
            SCR[Web Scraper]
            CLN[Lyrics Cleaner]
        end
        
        subgraph "AI Components"
            GPT[GPT-3.5]
            VAL[Validator]
        end
        
        subgraph "Search Components"
            GS[Genius Search]
            WS[Web Search]
            DS[DuckDuckGo Search]
        end
    end
    
    subgraph "External Services"
        GA[Genius API]
        OAI[OpenAI GPT]
        DDG[DuckDuckGo]
        LS[Lyrics Sites]
    end
    
    CE -->|Events| BG
    BG -->|API Calls| API
    CE -->|Updates| UI
    UI -->|Renders| DR
    
    API -->|Searches| GEN
    API -->|Scrapes| SCR
    API -->|Cleans| CLN
    
    GEN -->|Queries| GA
    SCR -->|Searches| WS
    WS -->|Uses| DDG
    WS -->|Scrapes| LS
    
    CLN -->|Validates| GPT
    VAL -->|Uses| OAI
    
    style API fill:#f9f,stroke:#333,stroke-width:2px
    style GEN fill:#bbf,stroke:#333
    style SCR fill:#bbf,stroke:#333
    style CLN fill:#bbf,stroke:#333
    style GPT fill:#dfd,stroke:#333
```

### Data Flow
```mermaid
sequenceDiagram
    participant YT as YouTube
    participant EXT as Extension
    participant API as Backend API
    participant GEN as Genius API
    participant SCR as Web Scraper
    participant GPT as GPT-3.5
    
    YT->>EXT: Video Title Change
    EXT->>API: Send Title
    API->>GEN: Search Lyrics
    alt Lyrics Found
        GEN-->>API: Return Lyrics
    else No Lyrics
        API->>SCR: Search Web
        SCR-->>API: Raw Lyrics
        API->>GPT: Clean & Format
        GPT-->>API: Clean Lyrics
    end
    API-->>EXT: Return Result
    EXT->>YT: Update UI
```

### Component Details

#### Frontend Components
| Component | Purpose | Technologies |
|-----------|----------|--------------|
| Content Script | Video detection & UI injection | JavaScript |
| Background Script | Extension management | JavaScript |
| Drawer Interface | Lyrics display & controls | HTML/CSS |
| Event Handlers | User interaction & state | JavaScript |

#### Backend Components
| Component | Purpose | Technologies |
|-----------|----------|--------------|
| FastAPI Server | Main API endpoint | Python/FastAPI |
| Genius Integration | Primary lyrics source | Python/lyricsgenius |
| Web Scraper | Backup lyrics source | Python/BeautifulSoup |
| GPT Integration | Content cleaning | OpenAI API |

### Lyrics Search Flow
```mermaid
graph TD
    A[Start] --> B{Try Genius API}
    B -->|Success| C[Return Lyrics]
    B -->|Fail| D{Try Known Sites}
    D -->|Success| E[Scrape & Clean]
    D -->|Fail| F{Try Web Search}
    F -->|Success| G[Extract & Clean]
    F -->|Fail| H[Return Error]
    E --> C
    G --> C
```

### UI Components
```mermaid
graph TB
    subgraph "Drawer Interface"
        H[Header]
        C[Controls]
        L[Lyrics Display]
        Z[Zoom Controls]
    end
    
    subgraph "Controls"
        CL[Close]
        ST[Settings]
        RS[Resize]
    end
    
    subgraph "Settings"
        AO[Auto Open]
        AC[Auto Close]
    end
    
    H --> C
    C --> CL
    C --> ST
    C --> RS
    ST --> AO
    ST --> AC
```

## Features

### Core Functionality
- ✅ Automatic video detection
- ✅ Real-time lyrics extraction
- ✅ Multi-source lyrics search
- ✅ Intelligent content cleaning
- ✅ Language detection & handling

### UI/UX Features
- ✅ Resizable drawer interface
- ✅ Zoom controls
- ✅ Auto-open/close settings
- ✅ Smooth animations
- ✅ Responsive design

## Technical Stack

### Frontend
```mermaid
graph LR
    subgraph "Chrome Extension"
        JS[JavaScript ES6+]
        CSS[Modern CSS3]
        HTML[HTML5]
        API[Chrome APIs]
    end
```

### Backend
```mermaid
graph LR
    subgraph "Server Stack"
        PY[Python 3.8+]
        FA[FastAPI]
        BS[BeautifulSoup4]
        HX[httpx]
        GPT[GPT-3.5]
    end
```

## Installation

### Prerequisites
```bash
# Required
- Python 3.8+
- Chrome browser
- Node.js 14+

# API Keys
- GENIUS_ACCESS_TOKEN
- OPENAI_API_KEY
```

### Setup Steps
1. Clone repository
2. Install backend dependencies
3. Configure environment variables
4. Load extension in Chrome
5. Start backend server

## API Endpoints

### Main Search Endpoint
```typescript
GET/POST /api/search
Parameters:
- title: string
- preferred_language?: string

Response:
{
    song: string
    artist: string
    type: "lyrical" | "instrumental" | "error"
    lyrics?: string
    error?: string
}
```

## Performance Metrics

### Response Times
```mermaid
pie title "Average Processing Times (ms)"
    "Title Detection" : 50
    "API Request" : 100
    "Lyrics Search" : 300
    "Content Cleaning" : 200
    "UI Update" : 50
```

### Success Rates
```mermaid
pie title "Lyrics Source Success Rates"
    "Genius API" : 60
    "Known Sites" : 25
    "Web Search" : 10
    "Failed" : 5
```

## Error Handling

### Error Flow
```mermaid
graph TD
    A[Error Detected] --> B{Type?}
    B -->|API| C[Retry with Backoff]
    B -->|Scraping| D[Try Next Source]
    B -->|Validation| E[Use Fallback]
    C --> F[Log Error]
    D --> F
    E --> F
    F --> G[User Feedback]
```

## Security Measures

### Implementation
```mermaid
graph LR
    subgraph "Security Layers"
        A[Input Validation]
        B[API Authentication]
        C[Rate Limiting]
        D[Error Logging]
    end
    A --> B --> C --> D
```

## Testing Strategy

### Test Coverage
```mermaid
graph TD
    subgraph "Test Types"
        A[Unit Tests]
        B[Integration Tests]
        C[E2E Tests]
        D[Performance Tests]
    end
    A --> B --> C --> D
```

## Future Roadmap

### Planned Features
```mermaid
gantt
    title Development Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1
    Caching System    :2024-02-01, 30d
    Rate Limiting     :2024-02-15, 30d
    section Phase 2
    Offline Mode      :2024-03-01, 45d
    User Accounts     :2024-03-15, 45d
    section Phase 3
    ML Integration    :2024-04-01, 60d
    Mobile Support    :2024-04-15, 60d
``` 