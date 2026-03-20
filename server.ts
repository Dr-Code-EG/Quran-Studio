import express from "express";
import cors from "cors";
import path from "path";
import axios from "axios";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Add headers for FFmpeg WASM compatibility (COOP/COEP)
app.use((req, res, next) => {
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  next();
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * Fetch Quranic verses with translations and audio URLs.
 * Handles pagination automatically.
 */
app.get("/api/verse-preview", async (req, res) => {
  const { surahId, verseFrom, verseTo, reciterId } = req.query;
  
  if (!surahId) {
    return res.status(400).json({ error: "surahId is required" });
  }

  const sId = parseInt(surahId as string);
  const vFrom = parseInt(verseFrom as string) || 1;
  const vTo = parseInt(verseTo as string) || vFrom;
  const rId = reciterId || 7; // Default to Mishary Rashid Alafasy

  console.log(`[API] Verse preview request: Surah ${sId}, From ${vFrom}, To ${vTo}, Reciter ${rId}`);
  
  try {
    const perPage = 50;
    const startPage = Math.floor((vFrom - 1) / perPage) + 1;
    const endPage = Math.floor((vTo - 1) / perPage) + 1;

    // 1. Fetch verses with translations
    const verseUrl = `https://api.quran.com/api/v4/verses/by_chapter/${sId}`;
    console.log(`[API] Fetching from: ${verseUrl}`);
    const versePromises = [];
    for (let p = startPage; p <= endPage; p++) {
      versePromises.push(axios.get(verseUrl, {
        params: {
          language: "en",
          words: false,
          translations: 131, // Clear Quran translation
          fields: "text_uthmani",
          page: p,
          per_page: perPage
        }
      }).catch(err => {
        console.error(`[API] Verse fetch error for page ${p}:`, err.message);
        throw err;
      }));
    }

    const verseResponses = await Promise.all(versePromises);
    let allVerses: any[] = [];
    verseResponses.forEach(r => {
      if (r.data.verses) {
        allVerses = allVerses.concat(r.data.verses);
      }
    });

    // Filter verses by the requested range
    const verses = allVerses.filter((v: any) => {
      const vNum = parseInt(v.verse_key.split(':')[1]);
      return vNum >= vFrom && vNum <= vTo;
    });

    if (verses.length === 0) {
      return res.status(404).json({ error: `No verses found for Surah ${sId} in range ${vFrom}-${vTo}` });
    }

    // 2. Fetch audio files
    const audioUrl = `https://api.quran.com/api/v4/recitations/${rId}/by_chapter/${sId}`;
    const audioPromises = [];
    for (let p = startPage; p <= endPage; p++) {
      audioPromises.push(axios.get(audioUrl, {
        params: {
          page: p,
          per_page: perPage
        }
      }));
    }

    const audioResponses = await Promise.all(audioPromises);
    let allAudioFiles: any[] = [];
    audioResponses.forEach(r => {
      if (r.data.audio_files) {
        allAudioFiles = allAudioFiles.concat(r.data.audio_files);
      }
    });
    
    // 3. Combine results
    const result = verses.map((v: any) => {
      const audio = allAudioFiles.find((a: any) => a.verse_key === v.verse_key);
      let audioUrl = null;
      if (audio) {
        audioUrl = audio.url.startsWith('http') ? audio.url : `https://download.quranicaudio.com/quran/${audio.url}`;
      }
      
      return {
        verse_key: v.verse_key,
        text: v.text_uthmani,
        translation: (v.translations && v.translations[0]?.text) 
          ? v.translations[0].text.replace(/<(?:.|\n)*?>/gm, '') // Strip HTML tags
          : '',
        audioUrl
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("[API] Error fetching verses:", error.message);
    if (error.response) {
      console.error("[API] Error response data:", error.response.data);
    }
    res.status(500).json({ error: "Failed to fetch verses: " + (error.response?.data?.error || error.message) });
  }
});

// Server setup
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;

