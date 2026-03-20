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
  translated_name: {
    language_name: string;
    name: string;
  };
}

export interface Reciter {
  id: number;
  reciter_name: string;
  style: string | null;
  translated_name: {
    language_name: string;
    name: string;
  };
}

export interface BackgroundConfig {
  id: string;
  fileUrl?: string;
  verseFrom: number;
  verseTo: number;
  type: 'image' | 'video';
}

export interface VideoConfig {
  surahId: number;
  verseFrom: number;
  verseTo: number;
  reciterId: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
  theme: string;
  fontFamily: string;
  customFontUrl?: string;
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
  overlayType: 'none' | 'dust' | 'bokeh' | 'light_leaks';
  overlayOpacity: number;
  transitionType: 'fade' | 'slide' | 'zoom' | 'none';
  motionEffect: boolean;
  backgrounds: BackgroundConfig[];
}

export interface JobStatus {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  videoUrl?: string;
  error?: string;
}
