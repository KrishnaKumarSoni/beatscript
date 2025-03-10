# BeatScript Architecture Documentation

## System Overview

BeatScript is a lyrics search and retrieval system that integrates multiple sources (Genius and JioSaavn) to provide accurate song lyrics. The system employs parallel processing, validation, and intelligent search strategies to ensure reliable results.

## High-Level Architecture

```mermaid
graph TB
    Client[Client Application]
    API[Express API Server]
    SearchService[Search Service]
    ValidationService[Validation Service]
    GeniusAPI[Genius API]
    JioSaavnAPI[JioSaavn API]
    GeniusScraper[Genius Scraper]
    JioSaavnScraper[JioSaavn Scraper]
    DB[(Database)]

    Client --> API
    API --> SearchService
    API --> ValidationService
    SearchService --> GeniusAPI
    SearchService --> JioSaavnAPI
    GeniusAPI --> GeniusScraper
    JioSaavnAPI --> JioSaavnScraper
    ValidationService --> DB
```

## Component Details

### 1. Server Components

```mermaid
classDiagram
    class ExpressServer {
        +routes: Router
        +middleware: Array
        +config: Object
    }
    
    class LyricsRouter {
        +search(): Response
        +test(): Response
    }
    
    class SearchService {
        +makeSearchString()
        +validateResults()
    }
    
    class APIIntegration {
        +GeniusAPI
        +JioSaavnAPI
    }
    
    class Scrapers {
        +GeniusScraper
        +JioSaavnScraper
    }

    ExpressServer --> LyricsRouter
    LyricsRouter --> SearchService
    SearchService --> APIIntegration
    APIIntegration --> Scrapers
```

### 2. Search Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant S as SearchService
    participant G as GeniusAPI
    participant J as JioSaavnAPI
    participant V as Validator
    participant Sc as Scrapers

    C->>A: POST /search
    A->>S: Process Search Request
    
    par Search APIs
        S->>G: Search Genius
        S->>J: Search JioSaavn
    end
    
    G-->>S: Genius Results
    J-->>S: JioSaavn Results
    
    S->>V: Validate Results
    V-->>S: Validation Scores
    
    par Scrape Lyrics
        S->>Sc: Scrape Valid Sources
    end
    
    Sc-->>S: Lyrics Content
    S-->>A: Best Result
    A-->>C: Response
```

### 3. Validation Process

```mermaid
flowchart TD
    A[Search Results] --> B{Validate Each Source}
    B --> C[Genius Validation]
    B --> D[JioSaavn Validation]
    
    C --> E{Check Confidence}
    D --> E
    
    E -->|>= 70%| F[Valid Result]
    E -->|< 70%| G[Invalid Result]
    
    F --> H[Return Best Match]
    G --> I[Fallback Logic]
```

## Key Components

1. **Express Server**
   - Main entry point
   - Route handling
   - Error management
   - Configuration management

2. **Search Service**
   - Search string generation
   - Multi-source search coordination
   - Result aggregation
   - Parallel processing

3. **API Integrations**
   - Genius API client
   - JioSaavn API client
   - Rate limiting
   - Error handling

4. **Scrapers**
   - HTML parsing
   - Lyrics extraction
   - Error recovery
   - Content validation

5. **Validation Service**
   - Confidence scoring
   - Result ranking
   - Quality assurance
   - Threshold management

## Data Flow

```mermaid
flowchart LR
    subgraph Input
        A[Song Title] --> B[Artist]
    end
    
    subgraph Processing
        C[Search String Generation]
        D[API Queries]
        E[Validation]
        F[Scraping]
    end
    
    subgraph Output
        G[Lyrics]
        H[Metadata]
        I[Confidence Score]
    end
    
    Input --> Processing
    Processing --> Output
```

## Error Handling

```mermaid
flowchart TD
    A[Error Occurs] --> B{Error Type}
    
    B -->|API Error| C[Retry Logic]
    B -->|Validation Error| D[Fallback Source]
    B -->|Scraping Error| E[Alternative URL]
    B -->|Server Error| F[500 Response]
    
    C --> G[Log & Monitor]
    D --> G
    E --> G
    F --> G
```

## Configuration Management

```mermaid
flowchart LR
    A[Environment Variables] --> B[Config Module]
    B --> C[API Keys]
    B --> D[Thresholds]
    B --> E[Timeouts]
    B --> F[Debug Settings]
```

## Performance Considerations

1. **Parallel Processing**
   - API calls executed simultaneously
   - Validation runs in parallel
   - Scraping performed concurrently

2. **Caching Strategy**
   - Results caching
   - API response caching
   - Validation score caching

3. **Error Recovery**
   - Graceful degradation
   - Multiple fallback options
   - Comprehensive logging

## Security Measures

1. **API Security**
   - Token management
   - Rate limiting
   - Request validation

2. **Data Validation**
   - Input sanitization
   - Output escaping
   - Content verification

## Monitoring and Logging

1. **Debug Mode**
   - Detailed logging
   - Performance metrics
   - Error tracking

2. **Health Checks**
   - API status monitoring
   - Service availability
   - Response times

## Future Improvements

1. **Scalability**
   - Load balancing
   - Service clustering
   - Cache distribution

2. **Features**
   - Additional lyrics sources
   - Enhanced validation
   - Machine learning integration

```mermaid
   sequenceDiagram
    participant C as Client
    participant R as Router
    participant G as Genius Service
    participant J as JioSaavn Service
    participant V as Validation Service

    C->>R: POST /search
    
    par Promise.race
        R->>G: Search & Validate
        R->>J: Search & Validate
    end

    par Genius Process
        G->>G: Search API
        G->>G: Scrape Lyrics
        G->>V: Validate Results
    end

    par JioSaavn Process
        J->>J: Search API
        J->>J: Scrape Lyrics
        J->>V: Validate Results
    end

    alt First Valid Result
        G-->>R: Valid Result
        R-->>C: Success Response
    else No Quick Result
        R->>G: Try Both Sources
        R->>J: Try Both Sources
        G-->>R: All Results
        J-->>R: All Results
        R->>V: Validate Combined
        V-->>R: Best Result
        R-->>C: Response
    end
```