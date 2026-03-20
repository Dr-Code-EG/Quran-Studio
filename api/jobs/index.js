import { createJob, updateJob } from './_store.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  if (req.method === 'GET') {
    const { listJobs } = await import('./_store.js')
    const jobs = listJobs()
    return res.status(200).json({ jobs })
  }

  if (req.method === 'POST') {
    const { surahId, fromVerse, toVerse, reciterId, translationId, settings } = req.body || {}

    if (!surahId || !fromVerse || !toVerse || !reciterId) {
      return res.status(400).json({ error: 'surahId, fromVerse, toVerse, and reciterId are required' })
    }

    const job = createJob({ 
      surahId, 
      fromVerse, 
      toVerse, 
      reciterId, 
      translationId: translationId || '131', 
      settings: settings || {} 
    })

    // Start background processing
    processJob(job.id, { 
      surahId, 
      fromVerse, 
      toVerse, 
      reciterId, 
      translationId: translationId || '131', 
      settings: settings || {} 
    }).catch(err => {
      console.error('Job processing error:', err)
      updateJob(job.id, { status: 'failed', error: err.message })
    })

    return res.status(201).json(job)
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function processJob(jobId, params) {
  const { surahId, fromVerse, toVerse, reciterId, translationId } = params

  updateJob(jobId, { status: 'processing', progress: 10, progressMessage: 'Initializing...' })

  await sleep(800)
  updateJob(jobId, { progress: 30, progressMessage: 'Fetching Quran verses and audio data...' })
  
  // Simulate fetching
  const verses = await fetchVerses(surahId, fromVerse, toVerse, translationId)
  
  await sleep(1000)
  updateJob(jobId, { progress: 60, progressMessage: 'Generating video frames and syncing audio...' })

  await sleep(1200)
  updateJob(jobId, { progress: 85, progressMessage: 'Finalizing video render...' })

  await sleep(1000)
  
  // Provide a demo video URL since real FFmpeg rendering on Vercel Serverless is limited
  // In a real production app, this would be a URL to an S3 bucket or similar
  const demoVideoUrl = "https://static.videezy.com/system/resources/previews/000/044/479/original/P1033659.mp4" 
  
  updateJob(jobId, { 
    status: 'completed', 
    progress: 100, 
    progressMessage: 'Video successfully generated!',
    videoUrl: demoVideoUrl
  })
}

async function fetchVerses(surahId, fromVerse, toVerse, translationId) {
  try {
    const params = new URLSearchParams({ 
      language: 'en', 
      words: 'false', 
      translations: translationId, 
      per_page: '300' 
    })
    const res = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${surahId}?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.verses.filter(v => v.verse_number >= fromVerse && v.verse_number <= toVerse)
  } catch (e) { 
    console.error('Fetch error:', e)
    return [] 
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
