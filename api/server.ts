import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import { Canvas, loadImage, FontLibrary } from "skia-canvas";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import firebaseConfig from "../firebase-applet-config.json";

// Vercel config for longer execution
export const config = {
  maxDuration: 60, // 60 seconds (max for Pro, Hobby is 10s but this doesn't hurt)
};

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Initialize Firebase Client SDK (works on server too)
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const storage = getStorage(firebaseApp);

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

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage: multerStorage });

// Helper to update job status in Firestore
async function updateJob(jobId: string, data: any) {
  try {
    const jobRef = doc(db, "jobs", jobId);
    await updateDoc(jobRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(`Error updating job ${jobId}:`, error);
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    firebase: !!db
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

app.post("/api/generate", upload.fields([
  { name: 'backgrounds', maxCount: 10 },
  { name: 'watermark', maxCount: 1 },
  { name: 'customFont', maxCount: 1 }
]), async (req: any, res) => {
  try {
    const jobId = uuidv4();
    const config = JSON.parse(req.body.config || "{}");
    
    // Upload files to Firebase Storage immediately
    if (req.files['backgrounds']) {
      for (let i = 0; i < req.files['backgrounds'].length; i++) {
        const file = req.files['backgrounds'][i];
        const destination = `uploads/${jobId}/bg_${i}${path.extname(file.originalname)}`;
        const fileBuffer = fs.readFileSync(file.path);
        const storageRef = ref(storage, destination);
        await uploadBytes(storageRef, fileBuffer);
        if (config.backgrounds && config.backgrounds[i]) {
          config.backgrounds[i].storagePath = destination;
        }
      }
    }

    if (req.files['customFont']) {
      const file = req.files['customFont'][0];
      const destination = `uploads/${jobId}/font${path.extname(file.originalname)}`;
      const fileBuffer = fs.readFileSync(file.path);
      const storageRef = ref(storage, destination);
      await uploadBytes(storageRef, fileBuffer);
      config.customFontStoragePath = destination;
    }

    // Save job to Firestore
    await setDoc(doc(db, "jobs", jobId), {
      id: jobId,
      status: "processing",
      progress: 0,
      stage: "Initializing",
      config: JSON.stringify(config),
      createdAt: serverTimestamp()
    });

    // Start processing
    processVideo(jobId, config).catch(err => {
      console.error(`Job ${jobId} failed:`, err);
      updateJob(jobId, {
        status: "failed",
        error: err.message
      });
    });

    res.json({ jobId });
  } catch (error: any) {
    console.error("Generate API error:", error);
    res.status(500).json({ error: "Failed to start video generation: " + error.message });
  }
});

app.get("/api/job-status/:id", async (req, res) => {
  try {
    const jobDoc = await getDoc(doc(db, "jobs", req.params.id));
    if (!jobDoc.exists()) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(jobDoc.data());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
  // skia-canvas roundRect
  ctx.roundRect(x, y - 45, totalWidth, 70, 35);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.fillText(handle, x + iconSize + 25, y + 2);
}

async function processVideo(jobId: string, config: any) {
  try {
    await updateJob(jobId, { stage: "Fetching Quranic Data", progress: 10 });
    
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

    await updateJob(jobId, { stage: "Downloading Verse Audio", progress: 25 });
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

    await updateJob(jobId, { stage: "Generating Verse Images", progress: 45 });
    const framePaths: string[] = [];
    
    let fontFamily = "Arial";
    if (config.customFontStoragePath) {
      const fontPath = path.join(baseDir, `font_${jobId}${path.extname(config.customFontStoragePath)}`);
      const fontUrl = await getDownloadURL(ref(storage, config.customFontStoragePath));
      const fontRes = await axios.get(fontUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(fontPath, Buffer.from(fontRes.data));
      const fontName = `CustomFont_${jobId}`;
      FontLibrary.use(fontName, fontPath);
      fontFamily = fontName;
    }
    
    for (let i = 0; i < targetVerses.length; i++) {
      const verse = targetVerses[i];
      const verseNum = parseInt(verse.verse_key.split(':')[1]);
      const bg = config.backgrounds.find((b: any) => verseNum >= b.verseFrom && verseNum <= b.verseTo) || config.backgrounds[0];
      
      const canvas = new Canvas(width, height);
      const ctx = canvas.getContext("2d");

      if (bg?.storagePath) {
        const localBgPath = path.join(baseDir, `bg_${jobId}_${i}${path.extname(bg.storagePath)}`);
        const bgUrl = await getDownloadURL(ref(storage, bg.storagePath));
        const bgRes = await axios.get(bgUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(localBgPath, Buffer.from(bgRes.data));
        const img = await loadImage(localBgPath);
        drawImageCover(ctx, img, width, height);
        fs.unlinkSync(localBgPath);
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

    await updateJob(jobId, { stage: "Merging Audio and Video", progress: 75 });
    const finalVideoPath = path.join(OUTPUT_DIR, `${jobId}_final.mp4`);
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
        .on('progress', (p) => { if (p.percent) updateJob(jobId, { progress: 75 + Math.floor(p.percent * 0.2) }); })
        .on('error', reject)
        .on('end', resolve)
        .save(finalVideoPath);
    });

    await updateJob(jobId, { stage: "Uploading Video", progress: 95 });
    const videoDest = `output/${jobId}_final.mp4`;
    const videoBuffer = fs.readFileSync(finalVideoPath);
    const videoRef = ref(storage, videoDest);
    await uploadBytes(videoRef, videoBuffer);
    const url = await getDownloadURL(videoRef);

    await updateJob(jobId, { 
      status: "completed", 
      progress: 100, 
      stage: "Finalized", 
      videoUrl: url 
    });

    // Cleanup
    [...framePaths, ...verseAudioPaths, finalVideoPath].forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });

  } catch (error: any) {
    console.error("Process error:", error);
    await updateJob(jobId, { status: "failed", error: error.message });
  }
}

export default app;
