# 🚀 Deploy to Cyclic - Step by Step

## ✅ Your code is ready! Now follow these steps:

## Step 1: Create a GitHub Repository

1. **Go to GitHub.com** and sign in (or create account if needed)
2. Click the **"+"** button in top right → **"New repository"**
3. Fill in:
   - Repository name: `bank-nifty-tracker`
   - Description: "Bank Nifty 14 Stock Tracker with Live Prices"
   - Keep it **Public** (required for free Cyclic deployment)
   - DON'T initialize with README (we already have one)
4. Click **"Create repository"**

## Step 2: Push Your Code to GitHub

Copy and run these commands in your terminal:

```bash
# Add your GitHub repository as remote (replace YOUR_GITHUB_USERNAME)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/bank-nifty-tracker.git

# Push your code
git branch -M main
git push -u origin main
```

**Example:**
```bash
git remote add origin https://github.com/takshshah/bank-nifty-tracker.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Cyclic

1. **Go to https://cyclic.sh**

2. Click **"Sign in"** → Use **GitHub** to sign in

3. Click **"Deploy"** or **"Link Your Own"**

4. You'll see your repositories - select **`bank-nifty-tracker`**

5. Click **"Connect"** and then **"Approve & Install"**

6. Cyclic will automatically:
   - Detect Node.js app ✅
   - Install dependencies ✅
   - Deploy your app ✅

7. **Wait 1-2 minutes** for deployment

8. You'll get your URL: `https://[your-app-name].cyclic.app`

## 🎉 That's it! Your app is live!

---

## 📝 Post-Deployment Checklist

### Test Your Live App:
- [ ] Visit your Cyclic URL
- [ ] Check if Bank Nifty index loads
- [ ] Verify all 14 stocks show data
- [ ] Test changing multipliers
- [ ] Confirm multipliers persist after refresh

### If Something Doesn't Work:

1. **Check Logs in Cyclic:**
   - Go to Cyclic dashboard
   - Click on your app
   - Click "Logs" tab
   - Look for any errors

2. **Common Issues:**

   **Problem:** No stock data showing
   **Solution:** Yahoo Finance API might be blocked. Try refreshing.

   **Problem:** Multipliers not saving
   **Solution:** Check if `multipliers.json` is being created in logs

   **Problem:** App not loading
   **Solution:** Check if all dependencies are in package.json

---

## 🔧 Environment Variables (Optional)

If you need to set environment variables in Cyclic:

1. Go to your app in Cyclic dashboard
2. Click **"Variables"** tab
3. Add variables like:
   - `NODE_ENV` = `production`
   - Any API keys if needed

---

## 🌟 Your App Features on Cyclic:

✅ **Always Online** - No cold starts
✅ **Free SSL** - https:// automatically
✅ **Auto Deploy** - Push to GitHub = Auto update
✅ **Persistent Storage** - multipliers.json saved
✅ **100,000 requests/month** - Plenty for personal use
✅ **Global CDN** - Fast worldwide

---

## 📱 Share Your App:

Once deployed, you can share your URL with others:
- Send the Cyclic URL to friends
- They'll see the same multipliers (shared)
- Works on mobile too!

---

## 🚀 Quick Commands Reference:

```bash
# Check git status
git status

# Add all changes
git add .

# Commit changes
git commit -m "Update message"

# Push to GitHub (auto-deploys to Cyclic)
git push
```

---

## 💡 Future Updates:

When you make changes:
1. Edit your files locally
2. `git add .`
3. `git commit -m "Description of changes"`
4. `git push`
5. Cyclic auto-deploys in ~1 minute!

---

## Need Help?

- **Cyclic Docs:** https://docs.cyclic.sh
- **Cyclic Discord:** https://discord.gg/cyclic
- **GitHub Issues:** Create issue in your repo

---

**Congratulations! Your Bank Nifty Tracker is going live! 🎊**