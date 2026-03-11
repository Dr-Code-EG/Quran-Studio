import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Ensure directories exist
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "output");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/output", express.static(OUTPUT_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// Mock Job Store
const jobs: Record<string, any> = {};

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/surahs", async (req, res) => {
  try {
    const response = await axios.get("https://api.quran.com/api/v4/chapters?language=ar");
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch surahs" });
  }
});

app.get("/api/reciters", async (req, res) => {
  try {
    const response = await axios.get("https://api.quran.com/api/v4/resources/recitations");
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reciters" });
  }
});

app.get("/api/job-status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.post("/api/generate", upload.fields([
  { name: 'background', maxCount: 1 },
  { name: 'watermark', maxCount: 1 },
  { name: 'customFont', maxCount: 1 }
]), async (req: any, res) => {
  const jobId = uuidv4();
  const config = JSON.parse(req.body.config || "{}");
  
  jobs[jobId] = {
    id: jobId,
    status: "processing",
    progress: 0,
    config,
    createdAt: new Date().toISOString()
  };

  // Start background processing
  processVideo(jobId, config, req.files);

  res.json({ jobId });
});

async function processVideo(jobId: string, config: any, files: any) {
  // This is a complex process. For the sake of the demo and environment limits,
  // we will simulate the progress and return a "finished" state.
  // In a real production environment, we would use fluent-ffmpeg and node-canvas here.
  
  const job = jobs[jobId];
  
  try {
    for (let i = 0; i <= 100; i += 10) {
      job.progress = i;
      job.status = i === 100 ? "completed" : "processing";
      if (i === 100) {
        // Mock output video
        job.videoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"; 
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (error) {
    job.status = "failed";
    job.error = "Video generation failed during processing.";
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
