import { VideoConfig } from '../types';

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  config: Partial<VideoConfig>;
  thumbnail: string;
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional look with serif fonts and warm colors.',
    thumbnail: 'https://picsum.photos/seed/classic/400/225',
    config: {
      theme: 'classic',
      fontFamily: 'Scheherazade',
      fontSize: 52,
      fontColor: '#fef3c7',
      textPosition: 'center',
      overlayType: 'none',
      blurBackground: 2,
      brightnessBackground: 80,
    }
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean, minimalist design with sans-serif fonts.',
    thumbnail: 'https://picsum.photos/seed/modern/400/225',
    config: {
      theme: 'modern',
      fontFamily: 'Noto Sans Arabic',
      fontSize: 48,
      fontColor: '#ffffff',
      textPosition: 'center',
      overlayType: 'bokeh',
      overlayOpacity: 0.3,
      blurBackground: 0,
      brightnessBackground: 100,
    }
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Focus on the text with a simple, dark background.',
    thumbnail: 'https://picsum.photos/seed/minimal/400/225',
    config: {
      theme: 'minimal',
      fontFamily: 'Lateef',
      fontSize: 44,
      fontColor: '#d4d4d8',
      textPosition: 'center',
      overlayType: 'none',
      blurBackground: 10,
      brightnessBackground: 50,
    }
  },
  {
    id: 'nature-themed',
    name: 'Nature',
    description: 'Vibrant and organic feel with green accents.',
    thumbnail: 'https://picsum.photos/seed/nature/400/225',
    config: {
      theme: 'nature',
      fontFamily: 'Amiri',
      fontSize: 56,
      fontColor: '#ecfdf5',
      textPosition: 'bottom',
      overlayType: 'dust',
      overlayOpacity: 0.4,
      blurBackground: 1,
      brightnessBackground: 90,
    }
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Dramatic lighting and high-contrast typography.',
    thumbnail: 'https://picsum.photos/seed/cinematic/400/225',
    config: {
      theme: 'cinematic',
      fontFamily: 'Amiri',
      fontSize: 64,
      fontColor: '#ffffff',
      textPosition: 'center',
      overlayType: 'light_leaks',
      overlayOpacity: 0.6,
      blurBackground: 3,
      brightnessBackground: 70,
    }
  }
];
