# Quran Studio — استوديو القرآن الكريم

Create professional Quranic recitation videos for social media (TikTok, Instagram Reels, YouTube Shorts).

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Steps
1. Unzip the project folder
2. Run `npm install`
3. Push to a GitHub repository
4. Import the repository in [vercel.com](https://vercel.com) → **Add New Project**
5. Set Framework: **Vite**
6. Build command: `npm run build`
7. Output directory: `dist`
8. Click **Deploy** ✓

No environment variables required — the app uses the free Quran.com public API.

## Local Development

```bash
npm install
npm run dev
# API functions: available at /api/* via Vercel CLI (vercel dev)
```

To also test the API locally, install Vercel CLI:
```bash
npm install -g vercel
vercel dev
```

## Features

- 🕌 **114 Surahs** — Full Quran with Arabic text, translations, and verse selection
- 🎙️ **10 Reciters** — Mishary Afasy, AbdulBaset, Al-Husary, and more
- 📐 **3 Video Formats** — 9:16 (TikTok/Reels), 16:9 (YouTube), 1:1 (Instagram)
- ✨ **Visual Effects** — Overlay effects, blur, brightness controls
- 🔤 **Typography** — Font size, color, and text position controls
- 🏷️ **Social Branding** — Watermark with your handle for Instagram/TikTok/YouTube
- 📚 **Job Library** — Track all video generation jobs with real-time progress

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS
- **Routing**: React Router v6
- **Data Fetching**: TanStack Query v5
- **API**: Vercel Serverless Functions (Node.js)
- **Data Source**: [Quran.com API v4](https://quran.com/api) (free, no key required)
- **Video**: FFmpeg (must be installed on server for full video rendering)

## Project Structure

```
quran-studio-vercel/
├── api/
│   ├── quran/
│   │   ├── surahs.js       # GET all 114 surahs
│   │   ├── verses.js       # GET verses with audio URLs
│   │   └── reciters.js     # GET reciter list
│   └── jobs/
│       ├── _store.js       # In-memory job store
│       ├── index.js        # GET all jobs / POST create job
│       └── [id].js         # GET job / DELETE job
├── src/
│   ├── context/
│   │   └── StudioContext.tsx  # Global studio settings state
│   ├── pages/
│   │   ├── StudioPage.tsx     # Main video config screen
│   │   ├── LibraryPage.tsx    # Job list
│   │   ├── JobDetailPage.tsx  # Real-time job tracking
│   │   ├── SurahPickerPage.tsx
│   │   ├── ReciterPickerPage.tsx
│   │   └── SettingsPage.tsx
│   └── components/
│       └── Layout.tsx         # Tab navigation
├── vercel.json             # Routing config
├── vite.config.ts
└── tailwind.config.js
```
