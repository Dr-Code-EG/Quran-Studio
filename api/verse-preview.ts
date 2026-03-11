import { Request, Response } from 'express';
import axios from 'axios';

export default async (req: Request, res: Response) => {
  if (req.method === 'GET') {
    const { surahId, verseFrom } = req.query;

    try {
      const response = await axios.get(`https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number=${surahId}`);
      const verses = response.data.verses;
      const verse = verses.find((v: any) => v.verse_key === `${surahId}:${verseFrom}`);

      const transResponse = await axios.get(`https://api.quran.com/api/v4/quran/translations/131?chapter_number=${surahId}`);
      const translations = transResponse.data.translations;
      const translation = translations.find((t: any) => t.resource_id === 131 && t.verse_id === verse.id);

      res.json({
        text: verse?.text_uthmani || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: translation?.text || 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
      });
    } catch (error) {
      res.json({
        text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
