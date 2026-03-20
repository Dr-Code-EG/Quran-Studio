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
  try {
    // Fetch verses with text and translations
    // We use the verses/by_chapter endpoint which is quite powerful
    const response = await axios.get(`https://api.quran.com/api/v4/verses/by_chapter/${surahId}`, {
      params: {
        language: "en",
        words: false,
        translations: 131, // Dr. Mustafa Khattab, the Clear Quran
        fields: "text_uthmani",
        from: verseFrom || 1,
        to: verseTo || verseFrom || 1,
        per_page: 50 // Limit to 50 verses for safety
      }
    });

    const verses = response.data.verses;

    // Fetch audio files for these verses
    // The reciterId from our constants might need mapping, but let's try it directly first
    // If it's not provided, default to Mishary Rashid Alafasy (7)
    const rId = reciterId || 7;
    const audioResponse = await axios.get(`https://api.quran.com/api/v4/recitations/${rId}/by_chapter/${surahId}`, {
      params: {
        from: verseFrom || 1,
        to: verseTo || verseFrom || 1
      }
    });
    const audioFiles = audioResponse.data.audio_files;

    const result = verses.map((v: any, index: number) => {
      const audio = audioFiles.find((a: any) => a.verse_key === v.verse_key);
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
    res.status(500).json({ error: "Failed to fetch verses" });
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

