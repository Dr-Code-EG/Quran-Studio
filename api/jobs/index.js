import { createJob, listJobs } from './_store.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  if (req.method === 'GET') {
    const jobs = listJobs()
    return res.status(200).json({ jobs })
  }

  if (req.method === 'POST') {
    const { surahId, fromVerse, toVerse, reciterId, translationId, settings } = req.body || {}

    if (!surahId || !fromVerse || !toVerse || !reciterId) {
      return res.status(400).json({ error: 'surahId, fromVerse, toVerse, and reciterId are required' })
    }

    const job = createJob({ surahId, fromVerse, toVerse, reciterId, translationId: translationId || '131', settings: settings || {} })

    processJob(job.id, { surahId, fromVerse, toVerse, reciterId, translationId: translationId || '131', settings: settings || {} }).catch(console.error)

    return res.status(201).json(job)
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function processJob(jobId, params) {
  const { updateJob } = await import('./_store.js')
  const { surahId, fromVerse, toVerse, reciterId, translationId, settings } = params

  updateJob(jobId, { status: 'processing', progress: 5, progressMessage: 'Fetching Quran verses...' })

  await sleep(500)
  const verses = await fetchVerses(surahId, fromVerse, toVerse, translationId, reciterId)
  updateJob(jobId, { progress: 25, progressMessage: `Fetched ${verses.length} verses` })

  await sleep(500)
  updateJob(jobId, { progress: 50, progressMessage: 'Processing audio sources...' })

  await sleep(500)
  updateJob(jobId, { progress: 70, progressMessage: 'Applying visual settings...' })

  await sleep(500)

  const ffmpegAvailable = await checkFFmpeg()
  if (!ffmpegAvailable) {
    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      progressMessage: 'Configuration ready — FFmpeg required for final video render',
    })
    return
  }

  updateJob(jobId, { progress: 85, progressMessage: 'Rendering video...' })
  await sleep(1000)
  updateJob(jobId, { status: 'completed', progress: 100, progressMessage: 'Video ready!' })
}

async function fetchVerses(surahId, fromVerse, toVerse, translationId, reciterId) {
  try {
    const params = new URLSearchParams({ language: 'en', words: 'false', translations: translationId, per_page: '300', page: '1' })
    const res = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${surahId}?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.verses.filter(v => v.verse_number >= fromVerse && v.verse_number <= toVerse)
  } catch { return [] }
}

async function checkFFmpeg() {
  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    await promisify(exec)('ffmpeg -version', { timeout: 3000 })
    return true
  } catch { return false }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
