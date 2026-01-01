# 🚀 SETUP GUIDE - Bank Nifty Tracker

## Complete Step-by-Step Guide for Beginners

---

## 📋 Prerequisites Check

Before starting, ensure you have:

1. **Node.js installed**
   - Check: Open terminal and run `node --version`
   - Should show: v14.x.x or higher
   - If not installed: Download from https://nodejs.org/

2. **Internet connection**
   - Required for fetching live stock data

3. **Text editor (optional)**
   - VS Code, Sublime Text, or any code editor
   - For viewing/editing code

---

## 🎯 STEP 1: Download Project Files

You have these files:
```
bank-nifty-tracker/
├── server.js           → Backend server
├── package.json        → Dependencies list
├── public/
│   └── index.html     → Frontend UI
├── test.js            → Test script
├── README.md          → Documentation
└── .gitignore         → Git ignore file
```

---

## 🎯 STEP 2: Install Dependencies

### Open Terminal/Command Prompt

**Windows:**
- Press `Win + R`
- Type `cmd` and press Enter

**Mac/Linux:**
- Press `Cmd + Space`
- Type `terminal` and press Enter

### Navigate to Project Folder

```bash
cd path/to/bank-nifty-tracker
```

Example:
```bash
cd Desktop/bank-nifty-tracker
```

### Install Packages

```bash
npm install
```

This will install:
- express (server framework)
- cors (cross-origin requests)
- axios (HTTP client)
- node-cache (caching)

**Wait for installation to complete** (takes 1-2 minutes)

---

## 🎯 STEP 3: Start the Server

In the same terminal:

```bash
npm start
```

You should see:
```
🚀 Bank Nifty Tracker Server running on http://localhost:3000
📊 API available at http://localhost:3000/api/stocks
```

**Keep this terminal window open!**

---

## 🎯 STEP 4: Open in Browser

1. Open your web browser (Chrome, Firefox, Safari)
2. Go to: `http://localhost:3000`
3. You should see the Bank Nifty Tracker interface

---

## 🎯 STEP 5: Test the Application

### Check if data is loading

You should see:
- 🟢 Market Open/🔴 Market Closed status
- Table with 14 bank stocks
- Live prices for each stock
- Multiplier input boxes
- Calculated values

### Test Multiplier Feature

1. Find any stock (e.g., HDFC Bank)
2. In the "Multiplier" column, change `1` to `10`
3. See "Calculated Value" update automatically
4. Try different numbers

### Test Auto-refresh

- Click "🔄 Refresh Data" button
- Wait for data to update
- During market hours (9:15 AM - 3:30 PM IST), it auto-refreshes every 2 minutes

---

## 🧪 STEP 6: Run System Test (Optional)

To verify everything is working:

1. **Open a NEW terminal window** (keep server running in first one)
2. Navigate to project folder again
3. Run test:

```bash
node test.js
```

Expected output:
```
✅ Yahoo Finance API - SUCCESS
✅ Local Server - RUNNING
🎉 All tests passed!
```

---

## 📊 Understanding the Interface

### Header Section
- **Market Status**: Shows if NSE is open or closed
- **Last Updated**: Time of last data refresh
- **Refresh Button**: Manually refresh data

### Table Columns

1. **#** - Serial number
2. **Company** - Bank name and stock symbol
3. **Day Before Close** - Closing price from 2 days ago
4. **Previous Close** - Yesterday's closing price
5. **Live Price** - Current market price (or last close if market closed)
6. **Multiplier** - Your input number (default: 1)
7. **Calculated Value** - Live Price × Multiplier

### Color Indicators

- 🟢 **Green price**: Stock went up from previous close
- 🔴 **Red price**: Stock went down from previous close
- ⚫ **Black price**: No change

---

## 💡 Use Cases & Examples

### Example 1: Equal Investment Strategy
**Goal:** Invest ₹1,000 in each stock

**Steps:**
1. Set multiplier = `1` for all stocks
2. Note down each "Calculated Value"
3. These are individual stock prices
4. Multiply each by (1000 / stock price) to get number of shares

### Example 2: Weighted Investment
**Goal:** Invest more in some banks than others

**Steps:**
1. HDFC Bank: Set multiplier = `10` (₹16,600 investment)
2. SBI: Set multiplier = `20` (₹15,200 investment)
3. Others: Set multiplier = `5` (varies)
4. See total calculated values

### Example 3: Price Comparison
**Goal:** Find best time to buy

**Steps:**
1. Check "Day Before Close" vs "Previous Close"
2. Check "Previous Close" vs "Live Price"
3. Identify trends (going up/down)
4. Make informed decision

---

## 🛠️ Customization Guide

### Change Auto-refresh Time

**File:** `public/index.html`  
**Line:** ~390

```javascript
}, 120000); // 120000 = 2 minutes
```

Change to:
- 60000 = 1 minute
- 300000 = 5 minutes
- 600000 = 10 minutes

### Change Server Port

**File:** `server.js`  
**Line:** ~150

```javascript
const PORT = process.env.PORT || 3000;
```

Change `3000` to any port (e.g., `8080`, `5000`)

### Add More Stocks

**File:** `server.js`  
**Lines:** 10-23

Add to the array:
```javascript
{ symbol: 'TCS', name: 'Tata Consultancy Services' },
{ symbol: 'INFY', name: 'Infosys' },
```

**Note:** Use NSE stock symbols without `.NS` suffix

---

## 🐛 Common Issues & Fixes

### Issue 1: "npm: command not found"
**Fix:** Install Node.js from https://nodejs.org/

### Issue 2: Port 3000 already in use
**Fix 1:** Kill existing process
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <number> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

**Fix 2:** Change port in `server.js`

### Issue 3: No data showing
**Checks:**
1. Is server running? (check terminal)
2. Is internet working?
3. Open browser console (F12) - any errors?
4. Try: http://localhost:3000/api/stocks directly

### Issue 4: "Cannot GET /"
**Fix:** Server not running. Run `npm start`

### Issue 5: CORS errors
**Fix:** Already handled in code. Don't call Yahoo Finance from browser directly.

### Issue 6: Multiplier not saving
**Fix:** 
1. Check if localStorage is enabled in browser
2. Try different browser
3. Clear cookies/cache

---

## 📱 Accessing from Phone (Same Network)

1. Find your computer's IP address:

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (e.g., 192.168.1.100)

**Mac/Linux:**
```bash
ifconfig | grep inet
```

2. On your phone, open browser
3. Go to: `http://YOUR_IP:3000`
   Example: `http://192.168.1.100:3000`

**Note:** Computer and phone must be on same WiFi

---

## 🎓 Learning Resources

### Understanding the Code

**Backend (server.js):**
- Express.js framework
- REST API creation
- Axios for HTTP requests
- Caching mechanism

**Frontend (index.html):**
- Vanilla JavaScript
- DOM manipulation
- Fetch API
- localStorage

### Want to Learn More?

**JavaScript:**
- MDN Web Docs: https://developer.mozilla.org/
- JavaScript.info: https://javascript.info/

**Node.js:**
- Node.js Documentation: https://nodejs.org/docs/
- W3Schools Node: https://www.w3schools.com/nodejs/

**APIs:**
- REST API Tutorial: https://restfulapi.net/
- HTTP Methods: https://www.restapitutorial.com/

---

## 🚀 Next Steps

### Immediate Next Steps
1. ✅ Get it running
2. ✅ Test all features
3. ✅ Customize multipliers
4. ✅ Save your settings

### Future Enhancements (Week 2)
- Add price change percentage
- Add total portfolio value
- Export data to CSV
- Add more banks/stocks

### Advanced (Month 2)
- User login system
- Database for history
- Charts and graphs
- Mobile app version

---

## 📞 Getting Help

### In Code Files
- All files have comments explaining what each part does
- Read comments starting with `//`

### Documentation
- README.md has complete documentation
- test.js shows how API works

### Common Commands
```bash
npm start          # Start server
npm install        # Install dependencies
node test.js       # Run tests
ctrl + C           # Stop server
```

---

## ✅ Quick Checklist

Before asking for help, verify:

- [ ] Node.js is installed (`node --version` works)
- [ ] Dependencies installed (`npm install` completed)
- [ ] Server is running (`npm start` executed)
- [ ] Terminal shows no errors
- [ ] Browser opened to `http://localhost:3000`
- [ ] Internet connection is working
- [ ] Tried refreshing browser (Ctrl+F5)

---

## 🎉 Success Indicators

You know it's working when:

✅ Server starts without errors  
✅ Browser shows the table  
✅ Stock names are visible  
✅ Prices show with ₹ symbol  
✅ Multiplier inputs work  
✅ Calculated values update  
✅ Refresh button works  
✅ Market status shows correctly  

---

**Congratulations! You've successfully set up the Bank Nifty Tracker! 🎊**

Happy tracking and investing! 📈

---

**Need Help?**
- Re-read this guide
- Check README.md for more details
- Review code comments in files
- Test with test.js script
