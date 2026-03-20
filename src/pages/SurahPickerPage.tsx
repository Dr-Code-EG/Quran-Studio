import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, Search, XCircle, Loader2 } from 'lucide-react'
import { useStudio } from '../context/StudioContext'

interface Surah {
  id: number; nameSimple: string; nameArabic: string; translatedName: string; versesCount: number; revelationPlace: string
}

async function fetchSurahs() {
  const res = await fetch('/api/quran/surahs')
  if (!res.ok) throw new Error('Failed')
  return res.json() as Promise<{ surahs: Surah[] }>
}

export default function SurahPickerPage() {
  const navigate = useNavigate()
  const { config, updateConfig } = useStudio()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(config.surahId)
  const [fromVerse, setFromVerse] = useState(String(config.fromVerse))
  const [toVerse, setToVerse] = useState(String(config.toVerse))

  const { data, isLoading } = useQuery({ queryKey: ['surahs'], queryFn: fetchSurahs })

  const filtered = data?.surahs.filter(s =>
    s.nameSimple.toLowerCase().includes(search.toLowerCase()) ||
    s.translatedName.toLowerCase().includes(search.toLowerCase()) ||
    String(s.id).includes(search)
  ) ?? []

  const handleSelect = (surah: Surah) => {
    setSelectedId(surah.id)
    setFromVerse('1')
    setToVerse(String(Math.min(7, surah.versesCount)))
  }

  const handleConfirm = () => {
    const surah = data?.surahs.find(s => s.id === selectedId)
    if (!surah) return
    const from = Math.max(1, parseInt(fromVerse) || 1)
    const to = Math.min(surah.versesCount, parseInt(toVerse) || surah.versesCount)
    updateConfig({ surahId: surah.id, surahName: surah.nameSimple, fromVerse: from, toVerse: Math.max(from, to) })
    navigate(-1)
  }

  const selectedSurah = data?.surahs.find(s => s.id === selectedId)

  return (
    <div className="h-full flex flex-col bg-deep-blue">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-card border border-border-blue flex items-center justify-center text-text-primary">
          <X size={20} />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Select Surah</h1>
        <button onClick={handleConfirm} className="bg-gold text-deep-blue font-semibold px-4 py-2 rounded-xl text-sm hover:bg-gold-light transition-colors">
          Done
        </button>
      </div>

      <div className="px-4 mb-3 flex-shrink-0">
        <div className="flex items-center gap-3 bg-card rounded-xl px-4 border border-border-blue">
          <Search size={16} className="text-text-muted" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search surahs..." autoFocus
            className="flex-1 h-11 bg-transparent text-text-primary placeholder-text-muted text-sm outline-none"
          />
          {search && <button onClick={() => setSearch('')}><XCircle size={16} className="text-text-muted" /></button>}
        </div>
      </div>

      {selectedSurah && (
        <div className="px-4 mb-3 flex-shrink-0">
          <div className="bg-card rounded-xl p-4 border border-border-blue">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-3">Verse Range — {selectedSurah.nameSimple}</p>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-text-muted">From</span>
                <input
                  type="number" value={fromVerse} onChange={e => setFromVerse(e.target.value)}
                  min={1} max={selectedSurah.versesCount}
                  className="w-20 h-12 text-center text-xl font-bold bg-surface rounded-xl border border-border-blue text-text-primary outline-none focus:border-gold/50"
                />
              </div>
              <span className="text-text-muted mt-4">→</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-text-muted">To</span>
                <input
                  type="number" value={toVerse} onChange={e => setToVerse(e.target.value)}
                  min={1} max={selectedSurah.versesCount}
                  className="w-20 h-12 text-center text-xl font-bold bg-surface rounded-xl border border-border-blue text-text-primary outline-none focus:border-gold/50"
                />
              </div>
              <span className="text-text-muted text-sm mt-4">/ {selectedSurah.versesCount}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="text-gold animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => {
              const active = selectedId === s.id
              return (
                <button
                  key={s.id} onClick={() => handleSelect(s)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                    active ? 'border-gold bg-gold/10' : 'border-border-blue bg-card hover:border-gold/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border ${
                    active ? 'bg-gold border-gold text-deep-blue' : 'bg-surface border-border-blue text-text-secondary'
                  }`}>
                    {s.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${active ? 'text-gold-light' : 'text-text-primary'}`}>{s.nameSimple}</p>
                    <p className="text-xs text-text-muted">{s.translatedName} • {s.versesCount} verses • {s.revelationPlace}</p>
                  </div>
                  <p className={`font-arabic text-lg flex-shrink-0 ${active ? 'text-gold-light' : 'text-text-secondary'}`}>{s.nameArabic}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
