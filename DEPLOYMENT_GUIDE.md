# 🚀 Deployment Guide - Bank Nifty Tracker

## Free Hosting Options

### 1. **Render** (Recommended) ✅
**Best for:** Full Node.js apps with persistent storage
- **Free Tier:** 750 hours/month, auto-sleeps after inactivity
- **Pros:** Easy deployment, supports Node.js, free SSL, persistent disk
- **Cons:** Spins down after 15 mins inactivity (takes 30s to wake up)

#### Deployment Steps:
1. Create account at https://render.com
2. Connect your GitHub repository
3. Choose "Web Service"
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Deploy!

---

### 2. **Railway** 🚂
**Best for:** Quick deployment with good free tier
- **Free Tier:** $5 free credit/month (usually enough for small apps)
- **Pros:** Super easy, no sleep, persistent storage
- **Cons:** Limited free credits

#### Deployment Steps:
1. Visit https://railway.app
2. Click "Deploy Now"
3. Choose "Deploy from GitHub repo"
4. Select repository
5. Railway auto-detects Node.js and deploys

---

### 3. **Vercel** ⚡
**Best for:** Frontend with serverless functions
- **Free Tier:** Unlimited for personal use
- **Pros:** Fast, global CDN, great for static sites
- **Cons:** Need to convert to serverless functions

#### Deployment Steps:
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in project directory
3. Follow prompts
4. Your app is live!

**Note:** Requires converting Express to serverless functions

---

### 4. **Netlify** 🔷
**Best for:** Static sites with serverless functions
- **Free Tier:** Generous limits
- **Pros:** Easy deployment, great for frontend
- **Cons:** Need to restructure as serverless

---

### 5. **Fly.io** 🪁
**Best for:** Global deployment with good free tier
- **Free Tier:** 3 shared VMs, 3GB persistent storage
- **Pros:** Global deployment, persistent storage
- **Cons:** Requires credit card (no charge for free tier)

#### Deployment Steps:
1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Run `fly launch` in project
3. Follow configuration prompts
4. Deploy with `fly deploy`

---

### 6. **Glitch** 🎏
**Best for:** Quick prototypes and learning
- **Free Tier:** Always free with limits
- **Pros:** Online editor, instant deployment
- **Cons:** Apps sleep after 5 mins, limited resources

#### Deployment Steps:
1. Visit https://glitch.com
2. New Project → Import from GitHub
3. Paste your repo URL
4. App auto-deploys

---

### 7. **Cyclic** 🔄
**Best for:** Node.js apps with AWS backing
- **Free Tier:** 100,000 requests/month
- **Pros:** No sleep, AWS infrastructure
- **Cons:** Limited compute time

#### Deployment Steps:
1. Visit https://cyclic.sh
2. Connect GitHub
3. Select repository
4. Deploy automatically

---

### 8. **Replit** 💻
**Best for:** Development and sharing
- **Free Tier:** Basic hosting with limits
- **Pros:** Online IDE, easy sharing
- **Cons:** Sleeps quickly, limited resources

---

## 📝 Pre-Deployment Checklist

### 1. **Update package.json**
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
```

### 2. **Environment Variables**
Create a `.env` file:
```env
PORT=3000
NODE_ENV=production
```

### 3. **Update server.js for production**
```javascript
const PORT = process.env.PORT || 3000;
```

### 4. **Handle CORS for production**
```javascript
app.use(cors({
  origin: process.env.CLIENT_URL || '*'
}));
```

---

## 🔧 Quick Deployment Scripts

### For Render
Create `render.yaml`:
```yaml
services:
  - type: web
    name: bank-nifty-tracker
    env: node
    buildCommand: npm install
    startCommand: npm start
```

### For Railway
Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start"
  }
}
```

### For Vercel
Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

---

## 🌟 Recommended Free Stack

### For Your Bank Nifty Tracker:

1. **Best Overall:** **Railway**
   - Easy deployment
   - Persistent storage for multipliers.json
   - $5 free credit usually sufficient
   - No sleep issues

2. **Best Truly Free:** **Render**
   - Completely free
   - Supports persistent disk
   - Only downside: 30s wake time after inactivity

3. **Fastest Setup:** **Cyclic**
   - One-click deploy
   - No sleep
   - Good for this project size

---

## 🚀 Quick Start with Render (Recommended)

### Step 1: Prepare Your Code
```bash
# Create a git repository if not already
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git remote add origin YOUR_GITHUB_URL
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to https://render.com
2. Sign up with GitHub
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - Name: `bank-nifty-tracker`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Click "Create Web Service"
7. Wait for deployment (takes 2-5 minutes)
8. Your app is live at `https://bank-nifty-tracker.onrender.com`

### Step 3: Add Persistent Disk (for multipliers.json)
1. In Render dashboard, go to your service
2. Click "Disks" tab
3. Add disk:
   - Name: `data`
   - Mount Path: `/opt/render/project/src`
   - Size: 1GB (free tier)

### Step 4: Update Environment Variables
1. Go to "Environment" tab
2. Add:
   - `NODE_ENV` = `production`
   - Any other required variables

---

## 📱 Post-Deployment

### Test Your Deployment:
1. Visit your URL
2. Check if stock data loads
3. Test multiplier saving
4. Verify auto-refresh works

### Monitor:
- Check logs in hosting dashboard
- Monitor API response times
- Set up uptime monitoring (UptimeRobot - free)

### Custom Domain (Optional):
Most platforms support custom domains:
1. Buy domain (Namecheap, GoDaddy)
2. Add CNAME record pointing to your app
3. Configure in hosting platform

---

## 🆘 Troubleshooting

### Common Issues:

**1. App not starting:**
- Check `package.json` has correct start script
- Verify all dependencies are listed
- Check logs for errors

**2. Multipliers not saving:**
- Ensure persistent storage is configured
- Check file permissions
- Verify API endpoints are accessible

**3. CORS errors:**
- Update CORS configuration for production URL
- Add your domain to allowed origins

**4. Slow performance:**
- Implement caching strategies
- Consider upgrading to paid tier
- Use CDN for static assets

---

## 💡 Pro Tips

1. **Use GitHub Actions for CI/CD:**
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
```

2. **Add Health Monitoring:**
- Use UptimeRobot (free)
- Set up health check endpoint
- Get alerts if site goes down

3. **Optimize for Production:**
- Minify JavaScript
- Enable gzip compression
- Use production Node.js settings

4. **Backup Data:**
- Regularly backup multipliers.json
- Consider using cloud storage
- Implement data export feature

---

## 📊 Hosting Comparison Table

| Platform | Sleep Time | Storage | Bandwidth | Build Time | Best For |
|----------|------------|---------|-----------|------------|----------|
| Render | 15 min | 1GB | 100GB | 400 hrs | Full apps |
| Railway | Never | 1GB | Unlimited | $5 credit | Production |
| Vercel | Never | - | 100GB | Unlimited | Frontend |
| Cyclic | Never | 1GB | 100k req | Unlimited | Simple APIs |
| Fly.io | Never | 3GB | Unlimited | Generous | Global apps |
| Glitch | 5 min | 200MB | 4000 req/hr | Unlimited | Prototypes |

---

## 🎯 My Recommendation

For the Bank Nifty Tracker, I recommend:

### Start with **Render**:
✅ Completely free
✅ Supports your Node.js + Express setup
✅ Persistent storage for multipliers
✅ Easy GitHub integration
✅ Free SSL certificate

Once you have users and need better performance, consider upgrading to Railway or Render's paid tier ($7/month).

---

**Happy Deploying! 🚀**

If you need help with any specific platform, just ask!