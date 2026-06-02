# MGM Assist

MGM Assist (Montgomery Government and Management Assistant) is a civic intelligence dashboard for Montgomery, Alabama. It combines structured dashboards, AI-assisted summarization, and automated web data collection to provide residents and stakeholders with updated local insights.

[Live Demo](https://mgm-assist-946m.vercel.app/) • [Repository](https://github.com/francisnatusm/MGM-Assist)

## What It Does

- Aggregates civic updates into the `Montgomery Pulse` feed.
- Shows business, careers, and economy dashboard cards from Firestore-backed data.
- Renders an interactive economy map with 3D-tilted map visualization.
- Supports manual and scheduled refresh pipelines for dashboard datasets.
- Ships as a PWA-capable frontend.

## Bright Data Usage

This project uses Bright Data in two places:

- `mcp-server-brightdata.js` for direct MCP-based web access.
- `server.js` MCP integration flow for scraping/processing content used in dashboard refresh tasks.

Bright Data is part of the data collection pipeline that powers periodic updates.

## Tech Stack

- Backend: `Node.js`, `Express`, `Firebase Admin`, `Firestore`, `node-cron`
- AI/Data tooling: `Anthropic API`, `Bright Data MCP`
- Frontend: `React`, `Vite`, `Tailwind CSS`, `MapLibre`, `Recharts`
- Deployment: `Vercel`

## Project Structure

```text
MGM-Assist/
  api/                        # Vercel serverless entry
  frontend/                   # React app
    src/components/           # Dashboard UI components
  scripts/                    # Utility scripts (including Vercel env sync helper)
  server.js                   # Main API + dashboard refresh logic
  mcp-server-brightdata.js    # Bright Data MCP server integration
  vercel.json                 # Vercel config
```

## Environment Variables

Create a root `.env.local` (or configure equivalent variables in Vercel):

```env
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=./firebase-service-account.json

USAJOBS_API_KEY=
USAJOBS_EMAIL=

BRIGHTDATA_API_TOKEN=
ANTHROPIC_API_KEY=
```

For frontend local development (`frontend/.env`):

```env
VITE_API_BASE_URL=http://localhost:3003
```

## Local Development

1. Install backend dependencies:
   - `npm install`
2. Install frontend dependencies:
   - `cd frontend && npm install`
3. Run backend:
   - `npm run dev`
4. Run frontend in a second terminal:
   - `cd frontend && npm run dev`
5. Open:
   - `http://localhost:5173`

## Deployment (Vercel)

1. Push `main` to GitHub.
2. Import project in Vercel.
3. Set required environment variables (especially `FIREBASE_SERVICE_ACCOUNT_JSON`).
4. Deploy.
5. Verify:
   - `GET /api/health` should return `firebaseConfigured: true` and `firestoreOk: true`.

## Main API Endpoints

- `GET /api/health`
- `GET /api/dashboard/careers`
- `GET /api/dashboard/business`
- `GET /api/dashboard/economy`
- `GET /api/montgomery-pulse?page=1&category=all`
- `POST /api/dashboard/refresh/:dashboard`

## Notes for Reviewers / Mentors

- The app is focused on practical civic data delivery for Montgomery.
- Bright Data integration is present and used as part of the scraping/MCP workflow.
- If the UI shows "Failed to fetch ... data", check deployment env vars and `/api/health` first.

## License

ISC. See `LICENSE`.
