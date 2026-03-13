import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { Canvas, loadImage, FontLibrary } from "skia-canvas";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { createServer as createViteServer } from "vite";

// Vercel config for longer execution
export const config = {
  maxDuration: 60,
};

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

async function startServer() {
  console.log("Starting server...");
  
  // Test skia-canvas
  try {
    const testCanvas = new Canvas(10, 10);
    const testCtx = testCanvas.getContext("2d");
    testCtx.fillStyle = "red";
    testCtx.fillRect(0, 0, 10, 10);
    console.log("skia-canvas test successful");
  } catch (e) {
    console.error("skia-canvas test FAILED:", e);
  }

  const app = express();
  const PORT = 3000;

  // Ensure directories exist (for temporary processing)
  const baseDir = "/tmp"; 
  const UPLOADS_DIR = path.join(baseDir, "uploads");
  const OUTPUT_DIR = path.join(baseDir, "output");

  [UPLOADS_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  app.use(cors());
  app.use(express.json());

  // Debug endpoint to check environment
  app.get("/api/debug-info", (req, res) => {
    const info = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      dirs: {
        uploads: fs.existsSync(UPLOADS_DIR),
        output: fs.existsSync(OUTPUT_DIR)
      },
      ffmpeg: ffmpegInstaller.path,
      ffprobe: ffprobeInstaller.path
    };
    res.json(info);
  });

  app.get("/api/test-canvas", async (req, res) => {
    try {
      const canvas = new Canvas(400, 200);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 400, 200);
      ctx.fillStyle = "black";
      ctx.font = "30px Arial";
      ctx.fillText("Canvas Test Successful", 50, 100);
      const buffer = await canvas.toBuffer("png");
      res.set("Content-Type", "image/png");
      res.send(buffer);
    } catch (e: any) {
      res.status(500).json({ error: e.message, stack: e.stack });
    }
  });

  const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  });
  const upload = multer({ storage: multerStorage });

  // In-memory job store
  const jobs: Record<string, any> = {};

  // Helper to update job status
  async function updateJob(jobId: string, data: any) {
    if (jobs[jobId]) {
      jobs[jobId] = {
        ...jobs[jobId],
        ...data,
        updatedAt: new Date().toISOString()
      };
    }
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    console.log("Health check requested");
    res.json({ status: "ok" });
  });

  app.get("/api/verse-preview", async (req, res) => {
    const { surahId, verseFrom } = req.query;
    try {
      const response = await axios.get(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${surahId}`);
      const verses = response.data.verses;
      const verse = verses.find((v: any) => v.verse_key === `${surahId}:${verseFrom}`);
      
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

  app.post("/api/generate", (req, res, next) => {
    console.log("Generate request received");
    next();
  }, (req, res, next) => {
    upload.fields([
      { name: 'backgrounds', maxCount: 10 },
      { name: 'watermark', maxCount: 1 },
      { name: 'customFont', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(500).json({ error: "File upload failed: " + err.message });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      console.log("Processing generate request...");
      const jobId = uuidv4();
      
      if (!req.body.config) {
        return res.status(400).json({ error: "Missing configuration data" });
      }
      
      let config;
      try {
        config = JSON.parse(req.body.config);
      } catch (e) {
        return res.status(400).json({ error: "Invalid configuration format" });
      }
      
      // Ensure backgrounds is an array
      if (!Array.isArray(config.backgrounds)) {
        config.backgrounds = [];
      }

      // Map uploaded files to backgrounds
      if (req.files['backgrounds']) {
        let fileIndex = 0;
        for (let i = 0; i < config.backgrounds.length; i++) {
          if (fileIndex < req.files['backgrounds'].length) {
             config.backgrounds[i].localPath = req.files['backgrounds'][fileIndex].path;
             fileIndex++;
          }
        }
      }

      if (req.files['customFont']) {
        config.customFontLocalPath = req.files['customFont'][0].path;
      }

      jobs[jobId] = {
        id: jobId,
        status: "processing",
        progress: 0,
        stage: "Initializing",
        config: config,
        createdAt: new Date().toISOString()
      };

      // Start background process
      processVideo(jobId, config, jobs).catch(err => {
        console.error(`Job ${jobId} failed:`, err);
        if (jobs[jobId]) {
          jobs[jobId].status = "failed";
          jobs[jobId].error = err.message || "Unknown error during processing";
        }
      });

      res.json({ jobId });
    } catch (error: any) {
      console.error("Generate API error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.get("/api/job-status/:id", async (req, res) => {
    const job = jobs[req.params.id];
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Express Error:", err);
    res.status(500).json({ 
      error: {
        code: "500",
        message: err.message || "A server error has occurred",
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 5);
    });
  });
}

function drawImageCover(ctx: any, img: any, w: number, h: number, dx = 0, dy = 0) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let sx, sy, sw, sh;
  if (imgRatio > canvasRatio) {
    sw = img.height * canvasRatio;
    sh = img.height;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = img.width / canvasRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, w, h);
}

function drawSocialBranding(ctx: any, platform: string, handle: string, w: number, h: number) {
  if (!handle) return;
  const fontSize = 32;
  ctx.font = `bold ${fontSize}px Arial`;
  const textWidth = ctx.measureText(handle).width;
  const iconSize = 40;
  const totalWidth = iconSize + 15 + textWidth + 40;
  const x = (w - totalWidth) / 2;
  const y = h - 100;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.beginPath();
  ctx.roundRect(x, y - 45, totalWidth, 70, 35);
  ctx.fill();
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.fillText(handle, x + iconSize + 25, y + 2);
}

async function processVideo(jobId: string, config: any, jobs: any) {
  console.log(`Starting processVideo for job ${jobId}`);
  const updateJobLocal = async (id: string, data: any) => {
    if (jobs[id]) {
      jobs[id] = { ...jobs[id], ...data, updatedAt: new Date().toISOString() };
    }
  };

  try {
    const baseDir = "/tmp";
    const OUTPUT_DIR = path.join(baseDir, "output");

    await updateJobLocal(jobId, { stage: "Fetching Quranic Data", progress: 10 });
    
    let width = 1080, height = 1920;
    if (config.aspectRatio === '16:9') { width = 1920; height = 1080; }
    else if (config.aspectRatio === '1:1') { width = 1080; height = 1080; }
    
    const surahUrl = `https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${config.surahId}`;
    const surahRes = await axios.get(surahUrl);
    const allVerses = surahRes.data.verses;
    const targetVerses = allVerses.filter((v: any) => {
      const verseNum = parseInt(v.verse_key.split(':')[1]);
      return verseNum >= config.verseFrom && verseNum <= config.verseTo;
    });

    await updateJobLocal(jobId, { stage: "Downloading Verse Audio", progress: 25 });
    const verseAudioPaths: string[] = [];
    const verseDurations: number[] = [];

    for (const verse of targetVerses) {
      const verseKey = verse.verse_key;
      const verseAudioUrl = `https://api.quran.com/api/v4/recitations/${config.reciterId}/by_ayah/${verseKey}`;
      const vAudioRes = await axios.get(verseAudioUrl);
      let audioUrl = vAudioRes.data.audio_files[0].url || vAudioRes.data.audio_files[0].audio_url;
      if (!audioUrl.startsWith('http')) audioUrl = 'https:' + (audioUrl.startsWith('//') ? '' : '//audio.qurancdn.com/') + audioUrl;
      
      const vAudioPath = path.join(OUTPUT_DIR, `${jobId}_audio_${verseKey.replace(':', '_')}.mp3`);
      const response = await axios.get(audioUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(vAudioPath);
      response.data.pipe(writer);
      await new Promise<void>((resolve, reject) => { writer.on('finish', () => resolve()); writer.on('error', reject); });

      const duration = await getAudioDuration(vAudioPath);
      verseAudioPaths.push(vAudioPath);
      verseDurations.push(duration);
    }

    await updateJobLocal(jobId, { stage: "Generating Verse Images", progress: 45 });
    const framePaths: string[] = [];
    
    let fontFamily = "Arial";
    if (config.customFontLocalPath) {
      const fontName = `CustomFont_${jobId}`;
      FontLibrary.use(fontName, config.customFontLocalPath);
      fontFamily = fontName;
    }
    
    for (let i = 0; i < targetVerses.length; i++) {
      const verse = targetVerses[i];
      const verseNum = parseInt(verse.verse_key.split(':')[1]);
      const bg = config.backgrounds.find((b: any) => verseNum >= b.verseFrom && verseNum <= b.verseTo) || config.backgrounds[0];
      
      const canvas = new Canvas(width, height);
      const ctx = canvas.getContext("2d");

      if (bg?.localPath) {
        const img = await loadImage(bg.localPath);
        drawImageCover(ctx, img, width, height);
      } else {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, width, height);
      }

      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = config.fontColor || "#ffffff";
      ctx.textAlign = "center";
      ctx.font = `${config.fontSize || 60}px "${fontFamily}"`;
      
      const text = verse.text_uthmani;
      const words = text.split(" ");
      let line = "";
      let y = height / 2;
      for (const word of words) {
        const testLine = line + word + " ";
        if (ctx.measureText(testLine).width > width * 0.8) {
          ctx.fillText(line, width / 2, y);
          line = word + " ";
          y += (config.fontSize || 60) * 1.5;
        } else { line = testLine; }
      }
      ctx.fillText(line, width / 2, y);

      drawSocialBranding(ctx, config.socialPlatform, config.socialHandle, width, height);

      const framePath = path.join(OUTPUT_DIR, `${jobId}_frame_${i}.png`);
      await canvas.saveAs(framePath);
      framePaths.push(framePath);
    }

    await updateJobLocal(jobId, { stage: "Merging Audio and Video", progress: 75 });
    const finalVideoName = `${jobId}_final.mp4`;
    const finalVideoPath = path.join(OUTPUT_DIR, finalVideoName);
    const command = ffmpeg();
    framePaths.forEach((fp, i) => command.input(fp).inputOptions(['-loop 1', `-t ${verseDurations[i]}`]));
    verseAudioPaths.forEach(ap => command.input(ap));
    
    const vConcat = framePaths.map((_, i) => `[${i}:v]`).join('') + `concat=n=${framePaths.length}:v=1:a=0[outv]`;
    const aConcat = verseAudioPaths.map((_, i) => `[${framePaths.length + i}:a]`).join('') + `concat=n=${verseAudioPaths.length}:v=0:a=1[outa]`;
    
    await new Promise((resolve, reject) => {
      command
        .complexFilter([vConcat, aConcat])
        .map('[outv]').map('[outa]')
        .outputOptions(['-pix_fmt yuv420p', '-c:v libx264', '-c:a aac', '-shortest'])
        .on('progress', (p) => { if (p.percent) updateJobLocal(jobId, { progress: 75 + Math.floor(p.percent * 0.2) }); })
        .on('error', reject)
        .on('end', resolve)
        .save(finalVideoPath);
    });

    await updateJobLocal(jobId, { 
      status: "completed", 
      progress: 100, 
      stage: "Finalized", 
      videoUrl: `/output/${finalVideoName}` 
    });

    // Cleanup temp files
    [...framePaths, ...verseAudioPaths].forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });
    if (config.customFontLocalPath && fs.existsSync(config.customFontLocalPath)) fs.unlinkSync(config.customFontLocalPath);
    config.backgrounds.forEach((bg: any) => {
      if (bg.localPath && fs.existsSync(bg.localPath)) fs.unlinkSync(bg.localPath);
    });

  } catch (error: any) {
    console.error("Process error:", error);
    await updateJobLocal(jobId, { status: "failed", error: error.message });
  }
}

startServer().catch(err => {
  console.error("CRITICAL: Server failed to start:", err);
});

