# Firebase & Real-Time Dashboard Setup Guide

This guide will help you set up Firebase Firestore to enable real-time data for your dashboards.

## 🔥 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name your project (e.g., "Montgomery Chatbot")
4. Follow the setup wizard (you can disable Google Analytics if not needed)

## 📊 Step 2: Enable Firestore Database

1. In your Firebase project, click on **"Firestore Database"** in the left sidebar
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll configure rules next)
4. Select your preferred location (e.g., `us-central`)
5. Click **"Enable"**

## 🔐 Step 3: Set Up Security Rules

In the Firestore "Rules" tab, paste these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow server-side writes (via Firebase Admin SDK)
    match /dashboards/{document=**} {
      allow read: if true;  // Anyone can read dashboard data
      allow write: if false; // Only server can write (via Admin SDK)
    }
  }
}
```

Click **"Publish"** to save the rules.

## 🔑 Step 4: Generate Service Account Key

1. Go to **Project Settings** (gear icon in left sidebar)
2. Navigate to the **"Service accounts"** tab
3. Click **"Generate new private key"**
4. Download the JSON file
5. **IMPORTANT**: Save it securely as `firebase-service-account.json` in your project root
6. **DO NOT** commit this file to Git (it's already in .gitignore)

## ⚙️ Step 5: Configure Environment Variables

Create or update your `.env` file in the project root:

```env
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase-service-account.json

# Bright Data MCP (Optional - for advanced scraping)
BRIGHTDATA_API_TOKEN=your_brightdata_token_here

# Claude API Key (Get from https://console.anthropic.com/)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## 🗄️ Step 6: Firestore Collections Structure

The server will automatically create these collections when cron jobs run:

```
dashboards/
  ├── capitalCityCareers
  │   ├── jobs: Array
  │   ├── totalCount: Number
  │   ├── topIndustry: String
  │   └── lastUpdated: Timestamp
  │
  ├── businessSignals
  │   ├── newBusinesses: Number
  │   ├── closedBusinesses: Number
  │   ├── hotNeighborhoods: Array
  │   └── lastUpdated: Timestamp
  │
  ├── neighborhoodEconomy
  │   ├── neighborhoods: Array
  │   └── lastUpdated: Timestamp
  │
  └── opportunityFinder
      ├── grants: Array
      ├── training: Array
      ├── fairs: Array
      └── lastUpdated: Timestamp
```

## 🚀 Step 7: Start the Server

```bash
# Make sure you're in the project root
npm install

# Start the server (includes cron jobs)
npm run dev
```

The server will:
- Initialize Firebase on startup
- Schedule cron jobs:
  - **Capital City Careers**: Every 6 hours
  - **Business Signals**: Daily at midnight
  - **Neighborhood Economy**: Monthly (1st of month)
  - **Opportunity Finder**: Daily at 2 AM

## 🧪 Step 8: Manual Testing

You can manually trigger dashboard updates for testing:

```bash
# Test Capital City Careers scraping
curl -X POST http://localhost:3003/api/dashboard/refresh/careers

# Test Business Signals
curl -X POST http://localhost:3003/api/dashboard/refresh/business

# Test Neighborhood Economy
curl -X POST http://localhost:3003/api/dashboard/refresh/economy

# Test Opportunity Finder
curl -X POST http://localhost:3003/api/dashboard/refresh/opportunities
```

Or use PowerShell:
```powershell
Invoke-RestMethod -Uri http://localhost:3003/api/dashboard/refresh/careers -Method Post
```

## 📱 Step 9: Verify Dashboards Are Live

1. Start the frontend: `cd frontend && npm run dev`
2. Open `http://localhost:5173` in your browser
3. You should see the dashboards loading real data
4. Each dashboard has a refresh icon (🔄) to manually fetch latest data

## 🔍 Monitoring & Debugging

### Check Server Logs
The server logs will show:
- `🔥 Firebase Admin initialized` - Firebase is connected
- `✅ Capital City Careers updated: X jobs saved` - Cron jobs running
- `❌ Error messages` - If something goes wrong

### Check Firestore Console
You can view your data directly in the Firebase Console:
1. Go to Firestore Database
2. You should see a `dashboards` collection
3. Click to view the documents

### Common Issues

**"Firebase not configured" error:**
- Check that `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` points to the correct file
- Verify the JSON file is valid

**Empty dashboards:**
- Wait for cron jobs to run (or trigger manually)
- Check server logs for errors
- Verify Firestore security rules allow reads

**CORS errors:**
- Make sure backend is running on port 3003
- Check that frontend is fetching from `http://localhost:3003`

## 🎯 Success Criteria

You'll know it's working when:
1. ✅ Server starts without Firebase errors
2. ✅ Firestore Console shows `dashboards` collection with data
3. ✅ Frontend dashboards display real numbers (not mock data)
4. ✅ Refresh buttons update the data
5. ✅ "Last Updated" timestamps are recent

## 🔒 Security Best Practices

- ✅ `firebase-service-account.json` is in `.gitignore`
- ✅ Never commit API keys to Git
- ✅ Use environment variables for all secrets
- ✅ Firestore rules prevent unauthorized writes
- ✅ Keep your service account key secure

## 📚 Next Steps

Once dashboards are live, you can:
- Customize scraping sources in `server.js`
- Adjust cron schedules
- Add more dashboard components
- Integrate additional data sources
- Deploy to production (Vercel, Heroku, etc.)

---

**Need help?** Check the server logs or Firestore Console for detailed error messages.
