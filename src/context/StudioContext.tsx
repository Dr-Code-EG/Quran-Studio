import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface VideoSettings {
  aspectRatio: '9:16' | '16:9' | '1:1'
  fontSize: number
  textColor: string
  textPosition: 'top' | 'center' | 'bottom'
  overlayType: 'none' | 'dust' | 'bokeh' | 'lightleaks'
  overlayOpacity: number
  backgroundBlur: number
  backgroundBrightness: number
  brandingHandle: string
  brandingPlatform: 'none' | 'instagram' | 'tiktok' | 'youtube' | 'twitter'
}

export interface StudioConfig {
  surahId: number
  surahName: string
  fromVerse: number
  toVerse: number
  reciterId: number
  reciterName: string
  translationId: string
  settings: VideoSettings
}

const DEFAULT: StudioConfig = {
  surahId: 1,
  surahName: 'Al-Fatiha',
  fromVerse: 1,
  toVerse: 7,
  reciterId: 7,
  reciterName: 'Mishary Rashid Al-Afasy',
  translationId: '131',
  settings: {
    aspectRatio: '9:16',
    fontSize: 42,
    textColor: '#FFFFFF',
    textPosition: 'center',
    overlayType: 'none',
    overlayOpacity: 0.3,
    backgroundBlur: 0,
    backgroundBrightness: 1.0,
    brandingHandle: '',
    brandingPlatform: 'none',
  },
}

interface Ctx {
  config: StudioConfig
  updateConfig: (p: Partial<StudioConfig>) => void
  updateSettings: (p: Partial<VideoSettings>) => void
  resetConfig: () => void
}

const StudioContext = createContext<Ctx | null>(null)

function loadStored(): StudioConfig {
  try {
    const s = localStorage.getItem('studio_config')
    if (s) return JSON.parse(s) as StudioConfig
  } catch (_) {}
  return DEFAULT
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StudioConfig>(loadStored)

  const save = (c: StudioConfig) => {
    localStorage.setItem('studio_config', JSON.stringify(c))
  }

  const updateConfig = useCallback((p: Partial<StudioConfig>) => {
    setConfig(prev => { const n = { ...prev, ...p }; save(n); return n })
  }, [])

  const updateSettings = useCallback((p: Partial<VideoSettings>) => {
    setConfig(prev => {
      const n = { ...prev, settings: { ...prev.settings, ...p } }
      save(n)
      return n
    })
  }, [])

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT)
    localStorage.removeItem('studio_config')
  }, [])

  return (
    <StudioContext.Provider value={{ config, updateConfig, updateSettings, resetConfig }}>
      {children}
    </StudioContext.Provider>
  )
}

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be inside StudioProvider')
  return ctx
}
