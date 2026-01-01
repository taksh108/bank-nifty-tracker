# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Basic Operations
- `npm start` - Start the Express server on port 3000
- `npm install` - Install all dependencies
- `node test.js` - Run system tests (tests Yahoo Finance API and local server health)
- `Ctrl+C` - Stop the running server

### Testing Strategy
- Use `node test.js` to verify Yahoo Finance API connectivity and server health
- Test endpoints directly: `http://localhost:3000/health` for server status
- Test the full application at `http://localhost:3000`

## Architecture Overview

This is a real-time stock tracking application for Bank Nifty's 14 banking stocks with a simple two-tier architecture:

### Backend (server.js)
- **Express.js server** serving both API endpoints and static files
- **Yahoo Finance API integration** - fetches live stock data from `https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}.NS`
- **NodeCache caching layer** - 60-second TTL to avoid rate limits (Yahoo Finance allows ~2000 requests/hour)
- **Bank Nifty 14 stock list** hardcoded in `BANK_NIFTY_STOCKS` array (lines 14-27)

### Frontend (public/index.html)
- **Single HTML file** with vanilla JavaScript - no build process required
- **Auto-refresh mechanism** - updates every 2 minutes during market hours (9:15 AM - 3:30 PM IST)
- **localStorage persistence** - saves user-defined multipliers for investment calculations
- **Real-time calculations** - multiplies live prices by user input for custom investment scenarios

### Key API Endpoints
- `GET /api/stocks` - Returns all 14 banking stocks with live prices
- `GET /api/stocks/:symbol` - Returns single stock data
- `GET /health` - Server health check

## Data Flow
1. Frontend JavaScript fetches from `/api/stocks`
2. Server checks NodeCache for recent data (60s TTL)
3. If cache miss, server calls Yahoo Finance API for each stock
4. Server aggregates and caches response
5. Frontend displays data in table with multiplier calculations
6. User multipliers are saved to browser localStorage

## Key Configuration Points

### Stock List (server.js:14-27)
The 14 Bank Nifty stocks are hardcoded. Each entry requires:
```javascript
{ symbol: 'HDFCBANK', name: 'HDFC Bank' }
```
Note: Yahoo Finance URLs automatically append `.NS` suffix for NSE stocks.

### Cache Duration (server.js:7)
```javascript
const cache = new NodeCache({ stdTTL: 60 });
```

### Auto-refresh Interval (public/index.html:~390)
```javascript
setInterval(() => {
    // refresh logic
}, 120000); // 2 minutes in milliseconds
```

### Server Port (server.js:146)
```javascript
const PORT = process.env.PORT || 3000;
```

## Important Implementation Details

- **No authentication or database** - this is a stateless application except for browser localStorage
- **Yahoo Finance API requires User-Agent header** to avoid blocking
- **Market hours detection** - auto-refresh only runs during NSE trading hours
- **Error handling** - graceful fallbacks for API failures, individual stock errors don't break the entire response
- **CORS enabled** - allows frontend-backend communication on same port

## Dependencies
- `express` - Web server framework
- `cors` - Cross-origin resource sharing
- `axios` - HTTP client for Yahoo Finance API calls
- `node-cache` - In-memory caching
- `nodemon` (dev) - Auto-restart during development

## Development Notes
- No build step required - server serves static HTML directly
- Use `nodemon server.js` for development auto-restart
- All stock symbols use NSE format (no .NS suffix in the hardcoded list)
- Free Yahoo Finance data has 15-20 minute delay
- Application is mobile-responsive and works across devices on same network