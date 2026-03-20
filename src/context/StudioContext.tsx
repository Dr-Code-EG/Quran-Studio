import React, { createContext, useCallback, useContext, useState } from 'react'

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

export interface Job {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  progressMessage: string
  surahId: number
  fromVerse: number
  toVerse: number
  reciterId: number
  translationId: string
  settings: VideoSettings
  videoUrl?: string
  error?: string
  createdAt: string
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
  jobs: Job[]
  updateConfig: (p: Partial<StudioConfig>) => void
  updateSettings: (p: Partial<VideoSettings>) => void
  resetConfig: () => void
  addJob: (job: Job) => void
  updateJob: (id: string, updates: Partial<Job>) => void
  deleteJob: (id: string) => void
  getJob: (id: string) => Job | undefined
}

const StudioContext = createContext<Ctx | null>(null)

function loadStoredConfig(): StudioConfig {
  try {
    const s = localStorage.getItem('studio_config')
    if (s) return JSON.parse(s) as StudioConfig
  } catch (_) {}
  return DEFAULT
}

function loadStoredJobs(): Job[] {
  try {
    const s = localStorage.getItem('studio_jobs')
    if (s) return JSON.parse(s) as Job[]
  } catch (_) {}
  return []
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StudioConfig>(loadStoredConfig)
  const [jobs, setJobs] = useState<Job[]>(loadStoredJobs)

  const saveConfig = (c: StudioConfig) => {
    localStorage.setItem('studio_config', JSON.stringify(c))
  }

  const saveJobs = (j: Job[]) => {
    localStorage.setItem('studio_jobs', JSON.stringify(j))
  }

  const updateConfig = useCallback((p: Partial<StudioConfig>) => {
    setConfig(prev => { const n = { ...prev, ...p }; saveConfig(n); return n })
  }, [])

  const updateSettings = useCallback((p: Partial<VideoSettings>) => {
    setConfig(prev => {
      const n = { ...prev, settings: { ...prev.settings, ...p } }
      saveConfig(n)
      return n
    })
  }, [])

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT)
    localStorage.removeItem('studio_config')
  }, [])

  const addJob = useCallback((job: Job) => {
    setJobs(prev => {
      const n = [job, ...prev]
      saveJobs(n)
      return n
    })
  }, [])

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(prev => {
      const n = prev.map(j => j.id === id ? { ...j, ...updates } : j)
      saveJobs(n)
      return n
    })
  }, [])

  const deleteJob = useCallback((id: string) => {
    setJobs(prev => {
      const n = prev.filter(j => j.id !== id)
      saveJobs(n)
      return n
    })
  }, [])

  const getJob = useCallback((id: string) => {
    return jobs.find(j => j.id === id)
  }, [jobs])

  return (
    <StudioContext.Provider value={{ 
      config, 
      jobs, 
      updateConfig, 
      updateSettings, 
      resetConfig,
      addJob,
      updateJob,
      deleteJob,
      getJob
    }}>
      {children}
    </StudioContext.Provider>
  )
}

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be inside StudioProvider')
  return ctx
}
