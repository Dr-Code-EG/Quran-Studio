import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const isVercel = process.env.VERCEL === '1';
const baseDir = isVercel ? '/tmp' : process.cwd();
const DATA_DIR = path.join(baseDir, 'data');

// Initialize Database
let db: any;
try {
  const dbPath = path.join(DATA_DIR, 'studio.db');
  db = new Database(dbPath);
} catch (dbErr: any) {
  console.error('Database initialization failed:', dbErr);
}

export default (req: Request, res: Response) => {
  if (req.method === 'GET') {
    const { jobId } = req.query;

    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    try {
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        videoUrl: job.video_url,
        error: job.error,
        config: JSON.parse(job.config),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch job status: ' + err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
