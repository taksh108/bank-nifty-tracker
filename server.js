const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

const app = express();
const cache = new NodeCache({ stdTTL: 5 }); // Cache for 5 seconds (safe with batched API: ~720 calls/hour)

// Fallback issuedSize values (shares outstanding) - used when NSE API fails
// These rarely change, update manually when needed (stock splits, buybacks, etc.)
const ISSUED_SIZE_FALLBACK = {
  HDFCBANK: 15382510606,
  ICICIBANK: 7150095682,
  AXISBANK: 3104242612,
  SBIN: 9230617586,
  KOTAKBANK: 1988752989,
  FEDERALBNK: 2462735490,
  INDUSINDBK: 779075972,
  IDFCFIRSTB: 8594892611,
  BANKBARODA: 5171362179,
  CANBK: 9070651260,
  PNB: 11492943268,
  AUBANK: 746660086,
  UNIONBANK: 8567909020, // Union Bank of India shares outstanding
  YESBANK: 31411179264, // Yes Bank shares outstanding
};

// ============================================
// REDIS SETUP FOR PERSISTENT STORAGE
// ============================================
// Upstash Redis for persistent multiplier storage
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
let redis = null;
const REDIS_KEYS = {
  MULTIPLIERS: 'bank_nifty_multipliers',
  METADATA: 'bank_nifty_metadata',
  HISTORICAL_LOGS: 'bank_nifty_historical_logs'
};

// Initialize Redis if credentials are available
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  });
  console.log('✅ Upstash Redis initialized for persistent storage');
} else {
  console.log('⚠️  Redis not configured - using file-based storage (not persistent on Render)');
  console.log('   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistence');
}

// File paths for fallback storage (local development)
const MULTIPLIERS_FILE = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'multipliers.json')
  : path.join(__dirname, 'multipliers.json');

const METADATA_FILE = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'metadata.json')
  : path.join(__dirname, 'metadata.json');

// Initialize multipliers and metadata
let stockMultipliers = {};
let multipliersMetadata = {
  lastSaved: null,
  pin: '1234' // Default PIN (can be changed via environment variable)
};

// Load from Redis (async)
async function loadFromRedis() {
  if (!redis) return false;

  try {
    const [multipliers, metadata] = await Promise.all([
      redis.get(REDIS_KEYS.MULTIPLIERS),
      redis.get(REDIS_KEYS.METADATA)
    ]);

    if (multipliers) {
      stockMultipliers = typeof multipliers === 'string' ? JSON.parse(multipliers) : multipliers;
      console.log('✅ Loaded multipliers from Redis');
    }

    if (metadata) {
      const loadedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      // Don't overwrite PIN from environment variable
      const envPin = process.env.MULTIPLIER_PIN;
      multipliersMetadata = { ...multipliersMetadata, ...loadedMetadata };
      // Restore environment PIN if set (takes priority over stored PIN)
      if (envPin) {
        multipliersMetadata.pin = envPin;
      }
      console.log('✅ Loaded metadata from Redis');
    }

    return true;
  } catch (error) {
    console.error('❌ Error loading from Redis:', error.message);
    return false;
  }
}

// Load from file (sync fallback)
function loadFromFile() {
  try {
    if (fs.existsSync(MULTIPLIERS_FILE)) {
      const data = fs.readFileSync(MULTIPLIERS_FILE, 'utf8');
      stockMultipliers = JSON.parse(data);
      console.log('Loaded multipliers from file:', MULTIPLIERS_FILE);
    } else {
      console.log('No existing multipliers file found');
    }
  } catch (error) {
    console.log('Error loading multipliers file:', error.message);
  }

  try {
    if (fs.existsSync(METADATA_FILE)) {
      const metaData = fs.readFileSync(METADATA_FILE, 'utf8');
      const loadedMetadata = JSON.parse(metaData);
      // Don't overwrite PIN from environment variable
      const envPin = process.env.MULTIPLIER_PIN;
      multipliersMetadata = { ...multipliersMetadata, ...loadedMetadata };
      // Restore environment PIN if set (takes priority over stored PIN)
      if (envPin) {
        multipliersMetadata.pin = envPin;
      }
      console.log('Loaded metadata from file');
    }
  } catch (error) {
    console.log('Error loading metadata file:', error.message);
  }
}

// Override PIN from environment variable if provided
if (process.env.MULTIPLIER_PIN) {
  multipliersMetadata.pin = process.env.MULTIPLIER_PIN;
  console.log('PIN set from environment variable');
}

// Initialize default multipliers for all stocks (includes both old and new constituents for compatibility)
const BUFFER_BANK_NIFTY_STOCKS = [
  'HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK',
  'CANBK', 'FEDERALBNK', 'IDFCFIRSTB', 'PNB', 'BANKBARODA', 'AUBANK',
  'UNIONBANK', 'YESBANK',
  'BANDHANBNK' // Keep for backward compatibility with saved multipliers
];

function initializeDefaultMultipliers() {
  BUFFER_BANK_NIFTY_STOCKS.forEach(symbol => {
    if (!stockMultipliers[symbol]) {
      stockMultipliers[symbol] = 1;
    }
  });
}

// Save to Redis (async)
async function saveToRedis() {
  if (!redis) return false;

  try {
    multipliersMetadata.lastSaved = new Date().toISOString();

    await Promise.all([
      redis.set(REDIS_KEYS.MULTIPLIERS, JSON.stringify(stockMultipliers)),
      redis.set(REDIS_KEYS.METADATA, JSON.stringify(multipliersMetadata))
    ]);

    console.log('✅ Multipliers saved to Redis');
    return true;
  } catch (error) {
    console.error('❌ Error saving to Redis:', error.message);
    return false;
  }
}

// Save to file (sync fallback)
function saveToFile() {
  try {
    multipliersMetadata.lastSaved = new Date().toISOString();

    const dir = path.dirname(MULTIPLIERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(MULTIPLIERS_FILE, JSON.stringify(stockMultipliers, null, 2));
    fs.writeFileSync(METADATA_FILE, JSON.stringify(multipliersMetadata, null, 2));
    console.log('Multipliers saved to file');
  } catch (error) {
    console.error('Error saving to files:', error.message);
  }
}

// Save multipliers (tries Redis first, falls back to file)
async function saveMultipliers() {
  const savedToRedis = await saveToRedis();
  if (!savedToRedis) {
    saveToFile();
  }
}

// Legacy function name for compatibility
function saveMultipliersToFile() {
  saveMultipliers();
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Default Bank Nifty 14 stocks (custom order)
const DEFAULT_BANK_NIFTY_STOCKS = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'AXISBANK', name: 'Axis Bank' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { symbol: 'FEDERALBNK', name: 'Federal Bank' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank' },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank' },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda' },
  { symbol: 'CANBK', name: 'Canara Bank' },
  { symbol: 'PNB', name: 'Punjab National Bank' },
  { symbol: 'AUBANK', name: 'AU Small Finance Bank' },
  { symbol: 'UNIONBANK', name: 'Union Bank of India' },
  { symbol: 'YESBANK', name: 'Yes Bank' }
];

// Dynamic stock list (updated from NSE)
let BANK_NIFTY_STOCKS = [...DEFAULT_BANK_NIFTY_STOCKS];

// NSE symbol to name mapping for dynamic fetching
const SYMBOL_NAME_MAP = {
  'HDFCBANK': 'HDFC Bank',
  'ICICIBANK': 'ICICI Bank',
  'SBIN': 'State Bank of India',
  'KOTAKBANK': 'Kotak Mahindra Bank',
  'AXISBANK': 'Axis Bank',
  'INDUSINDBK': 'IndusInd Bank',
  'CANBK': 'Canara Bank',
  'FEDERALBNK': 'Federal Bank',
  'IDFCFIRSTB': 'IDFC First Bank',
  'PNB': 'Punjab National Bank',
  'BANKBARODA': 'Bank of Baroda',
  'AUBANK': 'AU Small Finance Bank',
  'BANDHANBNK': 'Bandhan Bank',
  'RBLBANK': 'RBL Bank',
  'YESBANK': 'Yes Bank',
  'IDBI': 'IDBI Bank',
  'UNIONBANK': 'Union Bank of India',
  'IOB': 'Indian Overseas Bank',
  'CENTRALBK': 'Central Bank of India',
  'INDIANB': 'Indian Bank',
  'MAHABANK': 'Maharashtra Bank',
  'UCOBANK': 'UCO Bank',
  'BANKINDIA': 'Bank of India',
  'PSB': 'Punjab & Sind Bank'
};

// Fetch Bank Nifty constituents from NSE
async function fetchBankNiftyConstituents() {
  try {
    console.log('Fetching Bank Nifty constituents from NSE...');

    // Try NSE India API for index constituents
    const url = 'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY%20BANK',
        'Connection': 'keep-alive'
      },
      timeout: 10000
    });

    if (response.data && response.data.data) {
      const constituents = response.data.data
        .filter(stock => stock.symbol !== 'NIFTY BANK') // Exclude the index itself
        .map(stock => ({
          symbol: stock.symbol,
          name: SYMBOL_NAME_MAP[stock.symbol] || stock.symbol
        }));

      if (constituents.length >= 10) { // Sanity check - should be 14 stocks
        console.log(`Successfully fetched ${constituents.length} Bank Nifty constituents`);
        return constituents;
      }
    }

    console.log('NSE API response did not contain expected data, using defaults');
    return null;
  } catch (error) {
    console.log('Could not fetch from NSE API:', error.message);
    return null;
  }
}

// Update Bank Nifty stocks - only logs changes, keeps custom order
async function updateBankNiftyStocks() {
  const constituents = await fetchBankNiftyConstituents();
  if (constituents) {
    const currentSymbols = new Set(BANK_NIFTY_STOCKS.map(s => s.symbol));
    const newSymbols = new Set(constituents.map(s => s.symbol));

    // Check for any changes (don't update order, just log)
    const added = constituents.filter(s => !currentSymbols.has(s.symbol));
    const removed = BANK_NIFTY_STOCKS.filter(s => !newSymbols.has(s.symbol));

    if (added.length > 0) {
      console.log('⚠️  New stocks in Bank Nifty:', added.map(s => s.symbol).join(', '));
    }
    if (removed.length > 0) {
      console.log('⚠️  Removed from Bank Nifty:', removed.map(s => s.symbol).join(', '));
    }

    // Initialize multipliers for any new stocks
    constituents.forEach(stock => {
      if (!stockMultipliers[stock.symbol]) {
        stockMultipliers[stock.symbol] = 1;
      }
    });
  }
}

// Check for constituent changes (every 24 hours) - doesn't change order
updateBankNiftyStocks();
setInterval(updateBankNiftyStocks, 24 * 60 * 60 * 1000);

// ============================================
// HISTORICAL DATA LOGGING
// ============================================

// Check if current time is during market hours (9:15 AM - 3:30 PM IST)
function isDuringMarketHours() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();

  // Market hours: 9:15 AM to 3:30 PM IST
  const currentMinutes = hours * 60 + minutes;
  const marketOpen = 9 * 60 + 15;  // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM

  return currentMinutes >= marketOpen && currentMinutes <= marketClose;
}

// Log historical data point
async function logHistoricalData() {
  if (!redis) {
    console.log('⚠️  Redis not configured, skipping historical logging');
    return;
  }

  try {
    console.log('📊 Logging historical data point...');

    // Fetch Bank Nifty index
    const bankNiftyUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEBANK';
    const bankNiftyRes = await axios.get(bankNiftyUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 5000
    });

    const bankNiftyPrice = bankNiftyRes.data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (!bankNiftyPrice) {
      console.log('⚠️  Could not fetch Bank Nifty index');
      return;
    }

    // Fetch all stocks to calculate total
    const stocksData = await fetchAllStocksBatched();

    if (!stocksData) {
      console.log('⚠️  Could not fetch stocks data');
      return;
    }

    // Calculate total of Result column (sum of all stock prices × multipliers)
    let calculatedTotal = 0;
    BANK_NIFTY_STOCKS.forEach(stock => {
      const stockData = stocksData[stock.symbol];
      if (stockData && stockData.livePrice) {
        const multiplier = stockMultipliers[stock.symbol] || 1;
        calculatedTotal += stockData.livePrice * multiplier;
      }
    });

    // Create data point
    const dataPoint = {
      timestamp: new Date().toISOString(),
      bankNiftyIndex: bankNiftyPrice,
      calculatedTotal: calculatedTotal,
      difference: calculatedTotal - bankNiftyPrice,
      percentageDiff: ((calculatedTotal - bankNiftyPrice) / bankNiftyPrice * 100).toFixed(4)
    };

    console.log(`✅ Data logged - Bank Nifty: ₹${bankNiftyPrice.toFixed(2)}, Calculated: ₹${calculatedTotal.toFixed(2)}, Diff: ${dataPoint.percentageDiff}%`);

    // Get existing logs
    let logs = await redis.get(REDIS_KEYS.HISTORICAL_LOGS);
    if (typeof logs === 'string') {
      logs = JSON.parse(logs);
    }
    if (!Array.isArray(logs)) {
      logs = [];
    }

    // Add new data point
    logs.push(dataPoint);

    // Keep only last 7 days of data (assuming 5-min intervals, ~75 hours of market time per week)
    // 75 hours × 12 logs/hour = 900 logs per week
    const maxLogs = 1000;
    if (logs.length > maxLogs) {
      logs = logs.slice(-maxLogs);
    }

    // Save back to Redis
    await redis.set(REDIS_KEYS.HISTORICAL_LOGS, JSON.stringify(logs));

  } catch (error) {
    console.error('❌ Error logging historical data:', error.message);
  }
}

// Schedule logging every 5 minutes during market hours
setInterval(async () => {
  if (isDuringMarketHours()) {
    await logHistoricalData();
  } else {
    console.log('⏸️  Outside market hours, skipping data logging');
  }
}, 5 * 60 * 1000); // 5 minutes

// Log immediately on startup if during market hours
setTimeout(async () => {
  if (isDuringMarketHours()) {
    console.log('🚀 Server started during market hours, logging initial data point...');
    await logHistoricalData();
  }
}, 10000); // Wait 10 seconds for server to fully initialize

// Cache for NSE data (market cap) - longer TTL since it doesn't change often
const nseCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

// NSE session management
let nseCookies = null;
let nseSessionExpiry = 0;

// Get NSE session cookies with improved headers
async function getNSESession() {
  const now = Date.now();

  // Return cached cookies if still valid (15 min session)
  if (nseCookies && now < nseSessionExpiry) {
    return nseCookies;
  }

  try {
    const response = await axios.get('https://www.nseindia.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document'
      },
      timeout: 10000,
      maxRedirects: 5
    });

    // Extract cookies from response headers
    const setCookies = response.headers['set-cookie'];
    if (setCookies) {
      nseCookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
      nseSessionExpiry = now + (15 * 60 * 1000); // 15 minutes
      console.log('✅ NSE session established');
      return nseCookies;
    }
  } catch (err) {
    console.log('⚠️ Could not establish NSE session:', err.message);
  }

  return null;
}

// Fetch all Bank Nifty stocks from NSE constituents API (most accurate)
async function fetchNSEBankNiftyPrices() {
  try {
    const cookies = await getNSESession();
    if (!cookies) {
      return null;
    }

    const url = 'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20BANK';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
        'Cookie': cookies,
        'Connection': 'keep-alive',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
      },
      timeout: 10000
    });

    if (response.data && response.data.data) {
      const priceMap = {};
      response.data.data.forEach(stock => {
        if (stock.symbol && stock.symbol !== 'NIFTY BANK') {
          priceMap[stock.symbol] = {
            livePrice: stock.lastPrice,
            previousClose: stock.previousClose,
            dayHigh: stock.dayHigh,
            dayLow: stock.dayLow,
            volume: stock.totalTradedVolume,
            change: stock.change,
            pChange: stock.pChange
          };
        }
      });
      console.log(`✅ Fetched NSE prices for ${Object.keys(priceMap).length} stocks`);
      return priceMap;
    }
  } catch (err) {
    console.log('⚠️ NSE Bank Nifty API failed:', err.message);
  }
  return null;
}

// Fetch shares outstanding from Yahoo Finance (fallback when NSE fails)
async function fetchYahooFinanceData(symbol) {
  try {
    // Yahoo Finance v7 quote endpoint - more accessible
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbol}.NS`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/'
      },
      timeout: 5000
    });

    const result = response.data?.quoteResponse?.result?.[0];
    const sharesOutstanding = result?.sharesOutstanding;
    const marketCap = result?.marketCap;
    const fiftyTwoWeekHigh = result?.fiftyTwoWeekHigh;
    const fiftyTwoWeekLow = result?.fiftyTwoWeekLow;

    if (sharesOutstanding || marketCap) {
      console.log(`✅ Yahoo Finance data for ${symbol}: shares=${sharesOutstanding?.toLocaleString()}, mktCap=${marketCap?.toLocaleString()}`);
      return {
        issuedSize: sharesOutstanding,
        marketCap: marketCap,
        fiftyTwoWeekHigh: fiftyTwoWeekHigh,
        fiftyTwoWeekLow: fiftyTwoWeekLow
      };
    }
  } catch (err) {
    console.log(`⚠️ Yahoo Finance data fetch failed for ${symbol}:`, err.message);
  }
  return null;
}

// Fetch market cap from NSE India API
async function fetchNSEData(symbol) {
  const cacheKey = `nse_${symbol}`;
  const cached = nseCache.get(cacheKey);
  if (cached) return cached;

  try {
    // Get session cookies first
    const cookies = await getNSESession();
    if (!cookies) {
      // Try Yahoo Finance as fallback
      return await fetchYahooFinanceData(symbol);
    }

    const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nseindia.com/get-quotes/equity?symbol=' + encodeURIComponent(symbol),
        'Cookie': cookies,
        'Connection': 'keep-alive'
      },
      timeout: 8000
    });

    const data = response.data;
    const issuedSize = data?.securityInfo?.issuedSize;
    const lastPrice = data?.priceInfo?.lastPrice;
    const marketCap = issuedSize && lastPrice ? issuedSize * lastPrice : null;

    const nseData = {
      issuedSize,
      marketCap,
      fiftyTwoWeekHigh: data?.priceInfo?.weekHighLow?.max,
      fiftyTwoWeekLow: data?.priceInfo?.weekHighLow?.min
    };

    nseCache.set(cacheKey, nseData);
    return nseData;
  } catch (err) {
    console.log(`⚠️ NSE data fetch failed for ${symbol}:`, err.message);
    // Invalidate session on auth errors
    if (err.response?.status === 401 || err.response?.status === 403) {
      nseCookies = null;
      nseSessionExpiry = 0;
    }
    // Try Yahoo Finance as fallback
    return await fetchYahooFinanceData(symbol);
  }
}

// Fetch ALL stocks in parallel - NSE primary, Yahoo fallback
async function fetchAllStocksBatched() {
  const cacheKey = 'all_stocks_batch';
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log('Cache hit for all stocks');
    return cached;
  }

  try {
    // Try NSE Bank Nifty API first (most accurate, single API call for all stocks)
    const nsePrices = await fetchNSEBankNiftyPrices();

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    // Fetch all stocks in parallel - NSE prices if available, Yahoo fallback
    const promises = BANK_NIFTY_STOCKS.map(async (stock) => {
      try {
        const nsePrice = nsePrices?.[stock.symbol];

        // If NSE prices available, use them; otherwise fetch from Yahoo
        let priceData;
        if (nsePrice) {
          // Use NSE prices (most accurate)
          priceData = {
            livePrice: nsePrice.livePrice,
            previousClose: nsePrice.previousClose,
            dayHigh: nsePrice.dayHigh,
            dayLow: nsePrice.dayLow,
            volume: nsePrice.volume,
            change: nsePrice.change,
            pChange: nsePrice.pChange,
            marketState: 'REGULAR',
            currency: 'INR'
          };
        } else {
          // Fallback to Yahoo Finance
          const chartRes = await axios.get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}.NS`,
            { headers, timeout: 5000 }
          );
          const meta = chartRes.data?.chart?.result?.[0]?.meta;
          if (!meta) {
            throw new Error('No Yahoo data');
          }
          priceData = {
            livePrice: meta.regularMarketPrice,
            previousClose: meta.chartPreviousClose,
            dayHigh: meta.regularMarketDayHigh,
            dayLow: meta.regularMarketDayLow,
            volume: meta.regularMarketVolume,
            marketState: meta.marketState,
            currency: meta.currency || 'INR'
          };
        }

        // Fetch NSE market cap data separately (for issuedSize)
        const nseData = await fetchNSEData(stock.symbol);

        return {
          symbol: stock.symbol,
          data: {
            symbol: stock.symbol,
            livePrice: priceData.livePrice || null,
            previousClose: priceData.previousClose || null,
            currency: priceData.currency || 'INR',
            marketState: priceData.marketState,
            dayHigh: priceData.dayHigh || null,
            dayLow: priceData.dayLow || null,
            volume: priceData.volume || null,
            issuedSize: nseData?.issuedSize || ISSUED_SIZE_FALLBACK[stock.symbol] || null,
            marketCap: nseData?.marketCap ||
              (priceData.livePrice && (nseData?.issuedSize || ISSUED_SIZE_FALLBACK[stock.symbol]))
                ? (nseData?.issuedSize || ISSUED_SIZE_FALLBACK[stock.symbol]) * priceData.livePrice
                : null,
            fiftyTwoWeekHigh: nseData?.fiftyTwoWeekHigh || null,
            fiftyTwoWeekLow: nseData?.fiftyTwoWeekLow || null,
            lastUpdated: new Date().toISOString()
          }
        };
      } catch (err) {
        console.error(`Failed ${stock.symbol}: ${err.message}`);
      }
      return { symbol: stock.symbol, data: null };
    });

    const results = await Promise.all(promises);
    const stockDataMap = {};

    results.forEach(r => {
      if (r.data) {
        stockDataMap[r.symbol] = r.data;
      }
    });

    const count = Object.keys(stockDataMap).length;
    if (count > 0) {
      console.log(`Fetched ${count} stocks`);
      cache.set(cacheKey, stockDataMap);
      return stockDataMap;
    }

    return null;
  } catch (error) {
    console.error('Batch fetch failed:', error.message);
    return null;
  }
}

// Fallback: Fetch single stock data using chart endpoint (more reliable)
async function fetchStockData(symbol) {
  try {
    const cacheKey = `stock_${symbol}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=5d`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com/'
    };

    const response = await axios.get(url, { headers, timeout: 8000 });
    const result = response.data?.chart?.result?.[0];

    if (!result) {
      throw new Error('No data returned');
    }

    const meta = result.meta;

    const stockData = {
      symbol: symbol,
      livePrice: meta.regularMarketPrice || null,
      previousClose: meta.chartPreviousClose || meta.previousClose || null,
      currency: meta.currency || 'INR',
      marketState: meta.marketState,
      dayHigh: meta.regularMarketDayHigh || null,
      dayLow: meta.regularMarketDayLow || null,
      volume: meta.regularMarketVolume || null,
      lastUpdated: new Date().toISOString()
    };

    cache.set(cacheKey, stockData);
    console.log(`Fetched ${symbol}: ₹${stockData.livePrice}`);
    return stockData;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error.message);
    return {
      symbol: symbol,
      livePrice: null,
      previousClose: null,
      error: error.message
    };
  }
}

// API endpoint to get Bank Nifty index
app.get('/api/banknifty', async (req, res) => {
  try {
    console.log('Fetching Bank Nifty index...');
    
    // Fetch Bank Nifty index using Yahoo Finance symbol
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEBANK`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    });

    const result = response.data.chart.result[0];
    const meta = result.meta;
    
    const indexData = {
      symbol: 'BANKNIFTY',
      livePrice: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose,
      currency: meta.currency,
      marketState: meta.marketState,
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: indexData
    });
  } catch (error) {
    console.error('Error fetching Bank Nifty:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to get all Bank Nifty stocks (uses batched API call)
app.get('/api/stocks', async (req, res) => {
  try {
    // Try batched fetch first (1 API call for all stocks)
    const batchedData = await fetchAllStocksBatched();

    let results;
    if (batchedData) {
      // Use batched data
      results = BANK_NIFTY_STOCKS.map(stock => ({
        ...stock,
        ...(batchedData[stock.symbol] || {}),
        multiplier: stockMultipliers[stock.symbol] || 1
      }));
    } else {
      // Fallback to individual fetches
      console.log('Falling back to individual stock fetches...');
      const promises = BANK_NIFTY_STOCKS.map(async (stock) => {
        const data = await fetchStockData(stock.symbol);
        return {
          ...stock,
          ...data,
          multiplier: stockMultipliers[stock.symbol] || 1
        };
      });
      results = await Promise.all(promises);
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: results
    });
  } catch (error) {
    console.error('Error in /api/stocks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to get single stock
app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const stock = BANK_NIFTY_STOCKS.find(s => s.symbol === symbol.toUpperCase());
    
    if (!stock) {
      return res.status(404).json({
        success: false,
        error: 'Stock not found'
      });
    }

    const data = await fetchStockData(stock.symbol);
    
    res.json({
      success: true,
      data: {
        ...stock,
        ...data
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to get all multipliers
app.get('/api/multipliers', (req, res) => {
  res.json({
    success: true,
    data: stockMultipliers,
    metadata: {
      lastSaved: multipliersMetadata.lastSaved
    }
  });
});

// API endpoint to verify PIN
app.post('/api/verify-pin', (req, res) => {
  try {
    const { pin } = req.body;
    
    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required'
      });
    }
    
    if (pin === multipliersMetadata.pin) {
      res.json({
        success: true,
        message: 'PIN verified successfully'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid PIN'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to update all multipliers
app.post('/api/multipliers', (req, res) => {
  try {
    const multipliers = req.body;
    
    // Validate and update multipliers
    Object.keys(multipliers).forEach(symbol => {
      const value = parseFloat(multipliers[symbol]);
      if (!isNaN(value) && value >= 0) {
        stockMultipliers[symbol] = value;
      }
    });
    
    // Save to file
    saveMultipliersToFile();
    
    res.json({
      success: true,
      data: stockMultipliers
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to update single multiplier (with PIN protection)
app.put('/api/multipliers/:symbol', (req, res) => {
  try {
    const { symbol } = req.params;
    const { multiplier, pin } = req.body;
    const value = parseFloat(multiplier);
    
    console.log(`Attempting to update multiplier for ${symbol}: ${multiplier}`);
    
    // Verify PIN first
    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required to update multipliers'
      });
    }
    
    if (pin !== multipliersMetadata.pin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid PIN'
      });
    }
    
    if (isNaN(value) || value < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid multiplier value'
      });
    }
    
    stockMultipliers[symbol.toUpperCase()] = value;
    
    // Save to file (async to avoid blocking)
    setTimeout(() => saveMultipliersToFile(), 0);
    
    res.json({
      success: true,
      data: { symbol: symbol.toUpperCase(), multiplier: value },
      lastSaved: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating multiplier:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to get current Bank Nifty constituents
app.get('/api/constituents', (req, res) => {
  res.json({
    success: true,
    data: BANK_NIFTY_STOCKS,
    count: BANK_NIFTY_STOCKS.length,
    lastUpdated: new Date().toISOString()
  });
});

// API endpoint to manually refresh Bank Nifty constituents
app.post('/api/constituents/refresh', async (req, res) => {
  try {
    console.log('Manual refresh of Bank Nifty constituents requested');
    await updateBankNiftyStocks();
    res.json({
      success: true,
      data: BANK_NIFTY_STOCKS,
      count: BANK_NIFTY_STOCKS.length,
      message: 'Constituents refreshed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint to get historical logs
app.get('/api/historical', async (req, res) => {
  try {
    if (!redis) {
      return res.status(503).json({
        success: false,
        error: 'Redis not configured - historical logging unavailable'
      });
    }

    let logs = await redis.get(REDIS_KEYS.HISTORICAL_LOGS);
    if (typeof logs === 'string') {
      logs = JSON.parse(logs);
    }
    if (!Array.isArray(logs)) {
      logs = [];
    }

    // Calculate statistics
    const stats = {
      totalPoints: logs.length,
      averageDifference: 0,
      maxDifference: 0,
      minDifference: 0,
      correlation: 0
    };

    if (logs.length > 0) {
      const diffs = logs.map(log => parseFloat(log.percentageDiff));
      stats.averageDifference = (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(4);
      stats.maxDifference = Math.max(...diffs).toFixed(4);
      stats.minDifference = Math.min(...diffs).toFixed(4);

      // Calculate correlation coefficient
      const bankNiftyValues = logs.map(log => log.bankNiftyIndex);
      const calculatedValues = logs.map(log => log.calculatedTotal);

      if (bankNiftyValues.length > 1) {
        const meanBN = bankNiftyValues.reduce((a, b) => a + b, 0) / bankNiftyValues.length;
        const meanCalc = calculatedValues.reduce((a, b) => a + b, 0) / calculatedValues.length;

        const numerator = bankNiftyValues.reduce((sum, bn, i) =>
          sum + (bn - meanBN) * (calculatedValues[i] - meanCalc), 0);

        const denomBN = Math.sqrt(bankNiftyValues.reduce((sum, bn) =>
          sum + Math.pow(bn - meanBN, 2), 0));

        const denomCalc = Math.sqrt(calculatedValues.reduce((sum, calc) =>
          sum + Math.pow(calc - meanCalc, 2), 0));

        if (denomBN && denomCalc) {
          stats.correlation = (numerator / (denomBN * denomCalc)).toFixed(4);
        }
      }
    }

    res.json({
      success: true,
      data: logs,
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: redis ? 'connected' : 'not configured'
  });
});

// Initialize and start server
async function startServer() {
  const PORT = process.env.PORT || 3000;

  // Load data: try Redis first, then file
  console.log('📂 Loading multipliers...');
  const loadedFromRedis = await loadFromRedis();
  if (!loadedFromRedis) {
    loadFromFile();
  }

  // Initialize default multipliers for any missing stocks
  initializeDefaultMultipliers();

  // Start the server
  app.listen(PORT, () => {
    console.log(`🚀 Bank Nifty Tracker Server running on http://localhost:${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api/stocks`);
    if (redis) {
      console.log(`💾 Persistent storage: Upstash Redis`);
    } else {
      console.log(`💾 Storage: Local file (not persistent on Render)`);
    }
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
