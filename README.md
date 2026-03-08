# MGM Assist 🏛️

**Montgomery Government & Management Assistant** - A real-time civic intelligence dashboard for Montgomery, Alabama, powered by AI and automated web scraping.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://mgm-assist.vercel.app)
[![GitHub](https://img.shields.io/badge/github-repo-blue)](https://github.com/francisnatusm/MGM-Assist)
[![License](https://img.shields.io/badge/license-ISC-green)](LICENSE)

## 📋 Overview

MGM Assist is an intelligent civic engagement platform that provides Montgomery, Alabama residents and stakeholders with real-time insights into:

- **Government Updates** - Live civic news from official Montgomery.gov sources
- **Economic Indicators** - Interactive maps showing neighborhood economic data
- **Business Intelligence** - Trending business sectors and opportunities
- **Career Opportunities** - Real-time job postings from Montgomery employers

The system automatically scrapes, processes, and displays data every 6 hours, ensuring users always have access to the latest information.

---

## ✨ Features

### 🗺️ **Interactive Economy Map**
- Real-time Leaflet-powered map of Montgomery, AL
- Neighborhood pins showing:
  - Unemployment rates
  - Average income levels
  - Poverty statistics
- Pan, zoom, and click for detailed data
- Monthly census data updates

### 📡 **Montgomery Pulse (Live Civic Feed)**
- Automated scraping of 5 Montgomery.gov URLs every 6 hours
- AI-powered content summarization (with fallback extraction)
- Category filtering: Council, Mayor, Deadlines, Ordinances, Meetings
- Real-time notifications on new civic updates
- Pagination support for browsing historical updates

### 💼 **Business Signals Dashboard**
- Top business sectors in Montgomery
- Growth indicators and trends
- Economic activity tracking
- Business opportunities identification

### 🏢 **Capital City Careers**
- Live job postings from Montgomery area
- Industry categorization
- Salary range information
- Application deadline tracking

---

## 🛠️ Tech Stack

### Backend
- **Node.js** + **Express.js** - API server
- **Firebase Firestore** - Real-time database
- **Claude AI (Anthropic)** - Content processing
- **Bright Data MCP** - Web scraping engine
- **node-cron** - Scheduled tasks (6-hour intervals)
- **CORS** - Cross-origin resource sharing

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool & dev server
- **TailwindCSS** - Styling
- **Leaflet + React-Leaflet** - Interactive maps
- **Lucide React** - Icon library
- **Recharts** - Data visualization

### Deployment
- **Vercel** - Serverless deployment (frontend + backend)
- **GitHub** - Version control

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Firebase project with Firestore enabled
- Bright Data API token (for web scraping)
- Anthropic API key (optional, fallback works without it)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/francisnatusm/MGM-Assist.git
   cd MGM-Assist
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Configure environment variables**
   
   Create `.env` in the root directory:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-... # Optional (fallback works without)
   BRIGHTDATA_API_TOKEN=your_bright_data_token
   FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase-service-account.json
   ```

   Create `frontend/.env`:
   ```env
   VITE_API_BASE_URL=http://localhost:3003
   ```

5. **Add Firebase credentials**
   
   Place your `firebase-service-account.json` in the root directory.

6. **Start development servers**
   ```bash
   # Start backend (port 3003)
   npm run dev
   
   # In another terminal, start frontend (port 5173)
   cd frontend
   npm run dev
   ```

7. **Open your browser**
   ```
   http://localhost:5173
   ```

---

## 📦 Production Deployment

### Deploy to Vercel

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push origin main
   ```

2. **Deploy Backend**
   - Go to [Vercel Dashboard](https://vercel.com)
   - Import your GitHub repository
   - Set environment variables:
     - `ANTHROPIC_API_KEY`
     - `BRIGHTDATA_API_TOKEN`
     - `FIREBASE_SERVICE_ACCOUNT_JSON` (paste entire JSON as string)
   - Deploy

3. **Deploy Frontend**
   - Import the same repository as a new project
   - Set root directory to `frontend`
   - Add environment variable:
     - `VITE_API_BASE_URL=https://your-backend.vercel.app`
   - Deploy

---

## 📂 Project Structure

```
MGM-Assist/
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # Dashboard components
│   │   │   ├── MontgomeryPulse.jsx
│   │   │   ├── NeighborhoodEconomyMap.jsx
│   │   │   ├── BusinessSignals.jsx
│   │   │   └── CapitalCityCareers.jsx
│   │   ├── App.jsx            # Main app component
│   │   └── main.jsx           # Entry point
│   ├── package.json
│   └── vite.config.js
├── server.js                   # Express API server
├── mcp-server-brightdata.js   # Bright Data MCP server
├── firebase-service-account.json
├── .env                        # Backend environment variables
├── package.json
└── README.md
```

---

## 🔌 API Endpoints

### Montgomery Pulse
- `GET /api/montgomery-pulse?page=1&category=all` - Get civic updates
- `POST /api/dashboard/refresh/pulse` - Trigger manual refresh

### Dashboards
- `GET /api/dashboard/economy` - Neighborhood economy data
- `GET /api/dashboard/business` - Business signals data
- `GET /api/dashboard/careers` - Career opportunities

### Admin
- `POST /api/admin/clear-pulse` - Clear all Montgomery Pulse data (maintenance)

---

## 🤖 Automated Tasks

The system runs cron jobs every **6 hours** to:

1. **Scrape Montgomery.gov** - Fetch latest civic updates
2. **Process Content** - Extract text and generate summaries
3. **Update Firebase** - Save new items to Firestore
4. **Clean Old Data** - Remove outdated entries (optional)

Cron schedule: `0 */6 * * *` (runs at 12am, 6am, 12pm, 6pm daily)

---

## 🌐 Data Sources

Montgomery Pulse scrapes these official sources every 6 hours:

1. **Montgomery County Council** - `https://www.montgomerycountymd.gov/council/`
2. **Mayor's Office** - `https://www.montgomerycountymd.gov/exec/`
3. **Public Notices** - `https://www.montgomerycountymd.gov/open/notices.html`
4. **City Ordinances** - `https://www.montgomerycountymd.gov/council/laws-ordinances/`
5. **Meeting Calendar** - `https://www.montgomerycountymd.gov/calendar/`

---

## 🧩 Key Technologies Explained

### **MCP (Model Context Protocol)**
MGM Assist uses Anthropic's MCP to connect the backend to Bright Data's web scraping tools. When Claude AI needs real-time data, it calls MCP tools that fetch live web content.

### **Bright Data**
Enterprise-grade web scraping platform providing:
- IP rotation to avoid blocks
- CAPTCHA handling
- Structured data extraction
- High-speed parallel scraping

### **Firebase Firestore**
NoSQL database storing:
- Montgomery Pulse civic updates
- Dashboard data (economy, business, careers)
- Real-time sync across all clients

### **Leaflet Maps**
Open-source mapping library displaying:
- Montgomery, AL street map
- Interactive markers for neighborhoods
- Economic data overlays

---

## 🐛 Troubleshooting

### **Frontend shows "Failed to fetch"**
- Check `VITE_API_BASE_URL` in `frontend/.env`
- Ensure backend is running on port 3003
- Verify CORS is enabled in server.js

### **NaNd ago** timestamp error
- Update to latest version (fixed in commit 85c6eb3)
- Firestore Timestamps now converted to ISO strings

### **Category filters return errors**
- Fixed with client-side filtering (commit 70258dd)
- No Firebase composite index required

### **Map not displaying**
- Ensure Leaflet CSS imported in `main.jsx`
- Check browser console for errors
- Verify internet connection (map tiles load from OpenStreetMap)

---

## 📝 License

ISC License - See [LICENSE](LICENSE) file for details.

---

## 👥 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🙏 Acknowledgments

- **Anthropic** - Claude AI API
- **Bright Data** - Web scraping infrastructure
- **Firebase** - Real-time database
- **OpenStreetMap** - Map tiles
- **Vercel** - Deployment platform
- **Montgomery County, MD** - Public data sources

---

## 📧 Contact

For questions or support:
- GitHub Issues: [MGM-Assist/issues](https://github.com/francisnatusm/MGM-Assist/issues)
- Live Demo: [mgm-assist.vercel.app](https://mgm-assist.vercel.app)

---

<div align="center">
  Made with ❤️ for Montgomery, Alabama
</div>
