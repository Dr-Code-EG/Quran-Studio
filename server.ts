import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { createCanvas } from "canvas";

const app = express();
const PORT = 3000;

// Ensure directories exist
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "output");
const DATA_DIR = path.join(process.cwd(), "data");

[UPLOADS_DIR, OUTPUT_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize Database
const db = new Database(path.join(DATA_DIR, "studio.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    status TEXT,
    progress INTEGER,
    stage TEXT,
    config TEXT,
    video_url TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/output", express.static(OUTPUT_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/test-canvas", (req, res) => {
  try {
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.fillText("Canvas OK", 20, 100);
    
    res.setHeader("Content-Type", "image/png");
    canvas.createPNGStream().pipe(res);
  } catch (error) {
    console.error("Canvas test failed:", error);
    res.status(500).json({ error: "Canvas library failed" });
  }
});

app.get("/api/verse-preview", async (req, res) => {
  const { surahId, verseFrom } = req.query;
  try {
    const response = await axios.get(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${surahId}`);
    const verses = response.data.verses;
    const verse = verses.find((v: any) => v.verse_key === `${surahId}:${verseFrom}`);
    
    // Also get translation
    const transResponse = await axios.get(`https://api.quran.com/api/v4/quran/translations/131?chapter_number=${surahId}`);
    const translations = transResponse.data.translations;
    const translation = translations.find((t: any) => t.resource_id === 131 && t.verse_id === verse.id);

    res.json({ 
      text: verse?.text_uthmani || "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      translation: translation?.text || "In the name of Allah, the Entirely Merciful, the Especially Merciful."
    });
  } catch (error) {
    res.json({ 
      text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
      translation: "In the name of Allah, the Entirely Merciful, the Especially Merciful."
    });
  }
});

app.get("/api/surahs", async (req, res) => {
  console.log("Fetching surahs...");
  try {
    const response = await axios.get("https://api.quran.com/api/v4/chapters?language=ar");
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching surahs:", error);
    res.status(500).json({ error: "Failed to fetch surahs" });
  }
});

app.get("/api/reciters", async (req, res) => {
  console.log("Fetching reciters...");
  try {
    const response = await axios.get("https://api.quran.com/api/v4/resources/recitations");
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching reciters:", error);
    res.status(500).json({ error: "Failed to fetch reciters" });
  }
});

app.get("/api/job-status/:jobId", (req, res) => {
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(req.params.jobId) as any;
  if (!job) return res.status(404).json({ error: "Job not found" });
  
  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    videoUrl: job.video_url,
    error: job.error,
    config: JSON.parse(job.config)
  });
});

app.post("/api/generate", upload.fields([
  { name: 'backgrounds', maxCount: 10 },
  { name: 'watermark', maxCount: 1 },
  { name: 'customFont', maxCount: 1 }
]), async (req: any, res) => {
  try {
    const jobId = uuidv4();
    const config = JSON.parse(req.body.config || "{}");
    
    // Map uploaded files to backgrounds
    if (req.files['backgrounds']) {
      req.files['backgrounds'].forEach((file: any, index: number) => {
        if (config.backgrounds && config.backgrounds[index]) {
          config.backgrounds[index].fileUrl = `/uploads/${file.filename}`;
        }
      });
    }

    if (req.files['customFont']) {
      config.customFontUrl = `/uploads/${req.files['customFont'][0].filename}`;
    }

    db.prepare(`
      INSERT INTO jobs (id, status, progress, stage, config)
      VALUES (?, ?, ?, ?, ?)
    `).run(jobId, "processing", 0, "Initializing", JSON.stringify(config));

    // Start background processing
    processVideo(jobId, config);

    res.json({ jobId });
  } catch (error) {
    console.error("Error starting generation:", error);
    res.status(500).json({ error: "Failed to start video generation" });
  }
});

async function processVideo(jobId: string, config: any) {
  const updateJob = (data: any) => {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(", ");
    const values = Object.values(data);
    db.prepare(`UPDATE jobs SET ${sets} WHERE id = ?`).run(...values, jobId);
  };

  const stages = [
    { name: "Fetching Quranic Data", progress: 10 },
    { name: "Downloading Recitation", progress: 25 },
    { name: "Generating Verse Images", progress: 45 },
    { name: "Applying Visual Effects", progress: 65 },
    { name: "Merging Audio and Video", progress: 85 },
    { name: "Finalizing Export", progress: 100 }
  ];
  
  try {
    for (const stage of stages) {
      updateJob({ stage: stage.name, progress: stage.progress });
      
      if (stage.progress === 100) {
        updateJob({ 
          status: "completed", 
          video_url: "https://www.w3schools.com/html/mov_bbb.mp4" 
        });
      }
      
      await new Promise(r => setTimeout(r, 2000)); // Simulate work
    }
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    updateJob({ 
      status: "failed", 
      error: "Video generation failed during processing." 
    });
  }
}

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
