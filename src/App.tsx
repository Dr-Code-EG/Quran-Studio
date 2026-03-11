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
  Droplets,
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
    backgrounds: [],
  });

  const [customFontFile, setCustomFontFile] = useState<File | null>(null);
  const [bgFiles, setBgFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewVerse, setPreviewVerse] = useState({
    text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
  });

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/verse-preview?surahId=${config.surahId}&verseFrom=${config.verseFrom}`);
        setPreviewVerse(res.data);
      } catch (error) {
        console.error('Failed to fetch preview verse', error);
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
        const res = await axios.get(`/api/job-status?jobId=${jobStatus.id}`);
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
        console.error('Failed to check job status', error);

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
        { id, verseFrom: config.verseFrom, verseTo: config.verseTo, type: 'image' },
      ],
    });
  };

  const removeBackground = (id: string) => {
    setConfig({
      ...config,
      backgrounds: config.backgrounds.filter(bg => bg.id !== id),
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
      console.error('Generation failed', err);
      setError(err.response?.data?.error || 'Failed to start video generation. Please check your server logs.');
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
                  onChange={e => {
                    const sId = Number(e.target.value);
                    const s = surahs.find(surah => surah.id === sId);
                    setConfig({
                      ...config,
                      surahId: sId,
                      verseFrom: 1,
                      verseTo: s?.verses_count || 7,
                    });
                  }}
                >
                  {surahs.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.id}. {s.name_simple} ({s.name_arabic})
                    </option>
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
                    onChange={e => setConfig({ ...config, verseFrom: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">To Verse</label>
                  <input
                    type="number"
                    min={1}
                    max={currentSurah?.verses_count}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={config.verseTo}
                    onChange={e => setConfig({ ...config, verseTo: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Reciter</label>
                <select
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={config.reciterId}
                  onChange={e => setConfig({ ...config, reciterId: Number(e.target.value) })}
                >
                  {reciters.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section: Aspect Ratio */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Monitor className="w-3 h-3" />
              <span>Format</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map(ar => (
                <button
                  key={ar.id}
                  onClick={() => setConfig({ ...config, aspectRatio: ar.id })}
                  className={cn(
                    'p-3 rounded-lg border transition-all flex flex-col items-center gap-1 text-xs font-medium',
                    config.aspectRatio === ar.id
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'border-white/10 text-zinc-400 hover:border-white/20'
                  )}
                >
                  {ar.icon}
                  <span className="text-[10px]">{ar.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Section: Typography */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Type className="w-3 h-3" />
              <span>Typography</span>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Font Family</label>
                <select
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={config.fontFamily}
                  onChange={e => setConfig({ ...config, fontFamily: e.target.value })}
                >
                  {ARABIC_FONTS.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                  <option value="Custom">Upload Custom Font</option>
                </select>
              </div>

              {config.fontFamily === 'Custom' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Font File</label>
                  <label className="flex items-center justify-center w-full px-4 py-3 border border-dashed border-white/10 rounded-xl cursor-pointer hover:border-emerald-500/50 transition-all">
                    <input type="file" className="hidden" accept=".ttf,.otf" onChange={handleFontChange} />
                    <span className="text-xs text-zinc-400">
                      {customFontFile ? customFontFile.name : 'Click to upload font file'}
                    </span>
                  </label>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Font Size: {config.fontSize}px</label>
                <input
                  type="range"
                  min={24}
                  max={120}
                  className="w-full"
                  value={config.fontSize}
                  onChange={e => setConfig({ ...config, fontSize: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Font Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-12 h-10 rounded-lg cursor-pointer"
                    value={config.fontColor}
                    onChange={e => setConfig({ ...config, fontColor: e.target.value })}
                  />
                  <span className="text-xs text-zinc-400">{config.fontColor}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Visual Effects */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Layers className="w-3 h-3" />
              <span>Visual Effects</span>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Background Blur: {config.blurBackground}</label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  className="w-full"
                  value={config.blurBackground}
                  onChange={e => setConfig({ ...config, blurBackground: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Brightness: {config.brightnessBackground}%</label>
                <input
                  type="range"
                  min={50}
                  max={150}
                  className="w-full"
                  value={config.brightnessBackground}
                  onChange={e => setConfig({ ...config, brightnessBackground: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Overlay Effect</label>
                <select
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={config.overlayType}
                  onChange={e => setConfig({ ...config, overlayType: e.target.value })}
                >
                  {OVERLAYS.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {config.overlayType !== 'none' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">Overlay Opacity: {Math.round(config.overlayOpacity * 100)}%</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                    value={config.overlayOpacity}
                    onChange={e => setConfig({ ...config, overlayOpacity: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Section: Backgrounds */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                <Upload className="w-3 h-3" />
                <span>Backgrounds</span>
              </div>
              <button
                onClick={addBackground}
                className="p-1 hover:bg-white/5 rounded-lg transition-all"
                title="Add background"
              >
                <Plus className="w-4 h-4 text-emerald-500" />
              </button>
            </div>

            <div className="space-y-3">
              {config.backgrounds.map((bg, idx) => (
                <div key={bg.id} className="p-3 bg-zinc-900/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400">Background {idx + 1}</span>
                    <button
                      onClick={() => removeBackground(bg.id)}
                      className="p-1 hover:bg-red-500/20 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <input
                      type="number"
                      placeholder="From"
                      min={1}
                      className="bg-zinc-800 border border-white/10 rounded px-2 py-1"
                      value={bg.verseFrom}
                      onChange={e => {
                        const updated = config.backgrounds.map(b =>
                          b.id === bg.id ? { ...b, verseFrom: Number(e.target.value) } : b
                        );
                        setConfig({ ...config, backgrounds: updated });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="To"
                      min={1}
                      className="bg-zinc-800 border border-white/10 rounded px-2 py-1"
                      value={bg.verseTo}
                      onChange={e => {
                        const updated = config.backgrounds.map(b =>
                          b.id === bg.id ? { ...b, verseTo: Number(e.target.value) } : b
                        );
                        setConfig({ ...config, backgrounds: updated });
                      }}
                    />
                  </div>

                  <label className="flex items-center justify-center w-full px-3 py-2 border border-dashed border-white/10 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-all">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={e => handleBgFileChange(bg.id, e)}
                    />
                    {previews[bg.id] ? (
                      <img src={previews[bg.id]} alt="preview" className="w-full h-20 object-cover rounded" />
                    ) : (
                      <span className="text-xs text-zinc-400">Click to upload image</span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Social Branding */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Instagram className="w-3 h-3" />
              <span>Social Branding</span>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Platform</label>
                <select
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={config.socialPlatform}
                  onChange={e => setConfig({ ...config, socialPlatform: e.target.value })}
                >
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Handle</label>
                <input
                  type="text"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={config.socialHandle}
                  onChange={e => setConfig({ ...config, socialHandle: e.target.value })}
                  placeholder="@yourhandle"
                />
              </div>
            </div>
          </section>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={cn(
              'w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
              generating
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black'
            )}
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Generate Video
              </>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main - Preview */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[#050505]">
        <div
          className={cn(
            'relative overflow-hidden rounded-3xl shadow-2xl border border-white/10',
            ASPECT_RATIOS.find(ar => ar.id === config.aspectRatio)?.ratio
          )}
          style={{ maxWidth: '100%', maxHeight: '80vh' }}
        >
          {/* Background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: firstBgPreview ? `url(${firstBgPreview})` : 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(${config.blurBackground}px) brightness(${config.brightnessBackground}%)`,
            }}
          />

          {/* Overlay Effects */}
          {config.overlayType !== 'none' && (
            <div
              className={cn(
                'absolute inset-0 pointer-events-none transition-opacity duration-500',
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
        <div
          className={cn(
            'absolute inset-0 p-12 flex flex-col justify-center items-center text-center',
            config.textPosition === 'top' && 'justify-start pt-20',
            config.textPosition === 'bottom' && 'justify-end pb-20'
          )}
        >
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
                fontFamily: config.fontFamily === 'Custom' ? 'sans-serif' : config.fontFamily,
              }}
            >
              {previewVerse.text}
            </h3>
            {config.showTranslation && (
              <p className="text-white/80 text-lg font-medium max-w-md">{previewVerse.translation}</p>
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
      </main>

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
                        r="40"
                        cx="50"
                        cy="50"
                        initial={{ strokeDasharray: '0 251' }}
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
                    <video src={jobStatus.videoUrl} controls autoPlay className="w-full h-full object-contain" />
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
                    <p className="text-zinc-400 text-sm">{jobStatus.error || 'An unexpected error occurred during processing.'}</p>
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
  );
}
