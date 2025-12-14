// utils/phonemeToViseme.ts
// Phoneme-to-Viseme mapping for client-side viseme generation

/**
 * Standard viseme IDs (0-21) based on ARKit/ARCore standards
 */
export enum VisemeId {
  SILENCE = 0,
  AA_AO_AW = 1,
  AA = 2,
  AA_AO = 3,
  EH_ER = 4,
  IH_IY = 5,
  OW_OY = 6,
  UW = 7,
  M_B_P = 8,
  F_V = 9,
  TH_DH = 10,
  T_D_N_L = 11,
  S_Z = 12,
  SH_CH_JH_ZH = 13,
  K_G_NG = 14,
  Y = 15,
  W = 16,
  R = 17,
  L = 18,
  TH = 19,
  TH_ALT = 20,
  SILENCE_END = 21,
}

/**
 * Phoneme to Viseme mapping based on CMU Pronouncing Dictionary
 * This is a static mapping that can be downloaded once and used offline
 */
const PHONEME_TO_VISEME_MAP: Record<string, VisemeId> = {
  // Vowels - Open mouth
  'AA': VisemeId.AA_AO_AW,  // father
  'AE': VisemeId.AA_AO_AW,  // cat
  'AH': VisemeId.AA,        // but
  'AO': VisemeId.AA_AO,     // law
  'AW': VisemeId.AA_AO_AW,  // cow
  'AY': VisemeId.AA_AO_AW,  // hide
  'EH': VisemeId.EH_ER,      // red
  'ER': VisemeId.EH_ER,      // her
  'EY': VisemeId.EH_ER,      // ate
  'IH': VisemeId.IH_IY,      // it
  'IY': VisemeId.IH_IY,      // eat
  'OW': VisemeId.OW_OY,      // show
  'OY': VisemeId.OW_OY,      // toy
  'UH': VisemeId.UW,         // book
  'UW': VisemeId.UW,         // two
  
  // Consonants - Closed/Partial mouth
  'B': VisemeId.M_B_P,       // be
  'CH': VisemeId.SH_CH_JH_ZH, // cheese
  'D': VisemeId.T_D_N_L,     // day
  'DH': VisemeId.TH_DH,      // the
  'F': VisemeId.F_V,         // fee
  'G': VisemeId.K_G_NG,      // go
  'HH': VisemeId.AA,         // he (open mouth)
  'JH': VisemeId.SH_CH_JH_ZH, // joy
  'K': VisemeId.K_G_NG,      // key
  'L': VisemeId.L,           // lay
  'M': VisemeId.M_B_P,       // me
  'N': VisemeId.T_D_N_L,     // no
  'NG': VisemeId.K_G_NG,     // sing
  'P': VisemeId.M_B_P,       // pea
  'R': VisemeId.R,           // ray
  'S': VisemeId.S_Z,         // sea
  'SH': VisemeId.SH_CH_JH_ZH, // she
  'T': VisemeId.T_D_N_L,     // tea
  'TH': VisemeId.TH_DH,      // theta
  'V': VisemeId.F_V,         // vee
  'W': VisemeId.W,           // way
  'Y': VisemeId.Y,           // yes
  'Z': VisemeId.S_Z,         // zee
  'ZH': VisemeId.SH_CH_JH_ZH, // measure
};

/**
 * Interface for viseme data with timing
 */
export interface VisemeData {
  id: VisemeId;
  offset: number;  // Start time in milliseconds
  duration: number; // Duration in milliseconds
}

/**
 * Convert text to phonemes (simplified - in production, use a proper library)
 * This is a placeholder - you should use a library like 'cmu-pronouncing-dictionary'
 * or 'espeak-ng' for accurate phoneme conversion
 */
function textToPhonemes(text: string): string[] {
  // Remove markers from text first
  const cleanText = text.replace(/\[[^\]]+\]/g, '').trim();
  
  // Simple word-based phoneme approximation
  // In production, use a proper phoneme library
  const words = cleanText.toLowerCase().split(/\s+/);
  const phonemes: string[] = [];
  
  words.forEach(word => {
    // This is a simplified mapping - replace with proper library
    // For now, map common sounds
    if (word.match(/^[aeiou]/)) {
      phonemes.push('AH'); // Approximate vowel start
    }
    // Add more mappings as needed
    // In production, use: import { pronounce } from 'cmu-pronouncing-dictionary';
  });
  
  return phonemes;
}

/**
 * Generate visemes from text and audio duration
 * @param text - Text content (markers will be removed)
 * @param audioDurationMs - Duration of audio in milliseconds
 * @returns Array of viseme data with timing
 */
export function generateVisemes(
  text: string,
  audioDurationMs: number
): VisemeData[] {
  // Remove emotion/movement markers from text
  const cleanText = text.replace(/\[[^\]]+\]/g, '').trim();
  
  if (!cleanText || audioDurationMs <= 0) {
    return [{ id: VisemeId.SILENCE, offset: 0, duration: audioDurationMs }];
  }
  
  // Convert text to phonemes
  // TODO: Replace with proper phoneme library
  const phonemes = textToPhonemes(cleanText);
  
  if (phonemes.length === 0) {
    return [{ id: VisemeId.SILENCE, offset: 0, duration: audioDurationMs }];
  }
  
  // Map phonemes to visemes
  const visemes = phonemes.map(phoneme => {
    const visemeId = PHONEME_TO_VISEME_MAP[phoneme] || VisemeId.SILENCE;
    return visemeId;
  });
  
  // Calculate timing - distribute audio duration evenly across visemes
  const visemeDuration = audioDurationMs / visemes.length;
  
  // Generate viseme data with timing
  const visemeData: VisemeData[] = visemes.map((visemeId, index) => ({
    id: visemeId,
    offset: index * visemeDuration,
    duration: visemeDuration,
  }));
  
  return visemeData;
}

/**
 * Map viseme ID to 3D model blend shape/morph target
 * This should be customized based on your 3D model's blend shapes
 */
export function visemeToBlendShape(visemeId: VisemeId): {
  mouthOpen: number;
  mouthShape: string;
} {
  const mapping: Record<VisemeId, { mouthOpen: number; mouthShape: string }> = {
    [VisemeId.SILENCE]: { mouthOpen: 0, mouthShape: 'neutral' },
    [VisemeId.AA_AO_AW]: { mouthOpen: 0.8, mouthShape: 'aa' },
    [VisemeId.AA]: { mouthOpen: 0.6, mouthShape: 'aa' },
    [VisemeId.AA_AO]: { mouthOpen: 0.7, mouthShape: 'ao' },
    [VisemeId.EH_ER]: { mouthOpen: 0.5, mouthShape: 'eh' },
    [VisemeId.IH_IY]: { mouthOpen: 0.4, mouthShape: 'ih' },
    [VisemeId.OW_OY]: { mouthOpen: 0.6, mouthShape: 'ow' },
    [VisemeId.UW]: { mouthOpen: 0.3, mouthShape: 'uw' },
    [VisemeId.M_B_P]: { mouthOpen: 0, mouthShape: 'closed' },
    [VisemeId.F_V]: { mouthOpen: 0.1, mouthShape: 'f' },
    [VisemeId.TH_DH]: { mouthOpen: 0.2, mouthShape: 'th' },
    [VisemeId.T_D_N_L]: { mouthOpen: 0.1, mouthShape: 't' },
    [VisemeId.S_Z]: { mouthOpen: 0.2, mouthShape: 's' },
    [VisemeId.SH_CH_JH_ZH]: { mouthOpen: 0.3, mouthShape: 'sh' },
    [VisemeId.K_G_NG]: { mouthOpen: 0.1, mouthShape: 'k' },
    [VisemeId.Y]: { mouthOpen: 0.3, mouthShape: 'y' },
    [VisemeId.W]: { mouthOpen: 0.2, mouthShape: 'w' },
    [VisemeId.R]: { mouthOpen: 0.3, mouthShape: 'r' },
    [VisemeId.L]: { mouthOpen: 0.2, mouthShape: 'l' },
    [VisemeId.TH]: { mouthOpen: 0.2, mouthShape: 'th' },
    [VisemeId.TH_ALT]: { mouthOpen: 0.2, mouthShape: 'th' },
    [VisemeId.SILENCE_END]: { mouthOpen: 0, mouthShape: 'neutral' },
  };
  
  return mapping[visemeId] || { mouthOpen: 0, mouthShape: 'neutral' };
}

