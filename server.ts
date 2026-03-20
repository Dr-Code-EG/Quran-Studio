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
    // Fetch verses for the chapter using from and to parameters for efficiency
    const url = `https://api.quran.com/api/v4/verses/by_chapter/${sId}`;
    const response = await axios.get(url, {
      params: {
        language: "en",
        words: false,
        translations: 131, // Dr. Mustafa Khattab, the Clear Quran
        fields: "text_uthmani",
        from: vFrom,
        to: vTo,
        per_page: 50 // API usually caps at 50, but we only need the requested range
      }
    });

    const verses = response.data.verses;
    if (!verses || verses.length === 0) {
      console.error("No verses found in Quran API response:", response.data);
      return res.status(404).json({ error: `No verses found for Surah ${sId} in range ${vFrom}-${vTo}` });
    }

    // Fetch audio files for the chapter
    const audioUrl = `https://api.quran.com/api/v4/recitations/${rId}/by_chapter/${sId}`;
    const audioResponse = await axios.get(audioUrl);
    
    const allAudioFiles = audioResponse.data.audio_files || [];
    
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

