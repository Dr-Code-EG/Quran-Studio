import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Film, Trash2, ExternalLink, Plus, CheckCircle, XCircle, Clock, Loader2, Download } from 'lucide-react'
import { useStudio } from '../context/StudioContext'

const SURAH_NAMES: Record<number, string> = {
  1: 'Al-Fatiha', 2: 'Al-Baqarah', 3: "Ali 'Imran", 4: "An-Nisa", 5: "Al-Ma'idah",
  36: 'Ya-Sin', 55: 'Ar-Rahman', 67: 'Al-Mulk', 112: 'Al-Ikhlas', 114: 'An-Nas',
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const { jobs, deleteJob } = useStudio()

  const handleDelete = (id: string) => {
    if (!confirm('Delete this job from your local history?')) return
    deleteJob(id)
  }

  const handleDownload = (url?: string) => {
    if (url) {
      window.open(url, '_blank')
    } else {
      alert('Video URL not available.')
    }
  }

  return (
    <div className="h-full flex flex-col bg-deep-blue">
      <div className="px-5 pt-6 pb-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Library</h1>
          <p className="text-xs text-text-muted mt-0.5">Your generated videos (Stored locally)</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {!jobs.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <Film size={56} className="text-text-muted" />
            <h2 className="text-xl font-semibold text-text-primary">No Videos Yet</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Go to Studio and configure your Quran settings to generate your first video
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-gold text-deep-blue font-semibold px-6 py-3 rounded-xl hover:bg-gold-light transition-colors"
            >
              Open Studio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => {
              const surahName = SURAH_NAMES[job.surahId] || `Surah ${job.surahId}`
              const statusColor = {
                pending: 'text-text-muted',
                processing: 'text-accent-light',
                completed: 'text-green-400',
                failed: 'text-red-400',
              }[job.status]
              const StatusIcon = {
                pending: Clock,
                processing: Loader2,
                completed: CheckCircle,
                failed: XCircle,
              }[job.status]

              return (
                <div
                  key={job.id}
                  className="bg-card rounded-2xl p-4 border border-border-blue flex items-center gap-3"
                >
                  <div className={`w-10 h-10 rounded-full bg-surface border border-border-blue flex items-center justify-center flex-shrink-0 ${statusColor}`}>
                    <StatusIcon size={18} className={job.status === 'processing' ? 'animate-spin' : ''} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary truncate">{surahName}</p>
                    <p className="text-xs text-text-secondary">Verses {job.fromVerse}–{job.toVerse} • {job.settings.aspectRatio}</p>
                    {job.status === 'processing' ? (
                      <div className="mt-2 h-1 bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-light rounded-full transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    ) : (
                      <p className={`text-xs mt-1 ${statusColor}`}>{job.progressMessage}</p>
                    )}
                    <p className="text-[10px] text-text-muted mt-1">
                      {new Date(job.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/job/${job.id}`)}
                      title="View Details"
                      className="w-8 h-8 bg-surface border border-border-blue rounded-lg flex items-center justify-center text-gold hover:bg-gold/10 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                    {job.status === 'completed' && (
                      <button
                        onClick={() => handleDownload(job.videoUrl)}
                        title="Download Video"
                        className="w-8 h-8 bg-surface border border-border-blue rounded-lg flex items-center justify-center text-green-400 hover:bg-green-400/10 transition-colors"
                      >
                        <Download size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(job.id)}
                      title="Delete"
                      className="w-8 h-8 bg-surface border border-border-blue rounded-lg flex items-center justify-center text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center justify-center gap-2 bg-card border border-border-blue text-text-secondary py-3 rounded-xl hover:text-text-primary hover:border-gold/40 transition-all"
        >
          <Plus size={18} />
          <span className="font-medium">New Video</span>
        </button>
      </div>
    </div>
  )
}
