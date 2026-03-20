import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, CheckCircle, Loader2 } from 'lucide-react'
import { useStudio } from '../context/StudioContext'

interface Reciter { id: number; name: string; arabicName: string; style: string }

export default function ReciterPickerPage() {
  const navigate = useNavigate()
  const { config, updateConfig } = useStudio()
  const [selected, setSelected] = useState(config.reciterId)

  const { data, isLoading } = useQuery({
    queryKey: ['reciters'],
    queryFn: async () => {
      const res = await fetch('/api/quran/reciters')
      return res.json() as Promise<{ reciters: Reciter[] }>
    },
  })

  const handleConfirm = () => {
    const r = data?.reciters.find(r => r.id === selected)
    if (!r) return
    updateConfig({ reciterId: r.id, reciterName: r.name })
    navigate(-1)
  }

  return (
    <div className="h-full flex flex-col bg-deep-blue">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-card border border-border-blue flex items-center justify-center text-text-primary">
          <X size={20} />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Select Reciter</h1>
        <button onClick={handleConfirm} className="bg-gold text-deep-blue font-semibold px-4 py-2 rounded-xl text-sm hover:bg-gold-light">
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="text-gold animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {data?.reciters.map(r => {
              const active = selected === r.id
              return (
                <button
                  key={r.id} onClick={() => setSelected(r.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                    active ? 'border-gold bg-gold/10' : 'border-border-blue bg-card hover:border-gold/30'
                  }`}
                >
                  <div className="flex-1">
                    <p className={`font-semibold ${active ? 'text-gold-light' : 'text-text-primary'}`}>{r.name}</p>
                    <p className="text-sm text-text-secondary mt-0.5">{r.arabicName}</p>
                    <span className="inline-block mt-2 bg-surface border border-border-blue px-2 py-0.5 rounded-md text-xs text-text-muted">
                      {r.style}
                    </span>
                  </div>
                  {active && <CheckCircle size={22} className="text-gold flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
