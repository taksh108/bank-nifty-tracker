const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

const app = express();
const cache = new NodeCache({ stdTTL: 60 }); // Cache for 60 seconds

// File paths for persistent storage
// Use /tmp directory on Render (writable), fallback to current directory
const MULTIPLIERS_FILE = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'multipliers.json')
  : path.join(__dirname, 'multipliers.json');

const METADATA_FILE = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'metadata.json')
  : path.join(__dirname, 'metadata.json');

// Load multipliers from file or initialize with defaults
let stockMultipliers = {};
let multipliersMetadata = {
  lastSaved: null,
  pin: '1234' // Default PIN (can be changed via environment variable)
};
try {
  if (fs.existsSync(MULTIPLIERS_FILE)) {
    const data = fs.readFileSync(MULTIPLIERS_FILE, 'utf8');
    stockMultipliers = JSON.parse(data);
    console.log('Loaded multipliers from file:', MULTIPLIERS_FILE);
  } else {
    console.log('No existing multipliers file found at:', MULTIPLIERS_FILE);
  }
} catch (error) {
  console.log('Error loading multipliers file:', error.message);
  console.log('Starting with default multipliers');
}

// Load metadata
try {
  if (fs.existsSync(METADATA_FILE)) {
    const metaData = fs.readFileSync(METADATA_FILE, 'utf8');
    const loadedMetadata = JSON.parse(metaData);
    multipliersMetadata = { ...multipliersMetadata, ...loadedMetadata };
    console.log('Loaded metadata from file:', METADATA_FILE);
  }
} catch (error) {
  console.log('Error loading metadata file:', error.message);
}

// Override PIN from environment variable if provided
if (process.env.MULTIPLIER_PIN) {
  multipliersMetadata.pin = process.env.MULTIPLIER_PIN;
  console.log('PIN set from environment variable');
}

// Initialize default multipliers for all stocks
BUFFER_BANK_NIFTY_STOCKS = [
  'HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'INDUSINDBK',
  'BANDHANBNK', 'FEDERALBNK', 'IDFCFIRSTB', 'PNB', 'BANKBARODA', 'AUBANK'
];

BUFFER_BANK_NIFTY_STOCKS.forEach(symbol => {
  if (!stockMultipliers[symbol]) {
    stockMultipliers[symbol] = 1;
  }
});

// Save multipliers to file
function saveMultipliersToFile() {
  try {
    // Update last saved timestamp
    multipliersMetadata.lastSaved = new Date().toISOString();
    
    // Ensure directory exists
    const dir = path.dirname(MULTIPLIERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(MULTIPLIERS_FILE, JSON.stringify(stockMultipliers, null, 2));
    fs.writeFileSync(METADATA_FILE, JSON.stringify(multipliersMetadata, null, 2));
    console.log('Multipliers and metadata saved to files');
  } catch (error) {
    console.error('Error saving to files:', error.message);
    console.log('Data will be kept in memory only');
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Bank Nifty 12 stocks
const BANK_NIFTY_STOCKS = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank' },
  { symbol: 'AXISBANK', name: 'Axis Bank' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank' },
  { symbol: 'BANDHANBNK', name: 'Bandhan Bank' },
  { symbol: 'FEDERALBNK', name: 'Federal Bank' },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank' },
  { symbol: 'PNB', name: 'Punjab National Bank' },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda' },
  { symbol: 'AUBANK', name: 'AU Small Finance Bank' }
];

// Fetch stock data from Yahoo Finance
async function fetchStockData(symbol) {
  try {
    const cacheKey = `stock_${symbol}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`Cache hit for ${symbol}`);
      return cached;
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    });

    const result = response.data.chart.result[0];
    const meta = result.meta;
    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp;

    // Get historical data for previous closes
    const closes = quotes.close.filter(c => c !== null);
    
    const stockData = {
      symbol: symbol,
      livePrice: meta.regularMarketPrice || closes[closes.length - 1],
      previousClose: meta.chartPreviousClose || closes[closes.length - 2],
      dayBeforeClose: closes[closes.length - 3] || meta.chartPreviousClose,
      currency: meta.currency,
      marketState: meta.marketState,
      lastUpdated: new Date().toISOString()
    };

    cache.set(cacheKey, stockData);
    console.log(`Fetched data for ${symbol}: ₹${stockData.livePrice}`);
    
    return stockData;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error.message);
    return {
      symbol: symbol,
      livePrice: null,
      previousClose: null,
      dayBeforeClose: null,
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bank Nifty Tracker Server running on http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api/stocks`);
});
