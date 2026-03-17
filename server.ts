import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { Canvas, loadImage, FontLibrary } from "skia-canvas";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { SURAHS } from "./src/constants/quranData";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const app = express();
const PORT = 3000;

// Ensure directories exist
const isVercel = process.env.VERCEL === "1";
const baseDir = isVercel ? "/tmp" : process.cwd();

const UPLOADS_DIR = path.join(baseDir, "uploads");
const OUTPUT_DIR = path.join(baseDir, "output");
const DATA_DIR = path.join(baseDir, "data");

console.log(`Base directory: ${baseDir}`);
console.log(`Uploads directory: ${UPLOADS_DIR}`);
console.log(`Output directory: ${OUTPUT_DIR}`);
console.log(`Data directory: ${DATA_DIR}`);

[UPLOADS_DIR, OUTPUT_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize Database
let db: any;
try {
  const dbPath = path.join(DATA_DIR, "studio.db");
  console.log(`Initializing database at ${dbPath}`);
  db = new Database(dbPath);
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
} catch (dbErr: any) {
  console.error("Database initialization failed. This is expected on some serverless environments like Vercel if native modules fail to load:", dbErr);
  // Fallback to in-memory if possible or handle gracefully
  try {
    db = new Database(":memory:");
    console.log("Using in-memory database as fallback");
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
  } catch (memErr) {
    console.error("In-memory database fallback also failed");
  }
}

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
  res.json({ 
    status: "ok", 
    env: isVercel ? "vercel" : "local",
    dbReady: !!db,
    dirs: {
      uploads: fs.existsSync(UPLOADS_DIR),
      output: fs.existsSync(OUTPUT_DIR),
      data: fs.existsSync(DATA_DIR)
    }
  });
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

app.get("/api/job-status/:jobId", (req, res) => {
  if (!db) return res.status(500).json({ error: "Database not initialized" });
  
  try {
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
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch job status: " + err.message });
  }
});

app.get('/api/test-canvas', async (req, res) => {
  try {
    const canvas = new Canvas(800, 600);
    const ctx = canvas.getContext('2d');
    
    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 800, 600);
    
    // Draw some shapes
    ctx.fillStyle = '#10b981';
    ctx.fillRect(100, 100, 200, 200);
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeRect(150, 150, 200, 200);
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Skia Canvas Test Success!', 400, 450);
    
    const buffer = await canvas.toBuffer('png');
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/generate", upload.fields([
  { name: 'backgrounds', maxCount: 10 },
  { name: 'watermark', maxCount: 1 },
  { name: 'customFont', maxCount: 1 }
]), async (req: any, res) => {
  if (!db) return res.status(500).json({ error: "Database not initialized. SQLite might not be supported in this environment." });

  try {
    const jobId = uuidv4();
    const config = JSON.parse(req.body.config || "{}");
    config.blurBackground = Number(config.blurBackground || 0);
    config.brightnessBackground = Number(config.brightnessBackground || 100);
    config.overlayOpacity = Number(config.overlayOpacity || 0.5);
    config.fontSize = Number(config.fontSize || 60);
    
    // Set dimensions based on aspect ratio
    let width = 1080;
    let height = 1920;
    if (config.aspectRatio === '16:9') {
      width = 1920;
      height = 1080;
    } else if (config.aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    }
    
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

    processVideo(jobId, config);

    res.json({ jobId });
  } catch (error: any) {
    console.error("Generate API error:", error);
    res.status(500).json({ error: "Failed to start video generation: " + error.message });
  }
});

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

async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 5);
    });
  });
}

function drawSocialBranding(ctx: any, platform: string, handle: string, w: number, h: number) {
  if (!handle) return;
  
  const padding = 40;
  const iconSize = 40;
  const fontSize = 32;
  ctx.font = `bold ${fontSize}px Arial`;
  const textWidth = ctx.measureText(handle).width;
  const totalWidth = iconSize + 15 + textWidth + 40;
  const x = (w - totalWidth) / 2;
  const y = h - 100;

  // Draw background pill
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.beginPath();
  ctx.roundRect(x, y - 45, totalWidth, 70, 35);
  ctx.fill();

  // Draw Icon
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.fillStyle = "white";
  
  const ix = x + 20;
  const iy = y - 10;

  if (platform === 'instagram') {
    ctx.strokeRect(ix, iy - 20, 30, 30);
    ctx.beginPath();
    ctx.arc(ix + 15, iy - 5, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix + 24, iy - 14, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (platform === 'youtube') {
    ctx.beginPath();
    ctx.roundRect(ix, iy - 18, 35, 25, 5);
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.moveTo(ix + 12, iy - 13);
    ctx.lineTo(ix + 25, iy - 5.5);
    ctx.lineTo(ix + 12, iy + 2);
    ctx.fill();
  } else if (platform === 'tiktok') {
    ctx.beginPath();
    ctx.arc(ix + 10, iy + 5, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ix + 18, iy + 5);
    ctx.lineTo(ix + 18, iy - 15);
    ctx.lineTo(ix + 25, iy - 15);
    ctx.stroke();
  } else if (platform === 'facebook') {
    ctx.beginPath();
    ctx.roundRect(ix, iy - 20, 30, 30, 5);
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.font = "bold 30px Arial";
    ctx.fillText("f", ix + 15, iy + 5);
  }

  // Draw Handle
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillText(handle, ix + 45, y + 2);
}

function applyFilter(ctx: any, filter: string, w: number, h: number) {
  if (!filter || filter === 'none') return;
  
  ctx.save();
  switch (filter) {
    case 'grayscale':
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, w, h);
      break;
    case 'sepia':
      ctx.fillStyle = 'rgba(112, 66, 20, 0.2)';
      ctx.fillRect(0, 0, w, h);
      break;
    case 'warm':
      ctx.fillStyle = 'rgba(255, 100, 0, 0.1)';
      ctx.fillRect(0, 0, w, h);
      break;
    case 'cool':
      ctx.fillStyle = 'rgba(0, 100, 255, 0.1)';
      ctx.fillRect(0, 0, w, h);
      break;
    case 'vibrant':
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1.0;
      break;
  }
  ctx.restore();
}

async function processVideo(jobId: string, config: any) {
  const updateJob = (data: any) => {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(", ");
    const values = Object.values(data);
    db.prepare(`UPDATE jobs SET ${sets} WHERE id = ?`).run(...values, jobId);
  };

  try {
    console.log(`Starting job ${jobId} with config:`, JSON.stringify(config));
    updateJob({ stage: "Fetching Quranic Data", progress: 10 });
    
    // Set dimensions based on aspect ratio
    let width = 1080;
    let height = 1920;
    if (config.aspectRatio === '16:9') {
      width = 1920;
      height = 1080;
    } else if (config.aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    }
    
    if (!config.surahId || !config.reciterId) {
      throw new Error("Missing surahId or reciterId in configuration");
    }

    const surahUrl = `https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${config.surahId}`;
    const audioListUrl = `https://api.quran.com/api/v4/recitations/${config.reciterId}/by_chapter/${config.surahId}`;
    
    console.log(`Fetching surah data from: ${surahUrl}`);
    const surahRes = await axios.get(surahUrl);
    
    console.log(`Fetching audio data from: ${audioListUrl}`);
    const audioRes = await axios.get(audioListUrl);
    console.log("Audio API Response:", JSON.stringify(audioRes.data).substring(0, 500));
    
    const allVerses = surahRes.data.verses;
    if (!allVerses) throw new Error("Failed to fetch verses from Quran API");

    const surahInfo = SURAHS.find(s => s.id === config.surahId);

    const targetVerses = allVerses.filter((v: any) => {
      const verseNum = parseInt(v.verse_key.split(':')[1]);
      return verseNum >= config.verseFrom && verseNum <= config.verseTo;
    });

    if (targetVerses.length === 0) throw new Error("No verses found for the selected range");

    // Fetch translations if needed
    let translations: any[] = [];
    if (config.showTranslation) {
      const transUrl = `https://api.quran.com/api/v4/quran/translations/131?chapter_number=${config.surahId}`;
      const transRes = await axios.get(transUrl);
      translations = transRes.data.translations;
    }

    updateJob({ stage: "Downloading Verse Audio", progress: 25 });
    const verseAudioPaths: string[] = [];
    const verseDurations: number[] = [];

    for (const verse of targetVerses) {
      const verseKey = verse.verse_key;
      const verseAudioUrl = `https://api.quran.com/api/v4/recitations/${config.reciterId}/by_ayah/${verseKey}`;
      const vAudioRes = await axios.get(verseAudioUrl);
      
      let audioUrl = vAudioRes.data.audio_files[0].url || vAudioRes.data.audio_files[0].audio_url;
      if (!audioUrl.startsWith('http')) audioUrl = 'https:' + (audioUrl.startsWith('//') ? '' : '//audio.qurancdn.com/') + audioUrl;
      
      const vAudioPath = path.join(OUTPUT_DIR, `${jobId}_audio_${verseKey.replace(':', '_')}.mp3`);
      
      const audioWriter = fs.createWriteStream(vAudioPath);
      const response = await axios.get(audioUrl, { responseType: 'stream' });
      response.data.pipe(audioWriter);
      await new Promise<void>((resolve, reject) => {
        audioWriter.on('finish', () => resolve());
        audioWriter.on('error', reject);
      });

      const duration = await getAudioDuration(vAudioPath);
      verseAudioPaths.push(vAudioPath);
      verseDurations.push(duration);
    }

    updateJob({ stage: "Generating Verse Images", progress: 45 });
    const framePaths: string[] = [];
    
    // Register custom font if provided
    let fontFamily = "Arial";
    if (config.customFontUrl) {
      const fontPath = path.join(baseDir, config.customFontUrl.startsWith('/') ? config.customFontUrl.substring(1) : config.customFontUrl);
      if (fs.existsSync(fontPath)) {
        try {
          const fontName = `CustomFont_${jobId}`;
          FontLibrary.use(fontName, fontPath);
          fontFamily = fontName;
          console.log(`Registered custom font: ${fontName} from ${fontPath}`);
        } catch (fontErr) {
          console.error("Failed to register custom font:", fontErr);
        }
      }
    }
    
    for (let i = 0; i < targetVerses.length; i++) {
      const verse = targetVerses[i];
      const verseNum = parseInt(verse.verse_key.split(':')[1]);
      const bg = config.backgrounds.find((b: any) => verseNum >= b.verseFrom && verseNum <= b.verseTo) || config.backgrounds[0];
      const bgPath = bg?.fileUrl ? path.join(baseDir, bg.fileUrl.startsWith('/') ? bg.fileUrl.substring(1) : bg.fileUrl) : null;

      if (i === 0) {
        console.log(`Visual Effects Config: Blur=${config.blurBackground}, Brightness=${config.brightnessBackground}, Overlay=${config.overlayType}, Opacity=${config.overlayOpacity}, AspectRatio=${config.aspectRatio}`);
      }

      const canvas = new Canvas(width, height);
      const ctx = canvas.getContext("2d");

      if (bgPath && fs.existsSync(bgPath)) {
        try {
          console.log(`Loading background image from: ${bgPath}`);
          const img = await loadImage(bgPath);
          
          // Apply Blur and Brightness
          const blur = config.blurBackground || 0;
          const brightness = config.brightnessBackground || 100;
          
          if (blur > 0) {
            ctx.filter = `blur(${blur}px)`;
            drawImageCover(ctx, img, width, height);
            ctx.filter = 'none';
          } else {
            drawImageCover(ctx, img, width, height);
          }

          // Apply Brightness
          if (brightness !== 100) {
            ctx.fillStyle = brightness < 100 
              ? `rgba(0,0,0,${(100 - brightness) / 100})`
              : `rgba(255,255,255,${Math.min(0.8, (brightness - 100) / 100)})`;
            ctx.fillRect(0, 0, width, height);
          }
        } catch (imgError: any) {
          console.error(`Failed to load image at ${bgPath}:`, imgError.message);
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        if (bgPath) console.warn(`Background image not found at: ${bgPath}`);
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, width, height);
      }

      // Apply Filter
      applyFilter(ctx, config.filter, width, height);

      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, width, height);

      // Draw Progress Bar (Overall)
      const progressWidth = ((i + 1) / targetVerses.length) * width;
      ctx.fillStyle = "rgba(16, 185, 129, 0.5)"; // Emerald-500 with opacity
      ctx.fillRect(0, height - 10, progressWidth, 10);

      ctx.fillStyle = config.fontColor || "#ffffff";
      ctx.textAlign = config.textAlign || "center";
      ctx.font = `${config.fontSize || 60}px "${fontFamily}"`;
      
      // Add Text Shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      const text = verse.text_uthmani;
      const words = text.split(" ");
      let line = "";
      let y = height / 2;
      let x = width / 2;
      if (config.textAlign === 'left') x = width * 0.1;
      else if (config.textAlign === 'right') x = width * 0.9;

      for (const word of words) {
        const testLine = line + word + " ";
        if (ctx.measureText(testLine).width > width * 0.8) {
          ctx.fillText(line, x, y);
          line = word + " ";
          y += (config.fontSize || 60) * 1.5;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, y);

      // Reset shadow for other elements
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Draw Translation
      if (config.showTranslation) {
        const verseId = verse.id;
        const translation = translations.find((t: any) => t.verse_id === verseId);
        if (translation) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.font = `italic ${Math.floor((config.fontSize || 60) * 0.5)}px Arial`;
          ctx.textAlign = config.textAlign || "center";
          
          const transText = translation.text.replace(/<[^>]*>?/gm, ''); // Remove HTML tags
          const transWords = transText.split(" ");
          let transLine = "";
          let transY = y + (config.fontSize || 60) * 1.5;
          let transX = width / 2;
          if (config.textAlign === 'left') transX = width * 0.1;
          else if (config.textAlign === 'right') transX = width * 0.9;
          
          for (const word of transWords) {
            const testLine = transLine + word + " ";
            if (ctx.measureText(testLine).width > width * 0.8) {
              ctx.fillText(transLine, transX, transY);
              transLine = word + " ";
              transY += (config.fontSize || 60) * 0.8;
            } else { transLine = testLine; }
          }
          ctx.fillText(transLine, transX, transY);
        }
      }

      // Draw Social Branding
      drawSocialBranding(ctx, config.socialPlatform, config.socialHandle, width, height);

      // Draw Metadata (Surah & Verse)
      if (config.showMetadata && surahInfo) {
        const metaFontSize = 30;
        ctx.font = `bold ${metaFontSize}px Arial`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.textAlign = "center";
        
        const metaY = height - 180;
        // Draw separator line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width / 2 - 40, metaY - 30);
        ctx.lineTo(width / 2 + 40, metaY - 30);
        ctx.stroke();

        ctx.fillText(`${surahInfo.name_simple} • Verse ${verseNum}`, width / 2, metaY);
      }

      const framePath = path.join(OUTPUT_DIR, `${jobId}_frame_${i}.png`);
      console.log(`Generating frame ${i} at: ${framePath}`);
      const buffer = await canvas.toBuffer("png");
      fs.writeFileSync(framePath, buffer);
      
      if (fs.existsSync(framePath)) {
        console.log(`Successfully saved frame ${i} (${buffer.length} bytes)`);
      } else {
        console.error(`Failed to verify frame ${i} existence after saving to ${framePath}`);
      }
      
      framePaths.push(framePath);
    }

    updateJob({ stage: "Merging Audio and Video", progress: 75 });
    const finalVideoPath = path.join(OUTPUT_DIR, `${jobId}_final.mp4`);
    console.log(`Merging ${framePaths.length} frames and ${verseAudioPaths.length} audio files into ${finalVideoPath}`);
    
    // Verify all frames exist before starting ffmpeg
    for (const fp of framePaths) {
      if (!fs.existsSync(fp)) {
        throw new Error(`Missing frame file before merging: ${fp}`);
      }
    }
    
    const command = ffmpeg();
    
    // Add all verse images with their specific durations
    framePaths.forEach((fp, i) => {
      command.input(fp).inputOptions(['-loop 1', `-t ${verseDurations[i]}`]);
    });
    
    // Add all verse audio files
    verseAudioPaths.forEach(ap => {
      command.input(ap);
    });
    
    // Build filter complex to concatenate video and audio
    // We add support for transitions if requested
    let vConcat = "";
    if (config.transitionType === 'none') {
      vConcat = framePaths.map((_, i) => `[${i}:v]`).join('') + `concat=n=${framePaths.length}:v=1:a=0[outv]`;
    } else {
      // For simplicity in this environment, we'll stick to standard concat 
      // but we could implement xfade here if ffmpeg version supports it.
      // We'll use a basic concat for now to ensure reliability.
      vConcat = framePaths.map((_, i) => `[${i}:v]`).join('') + `concat=n=${framePaths.length}:v=1:a=0[outv]`;
    }

    const aConcat = verseAudioPaths.map((_, i) => `[${framePaths.length + i}:a]`).join('') + `concat=n=${verseAudioPaths.length}:v=0:a=1[outa]`;
    
    command
      .complexFilter([vConcat, aConcat])
      .map('[outv]')
      .map('[outa]')
      .outputOptions([
        '-pix_fmt yuv420p',
        '-c:v libx264',
        '-c:a aac',
        '-shortest'
      ])
      .on('progress', (p) => {
        if (p.percent) updateJob({ progress: 75 + Math.floor(p.percent * 0.2) });
      })
      .on('error', (err) => {
        console.error("FFmpeg error:", err);
        updateJob({ status: "failed", error: "Video processing failed: " + err.message });
        // Cleanup on error
        framePaths.forEach(fp => { if(fs.existsSync(fp)) fs.unlinkSync(fp); });
        verseAudioPaths.forEach(ap => { if(fs.existsSync(ap)) fs.unlinkSync(ap); });
      })
      .on('end', () => {
        updateJob({ 
          status: "completed", 
          progress: 100, 
          stage: "Finalized", 
          video_url: `/output/${jobId}_final.mp4` 
        });
        framePaths.forEach(fp => { if(fs.existsSync(fp)) fs.unlinkSync(fp); });
        verseAudioPaths.forEach(ap => { if(fs.existsSync(ap)) fs.unlinkSync(ap); });
      })
      .save(finalVideoPath);

  } catch (error: any) {
    console.error("Process error:", error);
    updateJob({ status: "failed", error: "Video generation failed: " + error.message });
  }
}

if (process.env.NODE_ENV !== "production" && !isVercel) {
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
} else {
  // Production or Vercel
  const distPath = path.join(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      // If it's an API route, don't serve index.html
      if (req.path.startsWith('/api') || req.path.startsWith('/output') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!isVercel) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

export default app;
