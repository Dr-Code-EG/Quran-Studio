import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle, XCircle, Sparkles, Plus, Film, Info, Download } from 'lucide-react'
import { useStudio, Job } from '../context/StudioContext'
import { useEffect } from 'react'

const SURAH_NAMES: Record<number, string> = {
  1: 'Al-Fatiha', 2: 'Al-Baqarah', 3: "Ali 'Imran", 4: "An-Nisa", 5: "Al-Ma'idah",
  36: 'Ya-Sin', 55: 'Ar-Rahman', 67: 'Al-Mulk', 112: 'Al-Ikhlas', 114: 'An-Nas',
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getJob, updateJob } = useStudio()
  
  const localJob = id ? getJob(id) : undefined

  const { data: apiJob, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${id}`)
      if (!res.ok) throw new Error('Not found')
      return res.json() as Promise<Job>
    },
    refetchInterval: (data) => {
      const s = data?.state.data?.status
      return s === 'pending' || s === 'processing' ? 2000 : false
    },
    enabled: !!id,
  })

  // Sync API job status to local storage
  useEffect(() => {
    if (apiJob && id) {
      updateJob(id, {
        status: apiJob.status,
        progress: apiJob.progress,
        progressMessage: apiJob.progressMessage,
        videoUrl: apiJob.videoUrl || `https://download.quran.com/videos/${id}.mp4` // Mock URL for demo if not provided
      })
    }
  }, [apiJob, id, updateJob])

  const job = localJob || apiJob

  if (isLoading && !localJob) {
    return (
      <div className="h-full flex items-center justify-center bg-deep-blue">
        <Loader2 size={32} className="text-gold animate-spin" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-deep-blue gap-4">
        <p className="text-text-primary text-lg font-semibold">Job not found</p>
        <button onClick={() => navigate('/')} className="bg-gold text-deep-blue px-5 py-2.5 rounded-xl font-semibold">Go Home</button>
      </div>
    )
  }

  const surahName = SURAH_NAMES[job.surahId] || `Surah ${job.surahId}`
  const isActive = job.status === 'pending' || job.status === 'processing'

  const handleDownload = () => {
    if (job.videoUrl) {
      window.open(job.videoUrl, '_blank')
    } else {
      alert('Video URL not available yet.')
    }
  }

  return (
    <div className="h-full flex flex-col bg-deep-blue">
      <div className="px-5 pt-6 pb-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-card border border-border-blue flex items-center justify-center text-text-primary hover:bg-surface transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Video Job</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {/* Status */}
        <div className="bg-card rounded-2xl p-6 border border-border-blue flex flex-col items-center gap-4 text-center">
          <div className={`w-20 h-20 rounded-full bg-surface border border-border-blue flex items-center justify-center ${isActive ? 'animate-pulse' : ''}`}>
            {isActive && <Loader2 size={36} className="text-accent-light animate-spin" />}
            {job.status === 'completed' && <CheckCircle size={48} className="text-green-400" />}
            {job.status === 'failed' && <XCircle size={48} className="text-red-400" />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {job.status === 'pending' && 'Queued'}
              {job.status === 'processing' && 'Generating Video'}
              {job.status === 'completed' && 'Video Ready!'}
              {job.status === 'failed' && 'Generation Failed'}
            </h2>
            <p className="text-sm text-text-muted mt-1">{job.progressMessage}</p>
          </div>
          {isActive && (
            <div className="w-full space-y-1.5">
              <div className="h-2 bg-surface rounded-full overflow-hidden border border-border-blue">
                <div
                  className="h-full bg-accent-light rounded-full transition-all duration-500"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <p className="text-sm font-semibold text-accent-light">{job.progress}%</p>
            </div>
          )}
          
          {job.status === 'completed' && (
            <button
              onClick={handleDownload}
              className="mt-2 flex items-center gap-2 bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20"
            >
              <Download size={18} />
              Download Video
            </button>
          )}
        </div>

        {/* Details */}
        <div className="bg-card rounded-2xl p-4 border border-border-blue">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Video Details</p>
          {[
            { label: 'Surah', value: surahName },
            { label: 'Verses', value: `${job.fromVerse} – ${job.toVerse}` },
            { label: 'Format', value: job.settings.aspectRatio },
            { label: 'Overlay', value: job.settings.overlayType === 'none' ? 'No overlay' : job.settings.overlayType },
            job.settings.brandingHandle
              ? { label: 'Handle', value: `@${job.settings.brandingHandle} (${job.settings.brandingPlatform})` }
              : null,
            { label: 'Created', value: new Date(job.createdAt).toLocaleString() },
          ].filter(Boolean).map((item, i) => (
            <div key={i} className="flex justify-between py-2.5 border-b border-surface last:border-0">
              <span className="text-sm text-text-muted">{item!.label}</span>
              <span className="text-sm text-text-primary font-medium">{item!.value}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {job.status === 'failed' && job.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex gap-3">
            <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 leading-relaxed">{job.error}</p>
          </div>
        )}

        {/* Completed Info */}
        {job.status === 'completed' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 flex flex-col items-center gap-2 text-center">
            <Sparkles size={24} className="text-gold" />
            <p className="font-semibold text-text-primary">Your video is ready!</p>
            <p className="text-sm text-text-muted">Share it on social media</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-accent/20 border border-accent/30 rounded-2xl p-4 flex gap-3">
          <Info size={14} className="text-accent-light flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted leading-relaxed">
            Video generation uses FFmpeg on the server to combine Quran audio with rendered frames. Full video rendering is available when FFmpeg is installed on the deployment server. The API fetches Quran verses and audio from Quran.com.
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-border-blue bg-deep-blue flex gap-3 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex-1 flex items-center justify-center gap-2 bg-card border border-border-blue text-text-secondary py-3.5 rounded-xl font-medium hover:text-text-primary transition-colors"
        >
          <Plus size={18} />
          New Video
        </button>
        <button
          onClick={() => navigate('/library')}
          className="flex-1 flex items-center justify-center gap-2 bg-gold text-deep-blue py-3.5 rounded-xl font-bold hover:bg-gold-light transition-colors"
        >
          <Film size={18} />
          Library
        </button>
      </div>
    </div>
  )
}
