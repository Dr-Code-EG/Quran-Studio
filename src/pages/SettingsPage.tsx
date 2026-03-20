import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { useStudio } from '../context/StudioContext'

const PLATFORMS = [
  { value: 'none' as const, label: 'None' },
  { value: 'instagram' as const, label: 'Instagram' },
  { value: 'tiktok' as const, label: 'TikTok' },
  { value: 'youtube' as const, label: 'YouTube' },
  { value: 'twitter' as const, label: 'Twitter' },
]
const TRANSLATIONS = [
  { id: '131', name: 'Saheeh International' },
  { id: '20', name: 'Pickthall' },
  { id: '85', name: 'Clear Quran (Khattab)' },
  { id: '95', name: 'Dr. Mustafa Khattab' },
  { id: '57', name: 'Maududi (English)' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { config, updateConfig, updateSettings, resetConfig } = useStudio()
  const [handle, setHandle] = useState(config.settings.brandingHandle)

  const handleSave = () => {
    updateSettings({ brandingHandle: handle })
    navigate(-1)
  }

  return (
    <div className="h-full flex flex-col bg-deep-blue">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-border-blue flex-shrink-0">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-card border border-border-blue flex items-center justify-center text-text-primary">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
        <button onClick={handleSave} className="bg-gold text-deep-blue font-semibold px-4 py-2 rounded-xl text-sm">
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Branding */}
        <section className="bg-card rounded-2xl p-4 border border-border-blue space-y-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Branding</p>
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">Social Handle</p>
            <div className="flex items-center bg-surface rounded-xl border border-border-blue px-4 overflow-hidden">
              <span className="text-gold font-semibold text-lg mr-1">@</span>
              <input
                value={handle} onChange={e => setHandle(e.target.value)}
                placeholder="yourusername"
                className="flex-1 h-12 bg-transparent text-text-primary text-sm outline-none placeholder-text-muted"
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">Platform</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(pl => (
                <button
                  key={pl.value}
                  onClick={() => updateSettings({ brandingPlatform: pl.value })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    config.settings.brandingPlatform === pl.value
                      ? 'bg-gold border-gold text-deep-blue'
                      : 'bg-surface border-border-blue text-text-secondary hover:border-gold/40'
                  }`}
                >
                  {pl.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Translation */}
        <section className="bg-card rounded-2xl p-4 border border-border-blue space-y-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">Translation</p>
          <div className="space-y-2">
            {TRANSLATIONS.map(tr => (
              <button
                key={tr.id}
                onClick={() => updateConfig({ translationId: tr.id })}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                  config.translationId === tr.id ? 'border-gold bg-gold/10' : 'border-border-blue bg-surface hover:border-gold/30'
                }`}
              >
                <span className={`text-sm ${config.translationId === tr.id ? 'text-gold-light font-medium' : 'text-text-primary'}`}>
                  {tr.name}
                </span>
                {config.translationId === tr.id && <span className="text-gold text-lg">✓</span>}
              </button>
            ))}
          </div>
        </section>

        {/* Reset */}
        <button
          onClick={() => { if (confirm('Reset all settings?')) { resetConfig(); navigate('/') } }}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <RefreshCcw size={16} />
          <span className="font-medium text-sm">Reset All Settings</span>
        </button>
      </div>
    </div>
  )
}
