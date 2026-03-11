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
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Surah, Reciter, VideoConfig, JobStatus } from './types';

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

export default function App() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  
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
  });

  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [surahsRes, recitersRes] = await Promise.all([
          axios.get('/api/surahs'),
          axios.get('/api/reciters')
        ]);
        setSurahs(surahsRes.data.chapters);
        setReciters(recitersRes.data.recitations);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (jobStatus && jobStatus.status === 'processing') {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`/api/job-status/${jobStatus.id}`);
          setJobStatus(res.data);
          if (res.data.status === 'completed' || res.data.status === 'failed') {
            clearInterval(interval);
            setGenerating(false);
          }
        } catch (error) {
          console.error("Failed to check job status", error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBgFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setBgPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setJobStatus(null);
    
    const formData = new FormData();
    formData.append('config', JSON.stringify(config));
    if (bgFile) formData.append('background', bgFile);

    try {
      const res = await axios.post('/api/generate', formData);
      setJobStatus({ id: res.data.jobId, status: 'processing', progress: 0 });
    } catch (error) {
      console.error("Generation failed", error);
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
          <p className="text-zinc-500 text-sm">Create professional Quranic videos in seconds.</p>
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
                  onChange={(e) => setConfig({ ...config, surahId: Number(e.target.value), verseFrom: 1, verseTo: surahs.find(s => s.id === Number(e.target.value))?.verses_count || 7 })}
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

          {/* Section: Visuals */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Layout className="w-3 h-3" />
              <span>Visual Settings</span>
            </div>

            <div className="grid gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      onClick={() => setConfig({ ...config, aspectRatio: ratio.id as any })}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                        config.aspectRatio === ratio.id 
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                          : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                      )}
                    >
                      {ratio.icon}
                      <span className="text-[10px] font-bold uppercase tracking-tighter">{ratio.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">Background</label>
                <div 
                  onClick={() => document.getElementById('bg-upload')?.click()}
                  className="group relative h-32 rounded-2xl border-2 border-dashed border-white/10 bg-zinc-900/50 hover:bg-zinc-900 hover:border-emerald-500/50 transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center gap-2"
                >
                  {bgPreview ? (
                    <img src={bgPreview} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
                  ) : (
                    <Upload className="w-6 h-6 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                  )}
                  <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-300 relative z-10">
                    {bgFile ? bgFile.name : 'Upload Image/Video'}
                  </span>
                  <input id="bg-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/*,video/*" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-300">Theme Preset</label>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setConfig({ ...config, theme: theme.id })}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-xl border transition-all text-xs font-medium",
                        config.theme === theme.id 
                          ? "bg-white/10 border-white/20 text-white" 
                          : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", theme.color)} />
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>
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
                <label className="text-sm font-medium text-zinc-300">Font Size ({config.fontSize}px)</label>
                <input 
                  type="range" min="24" max="120" step="2"
                  className="w-full accent-emerald-500"
                  value={config.fontSize}
                  onChange={(e) => setConfig({ ...config, fontSize: Number(e.target.value) })}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-white/5">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Show Translation</p>
                  <p className="text-[10px] text-zinc-500">English, Arabic, etc.</p>
                </div>
                <button 
                  onClick={() => setConfig({ ...config, showTranslation: !config.showTranslation })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    config.showTranslation ? "bg-emerald-500" : "bg-zinc-700"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    config.showTranslation ? "left-7" : "left-1"
                  )} />
                </button>
              </div>
            </div>
          </section>

          {/* Section: Social */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" />
              <span>Social & Branding</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">Social Handle</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="@username"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={config.socialHandle}
                    onChange={(e) => setConfig({ ...config, socialHandle: e.target.value })}
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                    {config.socialPlatform === 'instagram' && <Instagram className="w-4 h-4" />}
                    {config.socialPlatform === 'youtube' && <Youtube className="w-4 h-4" />}
                    {config.socialPlatform === 'twitter' && <Twitter className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {['instagram', 'youtube', 'twitter', 'facebook'].map(platform => (
                  <button
                    key={platform}
                    onClick={() => setConfig({ ...config, socialPlatform: platform })}
                    className={cn(
                      "p-3 rounded-xl border transition-all flex justify-center",
                      config.socialPlatform === platform 
                        ? "bg-white/10 border-white/20 text-white" 
                        : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20"
                    )}
                  >
                    {platform === 'instagram' && <Instagram className="w-4 h-4" />}
                    {platform === 'youtube' && <Youtube className="w-4 h-4" />}
                    {platform === 'twitter' && <Twitter className="w-4 h-4" />}
                    {platform === 'facebook' && <Facebook className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="pt-8 pb-12">
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

          {/* Video Mock Preview */}
          <div className={cn(
            "glass rounded-3xl overflow-hidden shadow-2xl relative group",
            ASPECT_RATIOS.find(r => r.id === config.aspectRatio)?.ratio,
            config.aspectRatio === '9:16' ? 'h-[70vh]' : 'w-full'
          )}>
            {/* Background */}
            <div className="absolute inset-0 bg-zinc-900">
              {bgPreview ? (
                <img src={bgPreview} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-white/5" />
                </div>
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
                  className="font-amiri leading-relaxed"
                  style={{ fontSize: `${config.fontSize}px`, color: config.fontColor }}
                >
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </h3>
                {config.showTranslation && (
                  <p className="text-white/80 text-lg font-medium max-w-md">
                    In the name of Allah, the Entirely Merciful, the Especially Merciful.
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
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Rendering Video</h3>
                        <p className="text-zinc-400 text-sm">Please wait while we process your high-quality video. This may take a moment.</p>
                      </div>
                    </>
                  )}

                  {jobStatus.status === 'completed' && (
                    <>
                      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Video Ready!</h3>
                        <p className="text-zinc-400 text-sm">Your Quranic video has been successfully generated and is ready for download.</p>
                      </div>
                      <div className="flex flex-col gap-3">
                        <a 
                          href={jobStatus.videoUrl} 
                          download 
                          className="w-full bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                        >
                          <Download className="w-5 h-5" />
                          Download Now
                        </a>
                        <button 
                          onClick={() => setJobStatus(null)}
                          className="w-full bg-zinc-800 text-white font-bold py-3 rounded-xl"
                        >
                          Close
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

