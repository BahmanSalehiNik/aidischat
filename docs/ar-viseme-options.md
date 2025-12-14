# AR Viseme Generation - Client-Side Options

## Overview
Client-side viseme generation for AR conversations. All options can be downloaded once and used offline.

---

## Option 1: HeadTTS (Recommended for Quality)

**Description**: Free neural text-to-speech system with viseme timestamps for lip-syncing.

**Features:**
- ✅ Provides both TTS audio and viseme data
- ✅ Runs in-browser with WebGPU/WASM
- ✅ Can be downloaded once and used offline
- ✅ Free and open-source
- ✅ Real-time viseme generation

**GitHub**: https://github.com/met4citizen/HeadTTS

**Installation:**
```bash
npm install headtts
# or
yarn add headtts
```

**Usage:**
```typescript
import { HeadTTS } from 'headtts';

const tts = new HeadTTS();
const result = await tts.synthesize(text, {
  returnVisemes: true,
  returnAudio: true,
});

// result.audio: AudioBuffer
// result.visemes: Array<{ id: number; offset: number; duration: number }>
```

**Pros:**
- High quality visemes
- Provides both TTS and visemes
- Free and offline
- Real-time generation

**Cons:**
- May need React Native bindings for mobile
- Larger bundle size (~10-20MB)
- Requires WebGPU/WASM support

**Best For**: High-quality AR experiences, when you want both TTS and visemes from one source.

---

## Option 2: Phoneme-to-Viseme Mapping (Recommended for Simplicity)

**Description**: Static JSON mapping file that maps phonemes to viseme IDs. Download once, use offline.

**Features:**
- ✅ Fully offline (static JSON file)
- ✅ Lightweight (~100KB)
- ✅ No external dependencies
- ✅ Simple to implement
- ✅ Works with any TTS provider

**Implementation:**
1. Download phoneme-to-viseme mapping JSON (one-time)
2. Use text-to-phoneme library (e.g., `cmu-pronouncing-dictionary`)
3. Map phonemes to visemes using static mapping
4. Calculate timing from audio duration

**Phoneme-to-Viseme Mapping:**
```json
{
  "AA": 0,  // Open mouth
  "AE": 1,  // Open mouth
  "AH": 2,  // Open mouth
  "AO": 3,  // Open mouth
  "AW": 4,  // Open mouth
  "AY": 5,  // Open mouth
  "B": 6,   // Closed mouth
  "CH": 7,  // Closed mouth
  "D": 8,   // Closed mouth
  "DH": 9,  // Open mouth
  "EH": 10, // Open mouth
  "ER": 11, // Open mouth
  "EY": 12, // Open mouth
  "F": 13,  // Closed mouth
  "G": 14,  // Closed mouth
  "HH": 15, // Open mouth
  "IH": 16, // Open mouth
  "IY": 17, // Open mouth
  "JH": 18, // Closed mouth
  "K": 19,  // Closed mouth
  "L": 20,  // Open mouth
  "M": 21,  // Closed mouth
  "N": 22,  // Closed mouth
  "NG": 23, // Closed mouth
  "OW": 24, // Open mouth
  "OY": 25, // Open mouth
  "P": 26,  // Closed mouth
  "R": 27,  // Open mouth
  "S": 28,  // Closed mouth
  "SH": 29, // Closed mouth
  "T": 30,  // Closed mouth
  "TH": 31, // Closed mouth
  "UH": 32, // Open mouth
  "UW": 33, // Open mouth
  "V": 34,  // Closed mouth
  "W": 35,  // Open mouth
  "Y": 36,  // Open mouth
  "Z": 37,  // Closed mouth
  "ZH": 38  // Closed mouth
}
```

**Usage:**
```typescript
import { textToPhonemes } from 'cmu-pronouncing-dictionary';
import visemeMapping from './data/visemeMapping.json';

function textToVisemes(text: string, audioDuration: number) {
  const phonemes = textToPhonemes(text);
  const visemes = phonemes.map(phoneme => ({
    id: visemeMapping[phoneme] || 0,
    duration: audioDuration / phonemes.length,
  }));
  return visemes;
}
```

**Pros:**
- Simple and lightweight
- Fully offline
- Works with any TTS
- Easy to customize

**Cons:**
- Less accurate timing (estimated from audio duration)
- Requires phoneme-to-text conversion
- Less natural than ML-based solutions

**Best For**: MVP, simple implementations, when you want full control.

---

## Option 3: Azure Speech SDK (API-based)

**Description**: Microsoft's Azure Speech SDK provides viseme events during TTS synthesis.

**Features:**
- ✅ High quality visemes
- ✅ Real-time viseme events
- ✅ Synchronized with TTS audio
- ✅ Professional grade

**Usage:**
```typescript
import { SpeechSynthesizer, SpeechConfig } from 'microsoft-cognitiveservices-speech-sdk';

const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);

synthesizer.visemeReceived = (s, e) => {
  // e.visemeId: Viseme ID (0-21)
  // e.audioOffset: Audio offset in 100-nanosecond units
  // Apply viseme to 3D model
  applyViseme(e.visemeId, e.audioOffset);
};

synthesizer.speakTextAsync(text, (result) => {
  // Audio playback
});
```

**Pros:**
- High quality
- Real-time synchronization
- Professional grade

**Cons:**
- Requires internet connection
- Requires API key (backend provides token)
- API costs per request
- Not fully offline

**Best For**: Production apps with budget, when quality is critical.

---

## Option 4: Custom Phoneme Parser + Viseme Map

**Description**: Build your own simple phoneme-to-viseme mapper using existing libraries.

**Libraries:**
- `cmu-pronouncing-dictionary`: Text to phonemes
- `espeak-ng`: Text to phonemes (more accurate)
- Custom viseme mapping JSON

**Implementation:**
```typescript
import { pronounce } from 'cmu-pronouncing-dictionary';
import visemeMap from './visemeMapping.json';

function generateVisemes(text: string, audioDuration: number) {
  const words = text.split(' ');
  const phonemes: string[] = [];
  
  words.forEach(word => {
    const wordPhonemes = pronounce(word.toLowerCase());
    if (wordPhonemes) {
      phonemes.push(...wordPhonemes[0].split(' '));
    }
  });
  
  const visemes = phonemes.map((phoneme, index) => ({
    id: visemeMap[phoneme] || 0,
    offset: (audioDuration / phonemes.length) * index,
    duration: audioDuration / phonemes.length,
  }));
  
  return visemes;
}
```

**Pros:**
- Fully offline
- Lightweight
- Customizable
- No external API dependencies

**Cons:**
- Less accurate timing
- Requires phoneme dictionary
- More implementation work

**Best For**: Custom implementations, when you need full control.

---

## Recommendation

### For MVP (Phase 1):
**Use Option 2: Phoneme-to-Viseme Mapping**
- Simple to implement
- Fully offline
- Works with Web Speech API (free TTS)
- Good enough for initial release

### For Production (Phase 2+):
**Upgrade to Option 1: HeadTTS**
- Better quality
- Provides both TTS and visemes
- Still offline after download
- Better synchronization

### Alternative:
**Use Option 3: Azure Speech SDK** if:
- You have budget for API costs
- Quality is critical
- Internet connection is reliable

---

## Implementation Steps

1. **Download viseme mapping** (one-time, ~100KB JSON file)
2. **Install phoneme library** (if using Option 2/4)
3. **Create viseme service** that:
   - Takes text and audio duration
   - Converts text to phonemes
   - Maps phonemes to visemes
   - Returns viseme sequence with timing
4. **Apply visemes to 3D model**:
   - Map viseme IDs to blend shapes/morph targets
   - Update model in sync with audio playback

---

## Viseme ID to 3D Model Mapping

**Standard Viseme IDs (0-21):**
- 0: silence
- 1: aa, ao, aw
- 2: aa
- 3: aa, ao
- 4: eh, er
- 5: ih, iy
- 6: ow, oy
- 7: uw
- 8: m, b, p
- 9: f, v
- 10: th, dh
- 11: t, d, n, l
- 12: s, z
- 13: sh, ch, jh, zh
- 14: k, g, ng
- 15: y
- 16: w
- 17: r
- 18: l
- 19: th
- 20: th
- 21: silence

**3D Model Blend Shapes:**
```typescript
const visemeToBlendShape = {
  0: { mouthOpen: 0, mouthShape: 'neutral' },
  1: { mouthOpen: 0.8, mouthShape: 'aa' },
  2: { mouthOpen: 0.6, mouthShape: 'aa' },
  // ... map all visemes
};
```

---

## Resources

- **HeadTTS**: https://github.com/met4citizen/HeadTTS
- **CMU Pronouncing Dictionary**: https://github.com/cmusphinx/cmudict
- **Azure Speech SDK**: https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/how-to-speech-synthesis-viseme
- **Viseme Standards**: https://en.wikipedia.org/wiki/Viseme

