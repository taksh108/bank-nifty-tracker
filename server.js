const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

const app = express();
const cache = new NodeCache({ stdTTL: 5 }); // Cache for 5 seconds (safe with batched API: ~720 calls/hour)

// ============================================
// REDIS SETUP FOR PERSISTENT STORAGE
// ============================================
// Upstash Redis for persistent multiplier storage
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
let redis = null;
const REDIS_KEYS = {
  MULTIPLIERS: 'bank_nifty_multipliers',
  METADATA: 'bank_nifty_metadata'
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

// Default Bank Nifty 12 stocks (custom order)
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
  { symbol: 'AUBANK', name: 'AU Small Finance Bank' }
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

      if (constituents.length >= 10) { // Sanity check - should be 12 stocks
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

// Cache for NSE data (market cap) - longer TTL since it doesn't change often
const nseCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

// Fetch market cap from NSE India API
async function fetchNSEData(symbol) {
  const cacheKey = `nse_${symbol}`;
  const cached = nseCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://www.nseindia.com/api/quote-equity?symbol=${symbol}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://www.nseindia.com/get-quotes/equity?symbol=${symbol}`
      },
      timeout: 5000
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
    // Silently fail - market cap is optional
    return null;
  }
}

// Fetch ALL stocks in parallel using Yahoo for prices + NSE for market cap
async function fetchAllStocksBatched() {
  const cacheKey = 'all_stocks_batch';
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log('Cache hit for all stocks');
    return cached;
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    // Fetch all stocks in parallel - Yahoo for prices, NSE for market cap
    const promises = BANK_NIFTY_STOCKS.map(async (stock) => {
      try {
        // Fetch Yahoo chart data and NSE data in parallel
        const [chartRes, nseData] = await Promise.all([
          axios.get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}.NS`,
            { headers, timeout: 5000 }
          ),
          fetchNSEData(stock.symbol)
        ]);

        const meta = chartRes.data?.chart?.result?.[0]?.meta;

        if (meta) {
          return {
            symbol: stock.symbol,
            data: {
              symbol: stock.symbol,
              livePrice: meta.regularMarketPrice || null,
              previousClose: meta.chartPreviousClose || null,
              currency: meta.currency || 'INR',
              marketState: meta.marketState,
              dayHigh: meta.regularMarketDayHigh || null,
              dayLow: meta.regularMarketDayLow || null,
              volume: meta.regularMarketVolume || null,
              issuedSize: nseData?.issuedSize || null,
              marketCap: nseData?.marketCap || null,
              fiftyTwoWeekHigh: nseData?.fiftyTwoWeekHigh || null,
              fiftyTwoWeekLow: nseData?.fiftyTwoWeekLow || null,
              lastUpdated: new Date().toISOString()
            }
          };
        }
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
