import { getJob, deleteJob } from './_store.js'

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { id } = req.query

  if (req.method === 'GET') {
    const job = getJob(id)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    return res.status(200).json(job)
  }

  if (req.method === 'DELETE') {
    const ok = deleteJob(id)
    if (!ok) return res.status(404).json({ error: 'Job not found' })
    return res.status(200).json({ message: 'Job deleted' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
