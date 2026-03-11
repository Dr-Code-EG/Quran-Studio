export interface Surah {
  id: number;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_complex: string;
  name_arabic: string;
  name_simple: string;
  verses_count: number;
  pages: number[];
}

export interface Reciter {
  id: number;
  reciter_name: string;
  style: string | null;
  translated_name: {
    name: string;
    language_name: string;
  };
}

export interface VideoConfig {
  surahId: number;
  verseFrom: number;
  verseTo: number;
  reciterId: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  theme: string;
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  textPosition: 'top' | 'center' | 'bottom';
  showTranslation: boolean;
  translationLanguage: string;
  natureSound: string;
  natureVolume: number;
  reciterVolume: number;
  socialHandle: string;
  socialPlatform: string;
  blurBackground: number;
  brightnessBackground: number;
}

export interface JobStatus {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  videoUrl?: string;
  error?: string;
}
