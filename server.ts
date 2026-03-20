import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { createCanvas, loadImage, registerFont } from "canvas";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { GoogleGenAI } from "@google/genai";
import { SURAHS } from "./src/constants/quranData";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const app = express();
const PORT = 3000;

// Ensure directories exist
const isVercel = process.env.VERCEL === "1";
const baseDir = isVercel ? "/tmp" : process.cwd();

const UPLOADS_DIR = path.join(baseDir, "uploads");
const OUTPUT_DIR = path.join(baseDir, "output");
const DATA_DIR = path.join(baseDir, "data");

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
  console.error("Database initialization failed:", dbErr);
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

app.post("/api/generate-ai-bg", async (req, res) => {
  const { surahId, verseFrom, verseTo, aspectRatio } = req.body;
  try {
    const surah = SURAHS.find(s => s.id === surahId);
    const prompt = `A highly professional, cinematic, and spiritual background image for a Quranic video. Surah: ${surah?.name_simple}, Verses: ${verseFrom}-${verseTo}. The theme should be peaceful, divine, and elegant, suitable for Islamic content. No text, no human faces.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio === '1:1' ? '1:1' : '9:16',
          imageSize: "1K"
        }
      }
    });

    let imageUrl = "";
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const filename = `${uuidv4()}.png`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
        imageUrl = `/uploads/${filename}`;
        break;
      }
    }

    if (!imageUrl) throw new Error("Failed to generate image");
    res.json({ imageUrl });
  } catch (error: any) {
    console.error("AI BG Generation error:", error);
    res.status(500).json({ error: "Failed to generate AI background: " + error.message });
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
          registerFont(fontPath, { family: fontName });
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

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      const isVideoBg = bg?.type === 'video';

      if (!isVideoBg) {
        if (bgPath && fs.existsSync(bgPath)) {
          try {
            console.log(`Loading background image from: ${bgPath}`);
            const img = await loadImage(bgPath);
            
            // Apply Blur and Brightness
            const blur = config.blurBackground || 0;
            const brightness = config.brightnessBackground || 100;
            
            if (blur > 0) {
              const step = Math.max(1, blur / 2);
              ctx.globalAlpha = 0.2;
              for (let x = -blur; x <= blur; x += step) {
                for (let y = -blur; y <= blur; y += step) {
                  drawImageCover(ctx, img, width, height, x, y);
                }
              }
              ctx.globalAlpha = 1.0;
            } else {
              drawImageCover(ctx, img, width, height);
            }

            // Apply Brightness
            if (brightness < 100) {
              ctx.fillStyle = `rgba(0,0,0,${(100 - brightness) / 100})`;
              ctx.fillRect(0, 0, width, height);
            } else if (brightness > 100) {
              ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, (brightness - 100) / 100)})`;
              ctx.fillRect(0, 0, width, height);
            }
          } catch (imgError: any) {
            console.error(`Failed to load image at ${bgPath}:`, imgError.message);
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(0, 0, width, height);
          }
        } else {
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        // Transparent background for video overlay
        ctx.clearRect(0, 0, width, height);
      }

      // Apply Overlay Effects
      if (config.overlayType && config.overlayType !== 'none') {
        const opacity = config.overlayOpacity || 0.5;
        ctx.globalAlpha = opacity;
        
        if (config.overlayType === 'dust') {
          // Simple dust simulation: random white dots
          ctx.fillStyle = "white";
          for (let d = 0; d < 100; d++) {
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (config.overlayType === 'bokeh') {
          // Simple bokeh: large soft circles
          const gradient = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, Math.max(width, height)/2);
          gradient.addColorStop(0, "rgba(255, 255, 200, 0.2)");
          gradient.addColorStop(1, "rgba(128, 0, 128, 0.2)");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
        } else if (config.overlayType === 'light_leaks') {
          // Simple light leak: orange to transparent gradient
          const gradient = ctx.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, "rgba(255, 100, 0, 0.3)");
          gradient.addColorStop(0.5, "transparent");
          gradient.addColorStop(1, "rgba(0, 100, 255, 0.1)");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
        }
        
        ctx.globalAlpha = 1.0; // Reset alpha
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
        const metrics = ctx.measureText(testLine);
        if (metrics.width > width * 0.8) {
          ctx.fillText(line, width / 2, y);
          line = word + " ";
          y += (config.fontSize || 60) * 1.5;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, width / 2, y);

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

      // Draw Translations
      if (config.showTranslation && config.translationLanguages?.length > 0) {
        try {
          const transY = height / 2 + (config.fontSize || 60) * 2.5;
          ctx.font = `italic ${Math.floor((config.fontSize || 60) * 0.6)}px Arial`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          
          // For simplicity, we'll fetch one translation for now or use the one from preview
          // In a full implementation, we'd fetch all requested languages
          const transRes = await axios.get(`https://api.quran.com/api/v4/quran/translations/131?chapter_number=${config.surahId}`);
          const trans = transRes.data.translations.find((t: any) => t.verse_id === verse.id);
          if (trans) {
            const transText = trans.text.replace(/<[^>]*>?/gm, ''); // Strip HTML
            const words = transText.split(" ");
            let line = "";
            let currentY = transY;
            for (const word of words) {
              const testLine = line + word + " ";
              if (ctx.measureText(testLine).width > width * 0.8) {
                ctx.fillText(line, width / 2, currentY);
                line = word + " ";
                currentY += (config.fontSize || 60) * 0.8;
              } else {
                line = testLine;
              }
            }
            ctx.fillText(line, width / 2, currentY);
          }
        } catch (e) {
          console.error("Translation draw error:", e);
        }
      }

      const framePath = path.join(OUTPUT_DIR, `${jobId}_frame_${i}.png`);
      const out = fs.createWriteStream(framePath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      await new Promise<void>((resolve) => out.on('finish', () => resolve()));
      framePaths.push(framePath);
    }

    updateJob({ stage: "Merging Audio and Video", progress: 75 });
    const finalVideoPath = path.join(OUTPUT_DIR, `${jobId}_final.mp4`);
    
    const command = ffmpeg();
    
    // Add all verse images with their specific durations
    framePaths.forEach((fp, i) => {
      const verseNum = parseInt(targetVerses[i].verse_key.split(':')[1]);
      const bg = config.backgrounds.find((b: any) => verseNum >= b.verseFrom && verseNum <= b.verseTo) || config.backgrounds[0];
      const isVideo = bg?.type === 'video';
      const bgPath = bg?.fileUrl ? path.join(baseDir, bg.fileUrl.startsWith('/') ? bg.fileUrl.substring(1) : bg.fileUrl) : null;

      if (isVideo && bgPath && fs.existsSync(bgPath)) {
        command.input(bgPath).inputOptions([`-t ${verseDurations[i]}`]);
        command.input(fp);
      } else {
        command.input(fp).inputOptions(['-loop 1', `-t ${verseDurations[i]}`]);
      }
    });
    
    // Add all verse audio files
    verseAudioPaths.forEach(ap => {
      command.input(ap);
    });

    // Add nature sound if selected
    let natureSoundPath = "";
    if (config.natureSound && config.natureSound !== 'none') {
      // In a real app, these would be local files. For now, we'll use a placeholder or assume they exist in a data folder
      natureSoundPath = path.join(DATA_DIR, `nature_${config.natureSound}.mp3`);
      if (fs.existsSync(natureSoundPath)) {
        command.input(natureSoundPath).inputOptions(['-stream_loop -1']);
      }
    }
    
    // Build filter complex
    let vConcat = "";
    let inputIdx = 0;
    const vOutputs: string[] = [];

    framePaths.forEach((fp, i) => {
      const verseNum = parseInt(targetVerses[i].verse_key.split(':')[1]);
      const bg = config.backgrounds.find((b: any) => verseNum >= b.verseFrom && verseNum <= b.verseTo) || config.backgrounds[0];
      const isVideo = bg?.type === 'video';
      
      if (isVideo) {
        // [inputIdx:v] is video, [inputIdx+1:v] is text frame
        vConcat += `[${inputIdx}:v][${inputIdx+1}:v]overlay=0:0:format=auto[v${i}];`;
        vOutputs.push(`[v${i}]`);
        inputIdx += 2;
      } else {
        // [inputIdx:v] is image frame
        if (config.motionEffect) {
          vConcat += `[${inputIdx}:v]zoompan=z='min(zoom+0.0015,1.5)':d=${Math.floor(verseDurations[i] * 25)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}[v${i}];`;
          vOutputs.push(`[v${i}]`);
        } else {
          vOutputs.push(`[${inputIdx}:v]`);
        }
        inputIdx += 1;
      }
    });

    vConcat += vOutputs.join('') + `concat=n=${framePaths.length}:v=1:a=0[outv]`;

    let aConcat = "";
    const aRecitationIdx = inputIdx;
    aConcat += verseAudioPaths.map((_, i) => `[${aRecitationIdx + i}:a]`).join('') + `concat=n=${verseAudioPaths.length}:v=0:a=1[recitera]`;
    
    // Apply Reverb to recitation
    if (config.reverbEffect) {
      aConcat += `;[recitera]aecho=0.8:0.88:60:0.4[reverba]`;
    } else {
      aConcat += `;[recitera]copy[reverba]`;
    }

    // Mix with nature sound
    let finalAudioMap = "[reverba]";
    const natureIdx = aRecitationIdx + verseAudioPaths.length;
    if (natureSoundPath && fs.existsSync(natureSoundPath)) {
      aConcat += `;[reverba][${natureIdx}:a]amix=inputs=2:duration=first:dropout_transition=2:weights='${config.reciterVolume || 1} ${config.natureVolume || 0.3}'[outa]`;
      finalAudioMap = "[outa]";
    } else {
      aConcat += `;[reverba]volume=${config.reciterVolume || 1}[outa]`;
      finalAudioMap = "[outa]";
    }
    
    command
      .complexFilter([vConcat, aConcat])
      .map('[outv]')
      .map(finalAudioMap)
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
} else if (!isVercel) {
  app.use(express.static(path.join(process.cwd(), "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dist", "index.html"));
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
