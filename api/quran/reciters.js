const RECITERS = [
  { id: 7,   name: 'Mishary Rashid Al-Afasy',  arabicName: 'مشاري راشد العفاسي',  style: 'Murattal', identifier: 'ar.alafasy' },
  { id: 1,   name: 'AbdulBaset AbdulSamad',    arabicName: 'عبد الباسط عبد الصمد', style: 'Mujawwad', identifier: 'ar.abdulbasitmurattal' },
  { id: 2,   name: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري',    style: 'Murattal', identifier: 'ar.husary' },
  { id: 3,   name: 'Mohamed Siddiq El-Minshawi',arabicName: 'محمد صديق المنشاوي', style: 'Mujawwad', identifier: 'ar.minshawi' },
  { id: 4,   name: 'Nasser Al-Qatami',         arabicName: 'ناصر القطامي',         style: 'Murattal', identifier: 'ar.alqatami' },
  { id: 5,   name: 'Saud Al-Shuraim',          arabicName: 'سعود الشريم',           style: 'Murattal', identifier: 'ar.saudalshuraym' },
  { id: 6,   name: 'Ali Al-Hudhaify',          arabicName: 'علي الحذيفي',          style: 'Murattal', identifier: 'ar.hudhaify' },
  { id: 8,   name: 'Maher Al-Muaiqly',         arabicName: 'ماهر المعيقلي',         style: 'Murattal', identifier: 'ar.mahermuaiqly' },
  { id: 9,   name: 'Ibrahim Al-Akhdar',        arabicName: 'إبراهيم الأخضر',        style: 'Murattal', identifier: 'ar.ibrahimakhbar' },
  { id: 10,  name: 'Abdullah Basfar',          arabicName: 'عبدالله بصفر',         style: 'Murattal', identifier: 'ar.abdullahbasfar' },
]

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=86400')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  res.status(200).json({ reciters: RECITERS })
}
