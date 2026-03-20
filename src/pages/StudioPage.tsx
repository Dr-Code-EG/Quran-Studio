import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Book, Maximize2, Layers, Type, AtSign, Settings, Sparkles, ChevronRight, Film } from 'lucide-react'
import { useStudio } from '../context/StudioContext'

const ASPECT_RATIOS = [
  { value: '9:16' as const, label: '9:16', desc: 'TikTok / Reels' },
  { value: '16:9' as const, label: '16:9', desc: 'YouTube' },
  { value: '1:1' as const, label: '1:1', desc: 'Instagram' },
]
const OVERLAYS = [
  { value: 'none' as const, label: 'None' },
  { value: 'dust' as const, label: 'Dust' },
  { value: 'bokeh' as const, label: 'Bokeh' },
  { value: 'lightleaks' as const, label: 'Light Leaks' },
]
const TEXT_POSITIONS = [
  { value: 'top' as const, label: 'Top' },
  { value: 'center' as const, label: 'Center' },
  { value: 'bottom' as const, label: 'Bottom' },
]
const PLATFORMS = [
  { value: 'none' as const, label: 'None' },
  { value: 'instagram' as const, label: 'Instagram' },
  { value: 'tiktok' as const, label: 'TikTok' },
  { value: 'youtube' as const, label: 'YouTube' },
  { value: 'twitter' as const, label: 'Twitter' },
]
const TEXT_COLORS = ['#FFFFFF', '#F0E6CC', '#FFD700', '#87CEEB', '#98FB98']

async function fetchSurahs() {
  const res = await fetch('/api/quran/surahs')
  if (!res.ok) throw new Error('Failed')
  return res.json() as Promise<{ surahs: Array<{ id: number; nameSimple: string; nameArabic: string; translatedName: string; versesCount: number }> }>
}
async function fetchReciters() {
  const res = await fetch('/api/quran/reciters')
  if (!res.ok) throw new Error('Failed')
  return res.json() as Promise<{ reciters: Array<{ id: number; name: string; style: string }> }>
}

export default function StudioPage() {
  const navigate = useNavigate()
  const { config, updateSettings } = useStudio()
  const [generating, setGenerating] = useState(false)

  const { data: surahsData } = useQuery({ queryKey: ['surahs'], queryFn: fetchSurahs })
  const { data: recitersData } = useQuery({ queryKey: ['reciters'], queryFn: fetchReciters })

  const currentSurah = surahsData?.surahs.find(s => s.id === config.surahId)
  const currentReciter = recitersData?.reciters.find(r => r.id === config.reciterId)

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surahId: config.surahId,
          fromVerse: config.fromVerse,
          toVerse: config.toVerse,
          reciterId: config.reciterId,
          translationId: config.translationId,
          settings: config.settings,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const job = await res.json() as { id: string }
      navigate(`/job/${job.id}`)
    } catch {
      alert('Failed to create job. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-deep-blue">
      {/* Header */}
      <div className="px-5 pt-6 pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Quran Studio</h1>
          <p className="text-xs text-text-muted mt-0.5">Create beautiful recitation videos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/library')}
            className="w-10 h-10 rounded-full bg-card border border-border-blue flex items-center justify-center text-gold hover:bg-surface transition-colors"
          >
            <Film size={18} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-card border border-border-blue flex items-center justify-center text-text-secondary hover:bg-surface transition-colors"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">

        {/* Quran Content */}
        <Card title="Quran Content" icon={<Book size={14} />}>
          <button
            onClick={() => navigate('/surah-picker')}
            className="w-full flex items-center justify-between bg-surface rounded-xl p-4 border border-border-blue hover:border-gold/40 transition-colors"
          >
            <div className="text-left">
              <p className="font-arabic text-xl text-gold-light">{currentSurah?.nameArabic || 'الفاتحة'}</p>
              <p className="font-semibold text-text-primary mt-1">{config.surahName}</p>
              <p className="text-xs text-text-muted mt-0.5">{currentSurah?.translatedName} • {currentSurah?.versesCount} verses</p>
            </div>
            <ChevronRight size={18} className="text-text-muted" />
          </button>

          <div className="flex bg-surface rounded-xl border border-border-blue overflow-hidden mt-2">
            {[
              { label: 'From Verse', val: config.fromVerse },
              { label: 'To Verse', val: config.toVerse },
              { label: 'Total', val: config.toVerse - config.fromVerse + 1, accent: true },
            ].map((item, i) => (
              <div key={i} className={`flex-1 py-3 flex flex-col items-center ${i < 2 ? 'border-r border-border-blue' : ''}`}>
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{item.label}</span>
                <span className={`text-xl font-bold mt-1 ${item.accent ? 'text-gold' : 'text-text-primary'}`}>{item.val}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/reciter-picker')}
            className="w-full flex items-center justify-between bg-surface rounded-xl p-4 border border-border-blue hover:border-gold/40 transition-colors mt-2"
          >
            <div className="text-left">
              <p className="font-semibold text-text-primary">{config.reciterName}</p>
              <p className="text-xs text-text-muted mt-0.5">{currentReciter?.style || 'Murattal'}</p>
            </div>
            <ChevronRight size={18} className="text-text-muted" />
          </button>
        </Card>

        {/* Video Format */}
        <Card title="Video Format" icon={<Maximize2 size={14} />}>
          <div className="grid grid-cols-3 gap-2">
            {ASPECT_RATIOS.map(ar => (
              <button
                key={ar.value}
                onClick={() => updateSettings({ aspectRatio: ar.value })}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                  config.settings.aspectRatio === ar.value
                    ? 'bg-gold border-gold text-deep-blue'
                    : 'bg-surface border-border-blue text-text-secondary hover:border-gold/40'
                }`}
              >
                <span className="font-bold text-sm">{ar.label}</span>
                <span className={`text-[10px] mt-1 ${config.settings.aspectRatio === ar.value ? 'text-deep-blue/80' : 'text-text-muted'}`}>{ar.desc}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Visual Effects */}
        <Card title="Visual Effects" icon={<Layers size={14} />}>
          <div>
            <p className="text-xs text-text-secondary mb-2">Overlay Effect</p>
            <div className="flex flex-wrap gap-2">
              {OVERLAYS.map(ov => (
                <button
                  key={ov.value}
                  onClick={() => updateSettings({ overlayType: ov.value })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    config.settings.overlayType === ov.value
                      ? 'bg-gold border-gold text-deep-blue'
                      : 'bg-surface border-border-blue text-text-secondary hover:border-gold/40'
                  }`}
                >
                  {ov.label}
                </button>
              ))}
            </div>
          </div>
          <SliderField
            label="Background Blur"
            value={config.settings.backgroundBlur}
            min={0} max={20} step={1}
            display={`${config.settings.backgroundBlur}px`}
            onChange={v => updateSettings({ backgroundBlur: v })}
          />
          <SliderField
            label="Brightness"
            value={config.settings.backgroundBrightness}
            min={0.3} max={1.5} step={0.05}
            display={`${Math.round(config.settings.backgroundBrightness * 100)}%`}
            onChange={v => updateSettings({ backgroundBrightness: v })}
          />
        </Card>

        {/* Typography */}
        <Card title="Typography" icon={<Type size={14} />}>
          <SliderField
            label="Font Size"
            value={config.settings.fontSize}
            min={24} max={72} step={2}
            display={`${config.settings.fontSize}px`}
            onChange={v => updateSettings({ fontSize: v })}
          />
          <div>
            <p className="text-xs text-text-secondary mb-2">Text Position</p>
            <div className="flex gap-2">
              {TEXT_POSITIONS.map(pos => (
                <button
                  key={pos.value}
                  onClick={() => updateSettings({ textPosition: pos.value })}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                    config.settings.textPosition === pos.value
                      ? 'bg-gold border-gold text-deep-blue'
                      : 'bg-surface border-border-blue text-text-secondary'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-text-secondary">Text Color</p>
            <div className="flex gap-2">
              {TEXT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateSettings({ textColor: c })}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    config.settings.textColor === c ? 'border-gold scale-110' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </div>
        </Card>

        {/* Branding */}
        <Card title="Branding" icon={<AtSign size={14} />}>
          <div>
            <p className="text-xs text-text-secondary mb-2">Platform</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(pl => (
                <button
                  key={pl.value}
                  onClick={() => updateSettings({ brandingPlatform: pl.value })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    config.settings.brandingPlatform === pl.value
                      ? 'bg-gold border-gold text-deep-blue'
                      : 'bg-surface border-border-blue text-text-secondary'
                  }`}
                >
                  {pl.label}
                </button>
              ))}
            </div>
          </div>
          {config.settings.brandingPlatform !== 'none' && (
            <div className="flex items-center gap-2 bg-surface rounded-xl p-3 border border-border-blue mt-1">
              <span className="text-gold font-semibold">@</span>
              <span className="text-text-primary flex-1">{config.settings.brandingHandle || 'yourusername'}</span>
              <button
                onClick={() => navigate('/settings')}
                className="text-xs text-gold hover:underline"
              >
                Edit
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Generate Button */}
      <div className="px-4 pt-3 pb-4 border-t border-border-blue bg-deep-blue flex-shrink-0">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`w-full flex items-center justify-center gap-3 bg-gold text-deep-blue font-bold text-base py-4 rounded-2xl transition-all ${
            generating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gold-light active:scale-[0.98]'
          }`}
        >
          {generating ? (
            <span className="animate-spin">◌</span>
          ) : (
            <Sparkles size={20} />
          )}
          {generating ? 'Creating Job...' : 'Generate Video'}
        </button>
      </div>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border-blue space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-gold">{icon}</span>
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">{title}</span>
      </div>
      {children}
    </div>
  )
}

function SliderField({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs text-text-secondary">{label}</p>
        <span className="text-xs font-semibold text-gold">{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-gold"
        style={{ accentColor: '#C8993A' }}
      />
    </div>
  )
}
