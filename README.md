# Beatscript

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client Request │────▶│  Express Server │────▶│ Search Service  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Response w/URL  │◀────│ Validation Svc  │◀────│   API Clients   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────────┐
                                               │ Genius │ JioSaavan  │
                                               └─────────────────────┘
```

## Technical Specifications

### Core Components

1. **API Integration Layer**
   - `geniusApi.js`: REST client for Genius API (Bearer auth)
   - `jioSaavanAPI.js`: Reverse-engineered JioSaavan API client
   - Response format: `{url, source, title, artist, artistNames, releaseDate, imageUrl}`

2. **Search Optimization**
   - `searchService.js`: RegEx-based title cleaning
   - Patterns removed: `/(official|music|lyric|audio|video|visualizer)(?:\s*video)?/gi`
   - Bracket/parenthesis content stripped
   - Channel name deduplication

3. **Validation Engine**
   - `validationService.js`: OpenAI GPT-3.5-turbo integration
   - Prompt engineering for metadata validation
   - Confidence threshold: 70/100
   - Response format: `{isValid, confidence, metadata, source}`

4. **Parallel Processing**
   - `parallel.js`: Promise-based race implementation
   - `Promise.allSettled()` for non-blocking validation
   - Timeout handling: 10s default
   - Result sorting by confidence score

5. **API Surface**
   - `lyrics.js`: Express route handler
   - Endpoint: `POST /api/lyrics/search`
   - Content-Type: application/json
   - Required fields: `title`
   - Optional fields: `channel`

## Data Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Request  │───▶│ Search   │───▶│ API      │───▶│ Metadata │───▶│ Response │
│ Parser   │    │ String   │    │ Clients  │    │ Validate │    │ Builder  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                      │
                                      ▼
                               ┌─────────────┐
                               │ Parallel    │
                               │ Processing  │
                               └─────────────┘
```

## Implementation Details

### Search String Optimization

```javascript
// RegEx patterns for title cleaning
[
  /\b(official\s*(music|lyric|audio|video|visualizer|performance|hd|4k))(?:\s*video)?\b/gi,
  /\b(hd|full\s*hd|4k|8k|1080p|720p)\b/gi,
  /\([^)]*\)/g,  // Parentheses content
  /\[[^\]]*\]/g,  // Bracket content
  /\s{2,}/g  // Multiple spaces
]
```

### Validation Process

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ API Results │────▶│ Restructure │────▶│ Validation  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Response    │◀────│ Sort by     │◀────│ OpenAI API  │
└─────────────┘     │ Confidence  │     └─────────────┘
                    └─────────────┘
```

### Parallel Validation Algorithm

1. Filter valid metadata objects
2. Map to validation promises
3. Race against timeout (10s)
4. Await all with `Promise.allSettled()`
5. Extract fulfilled results
6. Filter by validation threshold (70%)
7. Sort by confidence score
8. Return highest confidence or null

### OpenAI Integration

- Model: gpt-3.5-turbo
- Temperature: 0.3 (low for consistency)
- Max tokens: 10 (number extraction only)
- Prompt structure:
  ```
  System: Music metadata validation assistant
  User: Search query + metadata fields
  Response: Confidence score (0-100)
  ```

### Error Handling

- API failures: Graceful degradation to alternative source
- Timeout handling: 10s default per API
- Validation failures: Return highest confidence result
- No results: 404 with descriptive error

## Performance Optimizations

1. **Reduced API Calls**
   - Eliminated duplicate OpenAI validation calls
   - Implemented early termination on first valid result
   - Skip validation for pre-validated results

2. **Parallel Processing**
   - Non-blocking API requests
   - Concurrent validation
   - Promise.allSettled() for improved error handling

3. **Response Time**
   - Average: ~500-800ms
   - Worst case: 10s (timeout)
   - Best case: ~300ms (cached/pre-validated)

## API Reference

### Request

```http
POST /api/lyrics/search
Content-Type: application/json

{
  "title": "string",
  "channel": "string" // optional
}
```

### Response (200 OK)

```typescript
{
  success: boolean,
  songUrl: string,
  source: "Genius" | "JioSaavan",
  metadata: {
    title: string,
    artist: string,
    artistNames?: string,
    album?: string,
    year?: string,
    releaseDate?: string,
    imageUrl?: string
  },
  validation: {
    isValid: boolean,
    confidence: number // 0-100
  },
  validated: boolean
}
```

### Error Responses

- **400**: Missing title
- **404**: No lyrics found / No validated results
- **500**: Server error

## Configuration

```javascript
{
  genius: {
    accessToken: string // Bearer token
  },
  openai: {
    apiKey: string,
    model: string, // default: "gpt-3.5-turbo"
    validationThreshold: number // default: 70
  },
  server: {
    port: number // default: 3000
  }
}
```

## Testing Tools

### CLI Test

```
node cli-test.js
> Enter song title: [input]
> Cleaned string: [output]
> API results: [output]
```

### Validation Test

```
node validation-test.js
> Enter song title: [input]
> Validation results: [confidence scores]
```

## Installation

```bash
git clone [repo]
npm install
npm start
```

## Dependencies

- express: ^4.18.2
- axios: ^1.6.0
- cors: ^2.8.5
- openai: ^4.85.4
