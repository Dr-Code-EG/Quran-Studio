import express from "express";
import cors from "cors";
import path from "path";
import axios from "axios";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: process.env.VERCEL === "1" ? "vercel" : "local"
  });
});

app.get("/api/verse-preview", async (req, res) => {
  const { surahId, verseFrom, verseTo, reciterId } = req.query;
  
  if (!surahId) {
    return res.status(400).json({ error: "surahId is required" });
  }

  const sId = parseInt(surahId as string);
  const vFrom = parseInt(verseFrom as string) || 1;
  const vTo = parseInt(verseTo as string) || vFrom;
  const rId = reciterId || 7;

  console.log(`Verse preview request: Surah ${sId}, From ${vFrom}, To ${vTo}, Reciter ${rId}`);
  
  try {
    const perPage = 50;
    const startPage = Math.floor((vFrom - 1) / perPage) + 1;
    const endPage = Math.floor((vTo - 1) / perPage) + 1;

    console.log(`Fetching pages ${startPage} to ${endPage} for Surah ${sId}`);

    // Fetch verses for the chapter across necessary pages
    const verseUrl = `https://api.quran.com/api/v4/verses/by_chapter/${sId}`;
    const versePromises = [];
    for (let p = startPage; p <= endPage; p++) {
      versePromises.push(axios.get(verseUrl, {
        params: {
          language: "en",
          words: false,
          translations: 131,
          fields: "text_uthmani",
          page: p,
          per_page: perPage
        }
      }));
    }

    const verseResponses = await Promise.all(versePromises);
    let allVerses: any[] = [];
    verseResponses.forEach((r, idx) => {
      const pageVerses = r.data.verses || [];
      console.log(`Page ${startPage + idx} returned ${pageVerses.length} verses`);
      allVerses = allVerses.concat(pageVerses);
    });

    // Filter verses by the requested range
    const verses = allVerses.filter((v: any) => {
      const vNum = parseInt(v.verse_key.split(':')[1]);
      return vNum >= vFrom && vNum <= vTo;
    });

    if (verses.length === 0) {
      console.error(`No verses found in range ${vFrom}-${vTo} for Surah ${sId}. Total fetched from ${verseResponses.length} pages: ${allVerses.length}`);
      if (allVerses.length > 0) {
        console.log(`First verse fetched: ${allVerses[0].verse_key}, Last verse fetched: ${allVerses[allVerses.length - 1].verse_key}`);
      }
      return res.status(404).json({ error: `No verses found for Surah ${sId} in range ${vFrom}-${vTo}` });
    }

    // Fetch audio files for the chapter across necessary pages
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
    
    const result = verses.map((v: any) => {
      const audio = allAudioFiles.find((a: any) => a.verse_key === v.verse_key);
      return {
        verse_key: v.verse_key,
        text: v.text_uthmani,
        translation: (v.translations && v.translations[0]?.text) ? v.translations[0].text.replace(/<(?:.|\n)*?>/gm, '') : '', // Remove HTML tags
        audioUrl: audio ? (audio.url.startsWith('http') ? audio.url : `https://download.quranicaudio.com/quran/${audio.url}`) : null
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching verses:", error.message);
    if (error.response) {
      console.error("API Response Error:", error.response.status, error.response.data);
      return res.status(error.response.status).json({ error: `Quran API Error: ${error.response.status}` });
    }
    res.status(500).json({ error: "Failed to fetch verses: " + error.message });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  // Vite middleware for development
  async function startDevServer() {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  startDevServer();
}

if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;

