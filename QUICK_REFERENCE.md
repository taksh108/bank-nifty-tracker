# 🎯 Quick Reference Card

## Essential Commands

```bash
# Installation
npm install                  # Install all dependencies

# Running
npm start                    # Start the server
node test.js                 # Run system tests

# Stopping
Ctrl + C                     # Stop the server (in terminal)

# Troubleshooting
npm install --force          # Force reinstall dependencies
rm -rf node_modules          # Delete dependencies
npm cache clean --force      # Clear npm cache
```

---

## File Structure Quick View

```
bank-nifty-tracker/
│
├── server.js              🔧 Backend server (Yahoo Finance API integration)
├── package.json           📦 Dependencies list
├── public/
│   └── index.html        🎨 Frontend UI (what you see in browser)
├── test.js               🧪 Testing script
├── README.md             📚 Full documentation
├── SETUP_GUIDE.md        📖 Step-by-step setup guide
└── .gitignore            🚫 Files to ignore in git
```

---

## URLs & Endpoints

| Purpose | URL |
|---------|-----|
| Main App | http://localhost:3000 |
| All Stocks API | http://localhost:3000/api/stocks |
| Single Stock API | http://localhost:3000/api/stocks/HDFCBANK |
| Health Check | http://localhost:3000/health |

---

## Yahoo Finance API

### URL Pattern
```
https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}.NS
```

### Examples
- HDFC Bank: `HDFCBANK.NS`
- SBI: `SBIN.NS`
- ICICI Bank: `ICICIBANK.NS`

### Rate Limits
- ~2000 requests/hour
- Free with 15-20 min delay
- Caching reduces API calls

---

## Key Features Locations

| Feature | File | Line |
|---------|------|------|
| Stock List | server.js | 10-23 |
| Cache Duration | server.js | 6 |
| Server Port | server.js | 150 |
| Auto-refresh Interval | index.html | 390 |
| Multiplier Logic | index.html | 145-155 |
| localStorage Save | index.html | 160-165 |

---

## Common Modifications

### 1. Change Server Port
**File:** server.js (line 150)
```javascript
const PORT = process.env.PORT || 8080; // Change 3000 to 8080
```

### 2. Change Auto-refresh Time
**File:** index.html (line 390)
```javascript
}, 300000); // 5 minutes = 300000 milliseconds
```

### 3. Add New Stock
**File:** server.js (after line 22)
```javascript
{ symbol: 'TCS', name: 'Tata Consultancy Services' },
```

### 4. Change Cache Time
**File:** server.js (line 6)
```javascript
const cache = new NodeCache({ stdTTL: 120 }); // 2 minutes
```

---

## Data Flow Diagram

```
User Browser
    ↓
    │ (1) Opens http://localhost:3000
    ↓
Express Server (server.js)
    ↓
    │ (2) Serves index.html
    ↓
User sees UI
    ↓
    │ (3) JavaScript fetches /api/stocks
    ↓
Express Server
    ↓
    │ (4) Checks cache
    │     ├─ If cached: Return cached data
    │     └─ If not cached: Continue →
    ↓
Yahoo Finance API
    │ (5) Fetch live prices
    ↓
Express Server
    │ (6) Parse & cache data
    ↓
User Browser
    │ (7) Display in table
    │ (8) User inputs multiplier
    │ (9) Calculate: Price × Multiplier
    └─ (10) Save to localStorage
```

---

## Browser Console Commands

Open console: Press `F12` or `Ctrl+Shift+I`

```javascript
// Check saved multipliers
localStorage.getItem('stockMultipliers')

// Clear saved multipliers
localStorage.clear()

// Force refresh
location.reload()

// Check if API is responding
fetch('http://localhost:3000/api/stocks')
  .then(r => r.json())
  .then(data => console.log(data))
```

---

## Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| "npm not found" | Install Node.js from nodejs.org |
| Port 3000 in use | Change PORT in server.js or kill process |
| No data showing | Check if server is running (`npm start`) |
| Old prices | Click "Refresh Data" button |
| Multiplier not saving | Enable cookies/localStorage in browser |
| CORS error | Use backend API, don't call Yahoo directly |

---

## Testing Checklist

Before considering it "done":

- [ ] Server starts without errors
- [ ] All 12 stocks visible in table
- [ ] Prices show with ₹ symbol
- [ ] Can change multiplier
- [ ] Calculated value updates
- [ ] Refresh button works
- [ ] Auto-refresh works (wait 2 mins during market hours)
- [ ] Multipliers persist after refresh
- [ ] Market status shows correctly
- [ ] Works on mobile (same network)

---

## Performance Tips

1. **Cache Duration**
   - Development: 30 seconds
   - Production: 60-120 seconds

2. **Auto-refresh**
   - During market hours: Every 2 minutes
   - After hours: No auto-refresh

3. **Browser Performance**
   - Clear cache regularly
   - Close other tabs
   - Use Chrome/Firefox

4. **Server Performance**
   - Use PM2 for production
   - Enable gzip compression
   - Add request rate limiting

---

## Security Notes

⚠️ **Important:**
- No API key required (Yahoo Finance)
- No user data stored on server
- Multipliers saved in browser only
- No sensitive data transmitted
- Use HTTPS in production

---

## Production Deployment

### Quick Deploy Options

1. **Heroku** (Free tier)
   - Push to Git
   - Deploy from dashboard
   - Auto-detects Node.js

2. **Vercel** (Free)
   - Connect GitHub repo
   - Auto-deploy on push
   - Serverless functions

3. **Railway** (Free tier)
   - One-click deploy
   - Simple dashboard
   - Auto HTTPS

### Environment Variables

```bash
PORT=3000
NODE_ENV=production
```

---

## Useful Links

| Resource | URL |
|----------|-----|
| Node.js Docs | https://nodejs.org/docs/ |
| Express.js | https://expressjs.com/ |
| Yahoo Finance | https://finance.yahoo.com/ |
| NSE India | https://www.nseindia.com/ |
| MDN JavaScript | https://developer.mozilla.org/ |

---

## Quick Command Reference

```bash
# Check versions
node --version
npm --version

# Project commands
npm init                    # Initialize new project
npm install <package>       # Install specific package
npm uninstall <package>     # Remove package
npm update                  # Update all packages
npm audit                   # Check security issues
npm audit fix               # Fix security issues

# Process management
ps aux | grep node          # Find Node processes
kill -9 <PID>              # Kill specific process
lsof -i :3000              # Find what's using port 3000

# File operations
ls -la                      # List all files
cat server.js              # View file contents
nano server.js             # Edit file (Linux/Mac)
notepad server.js          # Edit file (Windows)
```

---

## Market Hours (NSE India)

| Day | Time (IST) |
|-----|------------|
| Monday - Friday | 9:15 AM - 3:30 PM |
| Saturday | Closed |
| Sunday | Closed |
| Holidays | Closed (check NSE calendar) |

**Pre-open:** 9:00 AM - 9:15 AM  
**Post-close:** 3:30 PM - 4:00 PM (orders)

---

## Stock Symbol Reference

| Bank | NSE Symbol | Yahoo Symbol |
|------|-----------|--------------|
| HDFC Bank | HDFCBANK | HDFCBANK.NS |
| ICICI Bank | ICICIBANK | ICICIBANK.NS |
| SBI | SBIN | SBIN.NS |
| Kotak Bank | KOTAKBANK | KOTAKBANK.NS |
| Axis Bank | AXISBANK | AXISBANK.NS |
| IndusInd | INDUSINDBK | INDUSINDBK.NS |
| Bandhan | BANDHANBNK | BANDHANBNK.NS |
| Federal | FEDERALBNK | FEDERALBNK.NS |
| IDFC First | IDFCFIRSTB | IDFCFIRSTB.NS |
| PNB | PNB | PNB.NS |
| Bank of Baroda | BANKBARODA | BANKBARODA.NS |
| AU Small Finance | AUBANK | AUBANK.NS |

---

## Pro Tips 💡

1. **During Development**
   - Use `nodemon` for auto-restart: `npm install -g nodemon`
   - Run with: `nodemon server.js`

2. **For Better Logging**
   - Install Morgan: `npm install morgan`
   - Add to server.js: `app.use(require('morgan')('dev'))`

3. **For Environment Variables**
   - Create `.env` file
   - Install dotenv: `npm install dotenv`
   - Add: `require('dotenv').config()`

4. **For Production**
   - Use PM2: `npm install -g pm2`
   - Start: `pm2 start server.js`
   - Monitor: `pm2 monit`

---

**Keep this card handy while working on the project! 🚀**
