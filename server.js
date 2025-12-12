const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

const app = express();
const cache = new NodeCache({ stdTTL: 5 }); // Cache for 5 seconds

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
      multipliersMetadata = { ...multipliersMetadata, ...loadedMetadata };
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
      multipliersMetadata = { ...multipliersMetadata, ...loadedMetadata };
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

// Default Bank Nifty 12 stocks (fallback if dynamic fetch fails)
const DEFAULT_BANK_NIFTY_STOCKS = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { symbol: 'AXISBANK', name: 'Axis Bank' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank' },
  { symbol: 'CANBK', name: 'Canara Bank' },
  { symbol: 'FEDERALBNK', name: 'Federal Bank' },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank' },
  { symbol: 'PNB', name: 'Punjab National Bank' },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda' },
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

// Update Bank Nifty stocks list
async function updateBankNiftyStocks() {
  const constituents = await fetchBankNiftyConstituents();
  if (constituents) {
    BANK_NIFTY_STOCKS = constituents;
    console.log('Bank Nifty stocks updated:', BANK_NIFTY_STOCKS.map(s => s.symbol).join(', '));

    // Initialize multipliers for any new stocks
    BANK_NIFTY_STOCKS.forEach(stock => {
      if (!stockMultipliers[stock.symbol]) {
        stockMultipliers[stock.symbol] = 1;
      }
    });
  }
}

// Initial fetch and periodic update (every 24 hours)
updateBankNiftyStocks();
setInterval(updateBankNiftyStocks, 24 * 60 * 60 * 1000);

// Fetch stock data from Yahoo Finance
async function fetchStockData(symbol) {
  try {
    const cacheKey = `stock_${symbol}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log(`Cache hit for ${symbol}`);
      return cached;
    }

    // Fetch both chart data and quote summary in parallel
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS`;
    const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}.NS?modules=price,summaryDetail`;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9'
    };

    const [chartResponse, summaryResponse] = await Promise.all([
      axios.get(chartUrl, { headers, timeout: 8000 }),
      axios.get(summaryUrl, { headers, timeout: 8000 }).catch(err => {
        console.log(`Quote summary failed for ${symbol}: ${err.message}`);
        return null;
      })
    ]);

    const result = chartResponse.data.chart.result[0];
    const meta = result.meta;
    const quotes = result.indicators.quote[0];

    // Get historical data for previous closes
    const closes = quotes.close.filter(c => c !== null);

    // Extract quote summary data (includes market cap, 52-week data)
    const priceData = summaryResponse?.data?.quoteSummary?.result?.[0]?.price || {};
    const summaryDetail = summaryResponse?.data?.quoteSummary?.result?.[0]?.summaryDetail || {};

    const stockData = {
      symbol: symbol,
      livePrice: meta.regularMarketPrice || closes[closes.length - 1],
      previousClose: meta.chartPreviousClose || closes[closes.length - 2],
      dayBeforeClose: closes[closes.length - 3] || meta.chartPreviousClose,
      currency: meta.currency,
      marketState: meta.marketState,
      // Market cap from price module (raw value)
      marketCap: priceData.marketCap?.raw || null,
      // Additional useful data
      fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh?.raw || null,
      fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow?.raw || null,
      dayHigh: priceData.regularMarketDayHigh?.raw || meta.regularMarketDayHigh || null,
      dayLow: priceData.regularMarketDayLow?.raw || meta.regularMarketDayLow || null,
      volume: priceData.regularMarketVolume?.raw || null,
      avgVolume: summaryDetail.averageVolume?.raw || null,
      lastUpdated: new Date().toISOString()
    };

    cache.set(cacheKey, stockData);
    const mcapStr = stockData.marketCap ? `₹${(stockData.marketCap / 10000000).toFixed(0)}Cr` : 'N/A';
    console.log(`Fetched ${symbol}: ₹${stockData.livePrice} | MCap: ${mcapStr}`);

    return stockData;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error.message);
    return {
      symbol: symbol,
      livePrice: null,
      previousClose: null,
      dayBeforeClose: null,
      marketCap: null,
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

// API endpoint to get all Bank Nifty stocks
app.get('/api/stocks', async (req, res) => {
  try {
    console.log('Fetching all Bank Nifty stocks...');
    
    const promises = BANK_NIFTY_STOCKS.map(async (stock) => {
      const data = await fetchStockData(stock.symbol);
      return {
        ...stock,
        ...data,
        multiplier: stockMultipliers[stock.symbol] || 1
      };
    });

    const results = await Promise.all(promises);
    
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
