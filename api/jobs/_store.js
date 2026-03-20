// Global variable to persist across serverless function invocations (within the same instance)
let jobs = new Map()

export function createJob(params) {
  const id = `job_${Date.now()}`
  const job = {
    id,
    status: 'pending',
    progress: 0,
    progressMessage: 'Job queued',
    surahId: params.surahId,
    fromVerse: params.fromVerse,
    toVerse: params.toVerse,
    reciterId: params.reciterId,
    translationId: params.translationId,
    settings: params.settings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  jobs.set(id, job)
  return job
}

export function getJob(id) {
  return jobs.get(id) || null
}

export function listJobs() {
  return Array.from(jobs.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function updateJob(id, updates) {
  const job = jobs.get(id)
  if (!job) return null
  const updated = { ...job, ...updates, updatedAt: new Date().toISOString() }
  jobs.set(id, updated)
  return updated
}

export function deleteJob(id) {
  return jobs.delete(id)
}
