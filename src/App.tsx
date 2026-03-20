import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Settings, 
  Video, 
  Music, 
  Type, 
  Layout, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Upload,
  Eye,
  Sparkles,
  Instagram,
  Youtube,
  Twitter,
  Facebook,
  Monitor,
  Plus,
  Trash2,
  Layers,
  Sun,
  Droplets
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Surah, Reciter, VideoConfig, JobStatus, BackgroundConfig } from './types';
import { SURAHS, RECITERS } from './constants/quranData';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ASPECT_RATIOS = [
  { id: '9:16', label: 'TikTok / Reels', icon: <Monitor className="w-4 h-4 rotate-90" />, ratio: 'aspect-[9/16]' },
  { id: '16:9', label: 'YouTube', icon: <Monitor className="w-4 h-4" />, ratio: 'aspect-[16/9]' },
  { id: '1:1', label: 'Instagram Post', icon: <Layout className="w-4 h-4" />, ratio: 'aspect-square' },
];

const THEMES = [
  { id: 'modern', label: 'Modern', color: 'bg-emerald-500' },
  { id: 'classic', label: 'Classic', color: 'bg-amber-500' },
  { id: 'cinematic', label: 'Cinematic', color: 'bg-blue-500' },
  { id: 'minimal', label: 'Minimal', color: 'bg-zinc-500' },
  { id: 'nature', label: 'Nature', color: 'bg-green-500' },
  { id: 'night', label: 'Night', color: 'bg-indigo-500' },
];

const OVERLAYS = [
  { id: 'none', label: 'None' },
  { id: 'dust', label: 'Dust Particles' },
  { id: 'bokeh', label: 'Bokeh Lights' },
  { id: 'light_leaks', label: 'Light Leaks' },
];

const ARABIC_FONTS = [
  { id: 'Amiri', label: 'Amiri (Traditional)' },
  { id: 'Lateef', label: 'Lateef (Soft)' },
  { id: 'Scheherazade', label: 'Scheherazade (Classic)' },
  { id: 'Noto Sans Arabic', label: 'Noto Sans (Modern)' },
];

export default function App() {
  const [surahs, setSurahs] = useState<Surah[]>(SURAHS);
  const [reciters, setReciters] = useState<Reciter[]>(RECITERS);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadFFmpeg();
  }, []);

  const loadFFmpeg = async () => {
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      const ffmpeg = ffmpegRef.current;
      ffmpeg.on('log', ({ message }) => {
        console.log(message);
      });
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setFfmpegLoaded(true);
    } catch (err) {
      console.error('Failed to load FFmpeg:', err);
      setError('Failed to load video processing engine. Please refresh.');
    }
  };

  const generateVideo = async () => {
    if (!ffmpegLoaded) {
      setError('Video engine is still loading. Please wait a moment.');
      return;
    }

    setGenerating(true);
    setError(null);
    setJobStatus({
      id: 'client-side',
      status: 'processing',
      progress: 0,
      stage: 'Initializing...',
    });

    try {
      const ffmpeg = ffmpegRef.current;
      
      // 1. Fetch verse data
      setJobStatus(prev => prev ? { ...prev, stage: 'Fetching verses...' } : null);
      const versesResponse = await axios.get(`/api/verse-preview`, {
        params: {
          surahId: config.surahId,
          verseFrom: config.verseFrom,
          verseTo: config.verseTo,
          reciterId: config.reciterId,
        }
      });
      const verses = Array.isArray(versesResponse.data) ? versesResponse.data : [versesResponse.data];

      // 2. Prepare Canvas
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not found');

      const [width, height] = config.aspectRatio === '9:16' ? [1080, 1920] : 
                            config.aspectRatio === '1:1' ? [1080, 1080] : [1920, 1080];
      canvas.width = width;
      canvas.height = height;

      // 3. Pre-fetch all audio files in parallel
      setJobStatus(prev => prev ? { ...prev, stage: 'Downloading audio files...' } : null);
      const audioDataMap: { [key: number]: Uint8Array } = {};
      await Promise.all(verses.map(async (verse: any, i: number) => {
        if (verse.audioUrl) {
          try {
            const data = await fetchFile(verse.audioUrl);
            audioDataMap[i] = data;
          } catch (e) {
            console.warn(`Failed to fetch audio for verse ${i + 1}`, e);
          }
        }
      }));

      // 4. Process each verse
      const audioFiles: string[] = [];
      const frameFiles: string[] = [];

      for (let i = 0; i < verses.length; i++) {
        const verse = verses[i];
        const progress = Math.round(((i + 1) / verses.length) * 60);
        setJobStatus(prev => prev ? { ...prev, progress, stage: `Processing verse ${i + 1}/${verses.length}` } : null);

        // Write audio to FFmpeg
        if (audioDataMap[i]) {
          const audioName = `audio_${i}.mp3`;
          await ffmpeg.writeFile(audioName, audioDataMap[i]);
          audioFiles.push(audioName);
        }

        // Render frame
        ctx.clearRect(0, 0, width, height);
        
        // Background
        ctx.fillStyle = '#1a1a1a'; // Default dark background
        ctx.fillRect(0, 0, width, height);

        // Text rendering
        ctx.fillStyle = config.fontColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Arabic text
        ctx.font = `bold ${config.fontSize * 1.2}px "Amiri", Arial`;
        const arabicY = height / 2 - 40;
        ctx.fillText(verse.text, width / 2, arabicY);
        
        // Translation text
        if (config.showTranslation) {
          ctx.font = `${config.fontSize * 0.6}px Arial`;
          const transY = height / 2 + 60;
          // Simple word wrap for translation
          const translationText = verse.translation || '';
          const words = translationText.split(' ');
          let line = '';
          let y = transY;
          for (const word of words) {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > width * 0.8) {
              ctx.fillText(line, width / 2, y);
              line = word + ' ';
              y += config.fontSize * 0.8;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, width / 2, y);
        }

        // Social Branding
        if (config.socialHandle) {
          ctx.font = '24px Arial';
          ctx.globalAlpha = 0.6;
          ctx.fillText(config.socialHandle, width / 2, height - 100);
          ctx.globalAlpha = 1.0;
        }

        // Save frame
        const frameName = `frame_${i}.png`;
        const frameData = await fetchFile(canvas.toDataURL('image/png'));
        await ffmpeg.writeFile(frameName, frameData);
        frameFiles.push(frameName);
      }

      // 4. Combine into video
      setJobStatus(prev => prev ? { ...prev, progress: 80, stage: 'Generating final video...' } : null);
      
      // Concat audio
      const audioList = audioFiles.map(f => `file '${f}'`).join('\n');
      await ffmpeg.writeFile('audio_list.txt', audioList);
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', 'audio_list.txt', '-c', 'copy', 'output_audio.mp3']);

      // Concat frames with duration
      // Note: In a real app, we'd get the actual audio duration. 
      // For this prototype, we'll assume 5s per verse or try to match audio.
      let frameList = frameFiles.map(f => `file '${f}'\nduration 5`).join('\n');
      // Add the last frame again to ensure the last duration is respected
      if (frameFiles.length > 0) {
        frameList += `\nfile '${frameFiles[frameFiles.length - 1]}'`;
      }
      await ffmpeg.writeFile('frame_list.txt', frameList);
      
      await ffmpeg.exec([
        '-f', 'concat', '-safe', '0', '-i', 'frame_list.txt',
        '-i', 'output_audio.mp3',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const videoUrl = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }));

      setJobStatus({
        id: 'client-side',
        status: 'completed',
        progress: 100,
        stage: 'Generation complete!',
        videoUrl,
      });

    } catch (err: any) {
      console.error('Video generation failed:', err);
      setError(err.message || 'Failed to generate video. Please try again.');
      setJobStatus(prev => prev ? { ...prev, status: 'failed' } : null);
    } finally {
      setGenerating(false);
    }
  };

  const [config, setConfig] = useState<VideoConfig>({
    surahId: 1,
    verseFrom: 1,
    verseTo: 7,
    reciterId: 7,
    aspectRatio: '9:16',
    theme: 'modern',
    fontFamily: 'Amiri',
    fontSize: 48,
    fontColor: '#ffffff',
    textPosition: 'center',
    showTranslation: true,
    translationLanguage: 'en',
    natureSound: 'none',
    natureVolume: 0.3,
    reciterVolume: 1.0,
    socialHandle: '@quranstudio',
    socialPlatform: 'instagram',
    blurBackground: 0,
    brightnessBackground: 100,
    overlayType: 'none',
    overlayOpacity: 0.5,
    transitionType: 'fade',
    motionEffect: true,
    backgrounds: [],
  });

  const [customFontFile, setCustomFontFile] = useState<File | null>(null);
  const [bgFiles, setBgFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewVerse, setPreviewVerse] = useState({ text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.' });

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/verse-preview`, {
          params: {
            surahId: config.surahId,
            verseFrom: config.verseFrom,
            verseTo: config.verseFrom // Only fetch the current verse for preview
          }
        });
        const data = Array.isArray(res.data) ? res.data[0] : res.data;
        if (data) {
          setPreviewVerse(data);
        }
      } catch (error) {
        console.error("Failed to fetch preview verse", error);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [config.surahId, config.verseFrom]);

  useEffect(() => {
    // Client-side generation doesn't need polling
  }, [jobStatus?.id, jobStatus?.status]);

  const addBackground = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setConfig({
      ...config,
      backgrounds: [
        ...config.backgrounds,
        { id, verseFrom: config.verseFrom, verseTo: config.verseTo, type: 'image' }
      ]
    });
  };

  const removeBackground = (id: string) => {
    setConfig({
      ...config,
      backgrounds: config.backgrounds.filter(bg => bg.id !== id)
    });
    const newBgFiles = { ...bgFiles };
    delete newBgFiles[id];
    setBgFiles(newBgFiles);
    const newPreviews = { ...previews };
    delete newPreviews[id];
    setPreviews(newPreviews);
  };

  const handleBgFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBgFiles({ ...bgFiles, [id]: file });
      const reader = new FileReader();
      reader.onloadend = () => setPreviews({ ...previews, [id]: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleFontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomFontFile(file);
      setConfig({ ...config, fontFamily: 'Custom' });
    }
  };

  const handleGenerate = async () => {
    generateVideo();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
          <p className="text-zinc-400 font-medium animate-pulse">Initializing Studio...</p>
        </div>
      </div>
    );
  }

  const currentSurah = surahs.find(s => s.id === config.surahId);
  const firstBgPreview = config.backgrounds.length > 0 ? previews[config.backgrounds[0].id] : null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-[#050505]">
      {/* Hidden Canvas for Video Generation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Sidebar - Configuration */}
      <div className="w-full lg:w-[450px] h-screen overflow-y-auto border-r border-white/5 bg-[#0a0a0a] p-6 custom-scrollbar">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Sparkles className="w-6 h-6 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Quran Studio</h1>
          </div>
          <p className="text-zinc-500 text-sm">Professional Quranic Video Creator</p>
        </header>

        <div className="space-y-8">
          {/* Section: Content */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Video className="w-3 h-3" />
              <span>Content Selection</span>
            </div>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Surah</label>
                <select 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={config.surahId}
                  onChange={(e) => {
                    const sId = Number(e.target.value);
                    const s = surahs.find(surah => surah.id === sId);
                    setConfig({ 
                      ...config, 
                      surahId: sId, 
                      verseFrom: 1, 
                      verseTo: s?.verses_count || 7 
                    });
                  }}
                >
                  {surahs.map(s => (
                    <option key={s.id} value={s.id}>{s.id}. {s.name_simple} ({s.name_arabic})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">From Verse</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={currentSurah?.verses_count}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={config.verseFrom}
                    onChange={(e) => setConfig({ ...config, verseFrom: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">To Verse</label>
                  <input 
                    type="number" 
                    min={config.verseFrom} 
                    max={currentSurah?.verses_count}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={config.verseTo}
                    onChange={(e) => setConfig({ ...config, verseTo: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Reciter</label>
                <select 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={config.reciterId}
                  onChange={(e) => setConfig({ ...config, reciterId: Number(e.target.value) })}
                >
                  {reciters.map(r => (
                    <option key={r.id} value={r.id}>{r.reciter_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section: Multi-Background */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                <Layers className="w-3 h-3" />
                <span>Background Segments</span>
              </div>
              <button 
                onClick={addBackground}
                className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                Add Segment
              </button>
            </div>

            <div className="space-y-3">
              {config.backgrounds.map((bg, index) => (
                <div key={bg.id} className="p-4 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-4 hover:border-white/10 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-500">
                        {index + 1}
                      </div>
                      <span className="text-xs font-bold text-zinc-400 uppercase">Segment</span>
                    </div>
                    <button onClick={() => removeBackground(bg.id)} className="opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-[80px_1fr] gap-4">
                    <div 
                      onClick={() => document.getElementById(`bg-upload-${bg.id}`)?.click()}
                      className="aspect-square rounded-xl border border-dashed border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer overflow-hidden flex items-center justify-center relative bg-black/20"
                    >
                      {previews[bg.id] ? (
                        <img src={previews[bg.id]} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-4 h-4 text-zinc-600" />
                      )}
                      <input id={`bg-upload-${bg.id}`} type="file" className="hidden" accept="image/*,video/*" onChange={(e) => handleBgFileChange(bg.id, e)} />
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 uppercase font-bold">From</label>
                          <input 
                            type="number" 
                            className="w-full bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:ring-1 focus:ring-emerald-500 outline-none"
                            value={bg.verseFrom}
                            onChange={(e) => {
                              const newBgs = [...config.backgrounds];
                              newBgs[index].verseFrom = Number(e.target.value);
                              setConfig({ ...config, backgrounds: newBgs });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 uppercase font-bold">To</label>
                          <input 
                            type="number" 
                            className="w-full bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:ring-1 focus:ring-emerald-500 outline-none"
                            value={bg.verseTo}
                            onChange={(e) => {
                              const newBgs = [...config.backgrounds];
                              newBgs[index].verseTo = Number(e.target.value);
                              setConfig({ ...config, backgrounds: newBgs });
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-600 italic">
                        This background will be active from verse {bg.verseFrom} to {bg.verseTo}.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {config.backgrounds.length === 0 && (
                <div className="text-center py-8 rounded-2xl border border-dashed border-white/5 bg-zinc-900/20">
                  <p className="text-zinc-600 text-xs italic">No background segments added.</p>
                  <button onClick={addBackground} className="mt-2 text-emerald-500 text-xs font-bold hover:underline">Add your first segment</button>
                </div>
              )}
            </div>
          </section>

          {/* Section: Advanced Typography */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Type className="w-3 h-3" />
              <span>Advanced Typography</span>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Arabic Font</label>
                <select 
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={config.fontFamily}
                  onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
                >
                  {ARABIC_FONTS.map(font => (
                    <option key={font.id} value={font.id}>{font.label}</option>
                  ))}
                  <option value="Custom">Custom Uploaded Font</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Upload Custom Font (.ttf, .otf)</label>
                <div 
                  onClick={() => document.getElementById('font-upload')?.click()}
                  className="p-4 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/50 transition-all cursor-pointer flex items-center gap-3"
                >
                  <Upload className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-500">{customFontFile ? customFontFile.name : 'Choose font file...'}</span>
                  <input id="font-upload" type="file" className="hidden" accept=".ttf,.otf" onChange={handleFontChange} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Font Size ({config.fontSize}px)</label>
                <input 
                  type="range" min="24" max="120" step="2"
                  className="w-full accent-emerald-500"
                  value={config.fontSize}
                  onChange={(e) => setConfig({ ...config, fontSize: Number(e.target.value) })}
                />
              </div>
            </div>
          </section>

          {/* Section: Visual Effects */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Layers className="w-3 h-3" />
              <span>Visual Effects</span>
            </div>

            <div className="grid gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">Overlay Effect</label>
                <div className="grid grid-cols-2 gap-2">
                  {OVERLAYS.map(overlay => (
                    <button
                      key={overlay.id}
                      onClick={() => setConfig({ ...config, overlayType: overlay.id as any })}
                      className={cn(
                        "p-3 rounded-xl border transition-all text-xs font-medium",
                        config.overlayType === overlay.id 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                          : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                      )}
                    >
                      {overlay.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-300">Overlay Opacity</label>
                  <span className="text-xs text-zinc-500">{Math.round(config.overlayOpacity * 100)}%</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1"
                  className="w-full accent-emerald-500"
                  value={config.overlayOpacity}
                  onChange={(e) => setConfig({ ...config, overlayOpacity: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Droplets className="w-3 h-3" />
                    <label className="text-xs font-medium">Blur</label>
                  </div>
                  <input 
                    type="range" min="0" max="20" step="1"
                    className="w-full accent-emerald-500"
                    value={config.blurBackground}
                    onChange={(e) => setConfig({ ...config, blurBackground: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Sun className="w-3 h-3" />
                    <label className="text-xs font-medium">Brightness</label>
                  </div>
                  <input 
                    type="range" min="0" max="200" step="10"
                    className="w-full accent-emerald-500"
                    value={config.brightnessBackground}
                    onChange={(e) => setConfig({ ...config, brightnessBackground: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Aspect Ratio */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Layout className="w-3 h-3" />
              <span>Aspect Ratio & Platform</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map(ratio => (
                <button
                  key={ratio.id}
                  onClick={() => setConfig({ ...config, aspectRatio: ratio.id as any })}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                    config.aspectRatio === ratio.id 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                  )}
                >
                  <div className={cn(
                    "border-2 rounded-sm",
                    ratio.id === '9:16' ? 'w-4 h-7' : ratio.id === '16:9' ? 'w-7 h-4' : 'w-5 h-5',
                    config.aspectRatio === ratio.id ? 'border-emerald-500' : 'border-zinc-700'
                  )} />
                  <span className="text-[10px] font-bold uppercase tracking-tight">{ratio.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Section: Social Media */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Instagram className="w-3 h-3" />
              <span>Social Media Branding</span>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Platform</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'instagram', icon: <Instagram className="w-4 h-4" /> },
                    { id: 'tiktok', icon: <Music className="w-4 h-4" /> },
                    { id: 'youtube', icon: <Youtube className="w-4 h-4" /> },
                    { id: 'facebook', icon: <Facebook className="w-4 h-4" /> },
                  ].map(platform => (
                    <button
                      key={platform.id}
                      onClick={() => setConfig({ ...config, socialPlatform: platform.id as any })}
                      className={cn(
                        "p-3 rounded-xl border transition-all flex items-center justify-center",
                        config.socialPlatform === platform.id 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                          : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                      )}
                    >
                      {platform.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Social Handle</label>
                <input 
                  type="text" 
                  placeholder="@yourhandle"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={config.socialHandle}
                  onChange={(e) => setConfig({ ...config, socialHandle: e.target.value })}
                />
              </div>
            </div>
          </section>

          <div className="pt-8 pb-12">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-red-500">Generation Error</p>
                  <p className="text-xs text-red-400/80 leading-relaxed">{error}</p>
                </div>
              </motion.div>
            )}
            <button 
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating Video...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <main className="flex-1 h-screen flex flex-col items-center justify-center p-8 bg-[#050505] relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[120px] rounded-full" />
        </div>

        <div className="w-full max-w-4xl flex flex-col items-center gap-8 relative z-10">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <div className="p-2 glass rounded-lg">
                <Eye className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Studio Preview</h2>
                <p className="text-xs text-zinc-500">Real-time visualization of your configuration</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {jobStatus?.videoUrl && (
                <a 
                  href={jobStatus.videoUrl} 
                  download 
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download Video
                </a>
              )}
            </div>
          </div>

          {/* Video Mock Preview */}
          <div className={cn(
            "glass rounded-3xl overflow-hidden shadow-2xl relative group",
            ASPECT_RATIOS.find(r => r.id === config.aspectRatio)?.ratio,
            config.aspectRatio === '9:16' ? 'h-[70vh]' : 'w-full'
          )}>
            {/* Background */}
            <div className="absolute inset-0 bg-zinc-900 overflow-hidden">
              {firstBgPreview ? (
                <img 
                  src={firstBgPreview} 
                  className="w-full h-full object-cover transition-all duration-700" 
                  style={{ 
                    filter: `blur(${config.blurBackground}px) brightness(${config.brightnessBackground}%)` 
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-white/5" />
                </div>
              )}
              
              {/* Overlay Effects */}
              {config.overlayType !== 'none' && (
                <div 
                  className={cn(
                    "absolute inset-0 pointer-events-none transition-opacity duration-500",
                    config.overlayType === 'dust' && 'bg-[url("https://www.transparenttextures.com/patterns/stardust.png")]',
                    config.overlayType === 'bokeh' && 'bg-gradient-to-tr from-yellow-500/20 via-transparent to-purple-500/20',
                    config.overlayType === 'light_leaks' && 'bg-gradient-to-r from-orange-500/10 via-transparent to-blue-500/10'
                  )}
                  style={{ opacity: config.overlayOpacity }}
                />
              )}

              {/* Overlay for readability */}
              <div className="absolute inset-0 bg-black/40" />
            </div>

            {/* Content Preview */}
            <div className={cn(
              "absolute inset-0 p-12 flex flex-col justify-center items-center text-center",
              config.textPosition === 'top' && 'justify-start pt-20',
              config.textPosition === 'bottom' && 'justify-end pb-20',
            )}>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={config.surahId}
                className="space-y-6"
              >
                <h3 
                  className="font-amiri leading-relaxed transition-all duration-500"
                  style={{ 
                    fontSize: `${config.fontSize}px`, 
                    color: config.fontColor,
                    fontFamily: config.fontFamily === 'Custom' ? 'sans-serif' : config.fontFamily
                  }}
                >
                  {previewVerse.text}
                </h3>
                {config.showTranslation && (
                  <p className="text-white/80 text-lg font-medium max-w-md">
                    {previewVerse.translation}
                  </p>
                )}
              </motion.div>
            </div>

            {/* Branding */}
            <div className="absolute bottom-8 left-0 w-full flex justify-center">
              <div className="glass px-4 py-2 rounded-full flex items-center gap-2">
                {config.socialPlatform === 'instagram' && <Instagram className="w-3 h-3" />}
                {config.socialPlatform === 'youtube' && <Youtube className="w-3 h-3" />}
                <span className="text-[10px] font-bold tracking-wider uppercase">{config.socialHandle}</span>
              </div>
            </div>

            {/* Progress Bar Mock */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
              <div className="h-full bg-emerald-500 w-1/3" />
            </div>
          </div>

          {/* Job Status Overlay */}
          <AnimatePresence>
            {jobStatus && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
              >
                <div className="w-full max-w-md glass p-8 rounded-3xl space-y-6 text-center">
                  {jobStatus.status === 'processing' && (
                    <>
                      <div className="relative w-24 h-24 mx-auto">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                          <circle className="text-white/10 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                          <motion.circle 
                            className="text-emerald-500 stroke-current" 
                            strokeWidth="8" 
                            strokeLinecap="round" 
                            fill="transparent" 
                            r="40" cx="50" cy="50"
                            initial={{ strokeDasharray: "0 251" }}
                            animate={{ strokeDasharray: `${(jobStatus.progress / 100) * 251} 251` }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold">{jobStatus.progress}%</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-xl font-bold">Rendering Video</h3>
                          <p className="text-emerald-500 text-sm font-bold uppercase tracking-widest">{jobStatus.stage}</p>
                        </div>
                        
                        {/* Detailed Progress Bar */}
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${jobStatus.progress}%` }}
                          />
                        </div>
                        
                        <p className="text-zinc-400 text-xs">Please wait while we process your high-quality video. This may take a moment.</p>
                      </div>
                    </>
                  )}

                  {jobStatus.status === 'completed' && (
                    <>
                      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
                        <video 
                          src={jobStatus.videoUrl} 
                          controls 
                          autoPlay
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Video Ready!</h3>
                        <p className="text-zinc-400 text-sm">Your Quranic video has been successfully generated and is ready for viewing and download.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <a 
                          href={jobStatus.videoUrl} 
                          download 
                          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                          <Download className="w-5 h-5" />
                          Download
                        </a>
                        <button 
                          onClick={() => setJobStatus(null)}
                          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all"
                        >
                          Create Another
                        </button>
                      </div>
                    </>
                  )}

                  {jobStatus.status === 'failed' && (
                    <>
                      <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Generation Failed</h3>
                        <p className="text-zinc-400 text-sm">{jobStatus.error || "An unexpected error occurred during processing."}</p>
                      </div>
                      <button 
                        onClick={() => setJobStatus(null)}
                        className="w-full bg-zinc-800 text-white font-bold py-3 rounded-xl"
                      >
                        Try Again
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

