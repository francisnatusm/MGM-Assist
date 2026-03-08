# 🚀 Quick Start Guide - Real-Time Dashboards

## ⚡ TL;DR (5-Minute Setup)

1. **Create Firebase Project**: https://console.firebase.google.com/
2. **Enable Firestore Database** (production mode)
3. **Download Service Account Key** → Save as `firebase-service-account.json` in project root
4. **Restart Server**: `npm run dev`
5. **Visit**: http://localhost:5173

---

## 📋 Quick Commands

### Start the System
```powershell
# Backend (from project root)
npm run dev

# Frontend (new terminal)
cd frontend
npm run dev
```

### Manual Dashboard Refresh
```powershell
# Trigger individual dashboards
Invoke-RestMethod -Uri http://localhost:3003/api/dashboard/refresh/careers -Method Post
Invoke-RestMethod -Uri http://localhost:3003/api/dashboard/refresh/business -Method Post
Invoke-RestMethod -Uri http://localhost:3003/api/dashboard/refresh/economy -Method Post
Invoke-RestMethod -Uri http://localhost:3003/api/dashboard/refresh/opportunities -Method Post
```

### Check Dashboard Data (API)
```powershell
# View data directly
Invoke-RestMethod http://localhost:3003/api/dashboard/careers
Invoke-RestMethod http://localhost:3003/api/dashboard/business
Invoke-RestMethod http://localhost:3003/api/dashboard/economy
Invoke-RestMethod http://localhost:3003/api/dashboard/opportunities
```

---

## 🔧 Cron Schedule

| Dashboard | Frequency | Cron Expression | When |
|-----------|-----------|-----------------|------|
| Capital City Careers | Every 6 hours | `0 */6 * * *` | 12AM, 6AM, 12PM, 6PM |
| Business Signals | Daily | `0 0 * * *` | Midnight |
| Neighborhood Economy | Monthly | `0 0 1 * *` | 1st of month, midnight |
| Opportunity Finder | Daily | `0 2 * * *` | 2 AM |

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| `server.js` | Backend with cron jobs & API endpoints |
| `.env` | Environment variables (Firebase config) |
| `firebase-service-account.json` | **You create this** (from Firebase Console) |
| `FIREBASE_SETUP.md` | Complete setup instructions |
| `REALTIME_DASHBOARD_SUMMARY.md` | Full technical documentation |

---

## ✅ Success Indicators

**Backend Running:**
```
🤖 Server running on http://localhost:3003
💬 Chatbot is ready!
🔥 Firebase Admin initialized
✅ Connected to Bright Data MCP (or local MCP)
```

**Dashboards Working:**
- No "Loading..." stuck on screen
- Numbers update when you click refresh (🔄)
- Browser console has no errors
- Firestore shows `dashboards` collection with documents

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Firebase not configured" | Add service account JSON, check `.env` path |
| Empty dashboards | Trigger manual refresh or wait for cron |
| CORS errors | Check backend is on port 3003 |
| Cron not running | Check server logs for errors |

---

## 🎯 Next Steps

1. ✅ **Set up Firebase** → [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
2. ✅ **Test manual refresh** → Use commands above
3. ✅ **Verify Firestore** → Check Firebase Console
4. ✅ **Monitor logs** → Watch server terminal for cron execution

---

**Need detailed docs?** See [REALTIME_DASHBOARD_SUMMARY.md](./REALTIME_DASHBOARD_SUMMARY.md)
