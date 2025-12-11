# 🏦 Bank Nifty 12 Tracker

A real-time investment tracking tool for Bank Nifty's top 12 companies with live price fetching and custom multiplier calculations.

## 📋 Features

✅ **Real-time Price Tracking** - Live prices from Yahoo Finance API  
✅ **Historical Data** - Previous 2 days closing prices  
✅ **Custom Multiplier** - Input multiplier for investment calculations  
✅ **Auto Calculation** - Live Price × Multiplier = Calculated Value  
✅ **Auto-refresh** - Updates every 2 minutes during market hours  
✅ **Persistent Settings** - Multipliers saved in browser localStorage  
✅ **Market Status** - Shows if market is open or closed  
✅ **Responsive Design** - Works on desktop and mobile  

## 🏢 Tracked Stocks (Bank Nifty 12)

1. HDFC Bank
2. ICICI Bank
3. State Bank of India
4. Kotak Mahindra Bank
5. Axis Bank
6. IndusInd Bank
7. Bandhan Bank
8. Federal Bank
9. IDFC First Bank
10. Punjab National Bank
11. Bank of Baroda
12. AU Small Finance Bank

## 🚀 Quick Start Guide

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Internet connection

### Installation Steps

1. **Navigate to project directory**
```bash
cd bank-nifty-tracker
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
npm start
```

4. **Open in browser**
```
http://localhost:3000
```

## 📁 Project Structure

```
bank-nifty-tracker/
├── server.js           # Backend Express server
├── package.json        # Dependencies and scripts
├── public/
│   └── index.html     # Frontend UI
└── README.md          # This file
```

## 🔧 How It Works

### Backend (server.js)

1. **Express Server** - Serves API and static files
2. **Caching** - 60-second cache to avoid rate limits
3. **Yahoo Finance Integration** - Fetches data from Yahoo Finance API
4. **Error Handling** - Graceful fallbacks for failed requests

### API Endpoints

- `GET /api/stocks` - Get all Bank Nifty 12 stocks
- `GET /api/stocks/:symbol` - Get single stock data
- `GET /health` - Health check endpoint

### Frontend (index.html)

1. **Fetches data** from backend API
2. **Displays** in formatted table
3. **Calculates** Live Price × Multiplier
4. **Saves** multiplier values in localStorage
5. **Auto-refreshes** every 2 minutes during market hours (9:15 AM - 3:30 PM IST)

## 📊 Data Structure

```javascript
{
  symbol: "HDFCBANK",
  name: "HDFC Bank",
  dayBeforeClose: 1650.50,    // Day before yesterday's close
  previousClose: 1655.25,      // Yesterday's close
  livePrice: 1660.75,          // Current live price
  multiplier: 1,               // Your input
  calculatedValue: 1660.75     // livePrice × multiplier
}
```

## ⚙️ Configuration Options

### Change Auto-refresh Interval

In `public/index.html`, line ~390:
```javascript
setInterval(() => {
    // Your code
}, 120000); // Change 120000 to desired milliseconds
```

### Change Cache Duration

In `server.js`, line 6:
```javascript
const cache = new NodeCache({ stdTTL: 60 }); // Change 60 to desired seconds
```

### Add/Remove Stocks

In `server.js`, modify the `BANK_NIFTY_STOCKS` array:
```javascript
const BANK_NIFTY_STOCKS = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank' },
  // Add more stocks here
];
```

## 🌐 Yahoo Finance API Details

### URL Format
```
https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}.NS
```

### Indian Stock Symbol Format
- NSE stocks: Add `.NS` suffix (e.g., `HDFCBANK.NS`)
- BSE stocks: Add `.BO` suffix (e.g., `HDFCBANK.BO`)

### Response Structure
```json
{
  "chart": {
    "result": [{
      "meta": {
        "regularMarketPrice": 1660.75,
        "chartPreviousClose": 1655.25,
        "currency": "INR",
        "marketState": "REGULAR"
      },
      "indicators": {
        "quote": [{
          "close": [1650.50, 1655.25, 1660.75]
        }]
      }
    }]
  }
}
```

## 🚨 Important Notes

### Rate Limits
- Yahoo Finance allows ~2000 requests per hour
- Caching reduces API calls significantly
- Auto-refresh only during market hours

### Data Delays
- Free Yahoo Finance data may have 15-20 minute delay
- For real-time data, consider paid APIs (Upstox, Zerodha)

### Market Hours (NSE)
- Monday to Friday: 9:15 AM - 3:30 PM IST
- Closed on weekends and holidays

### CORS Issues
If you face CORS errors:
1. Use the backend proxy (already implemented)
2. Don't call Yahoo Finance directly from frontend

## 🐛 Troubleshooting

### Server won't start
```bash
# Check if port 3000 is already in use
lsof -i :3000

# Kill existing process
kill -9 <PID>

# Or change port in server.js
const PORT = process.env.PORT || 3001;
```

### No data showing
1. Check server logs for errors
2. Verify internet connection
3. Check if Yahoo Finance is accessible
4. Clear browser cache

### Multiplier not saving
- Check browser localStorage is enabled
- Try in different browser
- Clear localStorage: `localStorage.clear()` in console

## 📈 Next Steps & Enhancements

### Phase 2 Features (You can implement)
- [ ] Add charts for price trends
- [ ] Export to CSV/Excel
- [ ] Email/SMS alerts for price changes
- [ ] Portfolio tracking with multiple watchlists
- [ ] Historical price graphs
- [ ] Total portfolio value calculation
- [ ] Price change percentage indicators

### Advanced Integrations
- [ ] Replace Yahoo Finance with Upstox/Zerodha API for real-time data
- [ ] Add WebSocket for live streaming prices
- [ ] User authentication and saved portfolios
- [ ] Mobile app (React Native)
- [ ] Database for historical data

## 💡 Usage Examples

### Scenario 1: Equal Investment
- Set multiplier = `1` for all stocks
- See which stock gives best value

### Scenario 2: Custom Allocation
- Set multiplier = `10` for HDFC Bank (₹16,607.50)
- Set multiplier = `5` for ICICI Bank (₹6,502.50)
- See total investment required

### Scenario 3: Risk Assessment
- Compare day-before vs previous vs live prices
- Identify volatile stocks

## 📝 Legal Disclaimer

**This tool is for informational purposes only.**

- Not financial advice
- No guarantee of data accuracy
- Always verify data before trading
- Consult a registered financial advisor
- Past performance ≠ future results

## 🤝 Support & Contribution

### Found a bug?
1. Check existing issues
2. Create detailed bug report
3. Include screenshots/logs

### Want to contribute?
1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

## 📧 Contact

**Developer:** Taksh Shah  
**Expertise:** Shopify Development & Web Applications

---

## 🎯 Development Workflow

### Step 1: Initial Setup
```bash
npm install
npm start
```

### Step 2: Test API
```bash
curl http://localhost:3000/api/stocks
```

### Step 3: Access Frontend
Open browser: `http://localhost:3000`

### Step 4: Customize
- Modify stocks list in `server.js`
- Customize UI in `public/index.html`
- Add features as needed

---

**Happy Tracking! 📊🚀**
