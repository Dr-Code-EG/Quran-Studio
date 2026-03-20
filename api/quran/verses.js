export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { surahId, from = '1', to, translation = '131' } = req.query

  if (!surahId) {
    return res.status(400).json({ error: 'surahId is required' })
  }

  try {
    const params = new URLSearchParams({
      language: 'en',
      words: 'true',
      translations: translation,
      word_fields: 'text_uthmani',
      per_page: '300',
      page: '1',
    })
    if (from) params.set('verse_number', from)

    const url = `https://api.quran.com/api/v4/verses/by_chapter/${surahId}?${params}`
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Quran API error: ${response.status}`)
    const data = await response.json()

    const fromN = parseInt(from) || 1
    const toN = parseInt(to) || data.verses.length + fromN - 1

    const verses = data.verses
      .filter(v => {
        const n = v.verse_number
        return n >= fromN && n <= toN
      })
      .map(v => ({
        id: v.id,
        verseNumber: v.verse_number,
        verseKey: v.verse_key,
        textUthmani: v.text_uthmani,
        translation: v.translations?.[0]?.text || '',
        audioUrl: `https://verses.quran.com/${v.verse_key}.mp3`,
      }))

    res.status(200).json({ verses })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch verses' })
  }
}
