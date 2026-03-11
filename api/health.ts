import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const isVercel = process.env.VERCEL === '1';
const baseDir = isVercel ? '/tmp' : process.cwd();

const UPLOADS_DIR = path.join(baseDir, 'uploads');
const OUTPUT_DIR = path.join(baseDir, 'output');
const DATA_DIR = path.join(baseDir, 'data');

export default (req: Request, res: Response) => {
  if (req.method === 'GET') {
    res.json({
      status: 'ok',
      env: isVercel ? 'vercel' : 'local',
      dirs: {
        uploads: fs.existsSync(UPLOADS_DIR),
        output: fs.existsSync(OUTPUT_DIR),
        data: fs.existsSync(DATA_DIR),
      },
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
