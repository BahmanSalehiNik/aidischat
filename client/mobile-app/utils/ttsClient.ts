// TTS Client for AR Chat
// Handles TTS generation using provider tokens

import * as Speech from 'expo-speech';
import { ProviderTokens } from './arApi';
import { generateVisemes, VisemeData } from './phonemeToViseme';

export interface TTSResult {
  audioUrl: string;
  visemes: VisemeData[];
  duration: number; // in milliseconds
}

/**
 * Generate TTS audio using provider tokens
 * Currently supports Web Speech API (browser built-in, no token needed)
 * Future: Add ElevenLabs, Azure, OpenAI TTS support
 */
export async function generateTTS(
  text: string,
  providerTokens: ProviderTokens | null,
  voiceId?: string
): Promise<TTSResult> {
  // Remove markers from text for TTS
  const cleanText = text.replace(/\[[^\]]+\]/g, '').trim();
  
  if (!cleanText) {
    return {
      audioUrl: '',
      visemes: [],
      duration: 0,
    };
  }

  // For now, use Web Speech API (browser built-in)
  // This works on mobile browsers and doesn't require tokens
  // Future: Use provider tokens for ElevenLabs/Azure/OpenAI TTS
  
  // Generate visemes from text (estimate duration)
  // Rough estimate: ~150 words per minute = ~0.4s per word
  const wordCount = cleanText.split(/\s+/).length;
  const estimatedDurationMs = wordCount * 400; // 400ms per word
  
  const visemes = generateVisemes(cleanText, estimatedDurationMs);
  
  // For Web Speech API, we'll use the browser's built-in TTS
  // The audioUrl will be empty, and we'll use SpeechSynthesis API directly
  return {
    audioUrl: '', // Web Speech API doesn't provide URL
    visemes,
    duration: estimatedDurationMs,
  };
}

/**
 * Play TTS audio using expo-speech (works in React Native)
 * Falls back to silent viseme animation if TTS fails
 * @param text - Text to speak
 * @param onViseme - Callback for viseme updates
 * @param stopPrevious - Whether to stop previous speech (default: true). Set to false when continuing queued text.
 */
export async function playTTS(
  text: string, 
  onViseme?: (visemeId: number) => void, 
  stopPrevious: boolean = true
): Promise<void> {
  // Remove markers from text
  const cleanText = text.replace(/\[[^\]]+\]/g, '').trim();
  
  if (!cleanText) {
    console.warn('⚠️ [TTS] No clean text to speak');
    return;
  }

  try {
    // CRITICAL: Configure audio session FIRST (same as beep test)
    const { Audio } = await import('expo-av');
    try {
      console.log('🔊 [TTS] Configuring audio session...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true, // Critical: allows audio in silent mode (iOS)
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('✅ [TTS] Audio mode configured successfully');
    } catch (audioError) {
      console.error('❌ [TTS] Audio mode configuration FAILED:', audioError);
      // Don't return - try to continue anyway
    }
    
    // Generate visemes for lip sync
    const wordCount = cleanText.split(/\s+/).length;
    const estimatedDurationMs = wordCount * 400;
    const visemes = generateVisemes(cleanText, estimatedDurationMs);
    
    console.log('🔊 [TTS] Starting TTS with visemes:', { 
      text: cleanText.substring(0, 50) + '...',
      textLength: cleanText.length,
      visemeCount: visemes.length 
    });
    
    const startTime = Date.now();
    let visemeIndex = 0;
    let visemeInterval: NodeJS.Timeout | null = null;
    
    // Update visemes in sync with speech
    const updateVisemes = () => {
      if (visemeIndex < visemes.length) {
        const elapsed = Date.now() - startTime;
        const currentViseme = visemes[visemeIndex];
        
        if (elapsed >= currentViseme.offset) {
          if (onViseme) {
            onViseme(currentViseme.id);
          }
          visemeIndex++;
        }
        
        if (visemeIndex < visemes.length) {
          visemeInterval = setTimeout(updateVisemes, 50); // Update every 50ms
        }
      }
    };
    
    // Stop any previous speech first (unless continuing queued text)
    const shouldStopPrevious = (typeof stopPrevious !== 'undefined' && stopPrevious !== false);
    if (shouldStopPrevious) {
      console.log('🔊 [TTS] Stopping previous speech...');
      Speech.stop();
      await new Promise(resolve => setTimeout(resolve, 300)); // Wait longer for stop to complete
    } else {
      console.log('🔊 [TTS] Continuing with queued text (not stopping previous)');
      // Small delay to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Start viseme updates
    updateVisemes();
    
    // Speak the text using expo-speech
    console.log('🔊 [TTS] Calling Speech.speak() with text:', cleanText.substring(0, 50) + '...');
    await new Promise<void>((resolve, reject) => {
      try {
        const speechOptions = {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.9, // Slightly slower for clarity
          volume: 1.0, // Full volume
          onStart: () => {
            console.log('✅✅✅ [TTS] Speech STARTED - audio should be playing NOW!');
          },
          onDone: () => {
            console.log('✅ [TTS] Speech completed');
            if (visemeInterval) {
              clearTimeout(visemeInterval);
            }
            resolve();
          },
          onStopped: () => {
            console.log('⚠️ [TTS] Speech stopped');
            if (visemeInterval) {
              clearTimeout(visemeInterval);
            }
            resolve();
          },
          onError: (error: any) => {
            console.error('❌❌❌ [TTS] Speech ERROR:', error);
            if (visemeInterval) {
              clearTimeout(visemeInterval);
            }
            reject(error);
          },
        };
        
        Speech.speak(cleanText, speechOptions);
        console.log('🔊 [TTS] Speech.speak() called - waiting for callbacks...');
        
        // Timeout after 10 seconds if no callback
        setTimeout(() => {
          console.warn('⚠️ [TTS] Speech timeout - no callback received after 10s');
          // Don't reject, just resolve to allow visemes to continue
          if (visemeInterval) {
            clearTimeout(visemeInterval);
          }
          resolve();
        }, 10000);
      } catch (error) {
        console.error('❌ [TTS] Error calling Speech.speak():', error);
        if (visemeInterval) {
          clearTimeout(visemeInterval);
        }
        reject(error);
      }
    });
    
    console.log('🔊 [TTS] TTS completed');
  } catch (error) {
    console.error('❌ [TTS] Error:', error);
    // Don't reject - allow visemes to work even if TTS fails
    console.warn('⚠️ [TTS] Continuing with silent viseme animation');
    
    // Fallback: silent viseme animation
    const wordCount = cleanText.split(/\s+/).length;
    const estimatedDurationMs = wordCount * 400;
    const visemes = generateVisemes(cleanText, estimatedDurationMs);
    const startTime = Date.now();
    let visemeIndex = 0;
    
    const updateVisemes = () => {
      if (visemeIndex < visemes.length) {
        const elapsed = Date.now() - startTime;
        const currentViseme = visemes[visemeIndex];
        
        if (elapsed >= currentViseme.offset) {
          if (onViseme) {
            onViseme(currentViseme.id);
          }
          visemeIndex++;
        }
        
        if (visemeIndex < visemes.length) {
          setTimeout(updateVisemes, 50);
        }
      }
    };
    
    updateVisemes();
    await new Promise(resolve => setTimeout(resolve, estimatedDurationMs));
  }
}
