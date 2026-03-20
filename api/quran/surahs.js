export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const response = await fetch(
      'https://api.quran.com/api/v4/chapters?language=en',
      { headers: { 'Accept': 'application/json' } }
    )
    if (!response.ok) throw new Error(`Quran API error: ${response.status}`)
    const data = await response.json()

    const surahs = data.chapters.map(c => ({
      id: c.id,
      nameSimple: c.name_simple,
      nameArabic: c.name_arabic,
      translatedName: c.translated_name?.name || '',
      versesCount: c.verses_count,
      revelationPlace: c.revelation_place,
    }))

    res.status(200).json({ surahs })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch surahs' })
  }
}
