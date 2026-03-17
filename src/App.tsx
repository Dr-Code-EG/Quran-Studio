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

const FILTERS = [
  { id: 'none', label: 'Original' },
  { id: 'grayscale', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'vibrant', label: 'Vibrant' },
];

const TRANSITIONS = [
  { id: 'fade', label: 'Fade' },
  { id: 'slide', label: 'Slide' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'blur_fade', label: 'Blur Fade' },
  { id: 'none', label: 'None' },
];

const TEMPLATES = [
  { 
    id: 'tiktok_classic', 
    label: 'TikTok Classic', 
    config: { 
      aspectRatio: '9:16', 
      fontSize: 64, 
      fontFamily: 'Amiri', 
      overlayType: 'dust', 
      overlayOpacity: 0.3,
      blurBackground: 2,
      brightnessBackground: 80,
      showMetadata: true,
      transitionType: 'fade'
    } 
  },
  { 
    id: 'youtube_cinematic', 
    label: 'YouTube Cinematic', 
    config: { 
      aspectRatio: '16:9', 
      fontSize: 72, 
      fontFamily: 'Scheherazade', 
      overlayType: 'light_leaks', 
      overlayOpacity: 0.4,
      blurBackground: 5,
      brightnessBackground: 70,
      showMetadata: true,
      transitionType: 'zoom'
    } 
  },
  { 
    id: 'insta_minimal', 
    label: 'Insta Minimal', 
    config: { 
      aspectRatio: '1:1', 
      fontSize: 56, 
      fontFamily: 'Noto Sans Arabic', 
      overlayType: 'none', 
      overlayOpacity: 0,
      blurBackground: 0,
      brightnessBackground: 100,
      showMetadata: false,
      transitionType: 'slide'
    } 
  },
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
    translationLanguage: 'en',
    reciterVolume: 1.0,
    socialHandle: '@quranstudio',
    socialPlatform: 'instagram',
    blurBackground: 0,
    brightnessBackground: 100,
    overlayType: 'none',
    overlayOpacity: 0.5,
    transitionType: 'fade',
    motionEffect: false,
    showMetadata: true,
    showTranslation: true,
    filter: 'none',
    textAlign: 'center',
    backgrounds: [],
  });

  const [customFontFile, setCustomFontFile] = useState<File | null>(null);
  const [bgFiles, setBgFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewVerse, setPreviewVerse] = useState({ text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.' });

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/verse-preview?surahId=${config.surahId}&verseFrom=${config.verseFrom}`);
        setPreviewVerse(res.data);
      } catch (error) {
        console.error("Failed to fetch preview verse", error);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [config.surahId, config.verseFrom]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const pollStatus = async () => {
      if (!jobStatus || jobStatus.status !== 'processing' || !isMounted) return;

      try {
        const res = await axios.get(`/api/job-status/${jobStatus.id}`);
        if (!isMounted) return;

        setJobStatus(res.data);
        
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          setGenerating(false);
        } else {
          // Schedule next poll only if still processing
          timeoutId = setTimeout(pollStatus, 5000);
        }
      } catch (error: any) {
        if (!isMounted) return;
        console.error("Failed to check job status", error);
        
        // If we hit rate limiting, wait longer before next poll
        const delay = error.response?.status === 429 ? 10000 : 5000;
        timeoutId = setTimeout(pollStatus, delay);
      }
    };

    if (jobStatus && jobStatus.status === 'processing') {
      timeoutId = setTimeout(pollStatus, 5000);
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
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
    setGenerating(true);
    setJobStatus(null);
    setError(null);
    
    const formData = new FormData();
    formData.append('config', JSON.stringify(config));
    
    // Append backgrounds in order
    config.backgrounds.forEach((bg, index) => {
      if (bgFiles[bg.id]) {
        formData.append('backgrounds', bgFiles[bg.id]);
      }
    });

    if (customFontFile) formData.append('customFont', customFontFile);

    try {
      const res = await axios.post('/api/generate', formData);
      setJobStatus({ id: res.data.jobId, status: 'processing', progress: 0, stage: 'Initializing' });
    } catch (err: any) {
      console.error("Generation failed", err);
      setError(err.response?.data?.error || "Failed to start video generation. Please check your server logs.");
      setGenerating(false);
    }
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

  const applyTemplate = (templateConfig: any) => {
    setConfig({ ...config, ...templateConfig });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-[#050505]">
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
          {/* Section: Templates */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              <span>Quick Templates</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.config)}
                  className="p-3 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-300 group-hover:text-emerald-500">{template.label}</span>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500" />
                  </div>
                </button>
              ))}
            </div>
          </section>
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Text Alignment</label>
                <div className="flex gap-2">
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => setConfig({ ...config, textAlign: align })}
                      className={cn(
                        "flex-1 p-2 rounded-lg border transition-all text-xs font-medium capitalize",
                        config.textAlign === align 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                          : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                      )}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-white/5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Show Surah & Verse</label>
                  <p className="text-[10px] text-zinc-500">Display metadata at the bottom</p>
                </div>
                <button 
                  onClick={() => setConfig({ ...config, showMetadata: !config.showMetadata })}
                  className={cn(
                    "w-10 h-5 rounded-full transition-all relative",
                    config.showMetadata ? "bg-emerald-500" : "bg-zinc-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                    config.showMetadata ? "left-6" : "left-1"
                  )} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-white/5">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-300">Show Translation</label>
                  <p className="text-[10px] text-zinc-500">Display verse translation</p>
                </div>
                <button 
                  onClick={() => setConfig({ ...config, showTranslation: !config.showTranslation })}
                  className={cn(
                    "w-10 h-5 rounded-full transition-all relative",
                    config.showTranslation ? "bg-emerald-500" : "bg-zinc-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                    config.showTranslation ? "left-6" : "left-1"
                  )} />
                </button>
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
                <label className="text-sm font-medium text-zinc-300">Background Filter</label>
                <div className="grid grid-cols-3 gap-2">
                  {FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setConfig({ ...config, filter: f.id as any })}
                      className={cn(
                        "p-2 rounded-lg border transition-all text-[10px] font-medium",
                        config.filter === f.id 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                          : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">Transition Effect</label>
                <div className="grid grid-cols-3 gap-2">
                  {TRANSITIONS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setConfig({ ...config, transitionType: t.id as any })}
                      className={cn(
                        "p-2 rounded-lg border transition-all text-[10px] font-bold uppercase",
                        config.transitionType === t.id 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                          : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

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
              <button 
                onClick={() => window.open('/api/test-canvas', '_blank')}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 text-white rounded-xl font-bold text-xs hover:bg-zinc-700 transition-all"
              >
                Test Canvas
              </button>
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
                {config.showMetadata && (
                  <div className="pt-4 flex flex-col items-center">
                    <div className="h-px w-12 bg-white/20 mb-4" />
                    <p className="text-white/60 text-sm font-bold tracking-widest uppercase">
                      {currentSurah?.name_simple} • Verse {config.verseFrom}
                    </p>
                  </div>
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

