// utils/markerParser.ts
// Parser for emotion/movement markers in AR stream text

export interface Marker {
  type: 'emotion' | 'movement' | 'gesture' | 'pose' | 'tone';
  value: string;
}

export interface ParsedChunk {
  text: string;
  markers: Marker[];
}

/**
 * Parse markers from text chunk
 * Supports both formats:
 * - Old: [emotion:happy] or [movement:smiling]
 * - New: ['happy'] or ['smiling'] (array format)
 * 
 * Example: "['happy']['smiling']Hello! ['thoughtful']['thinking']How are you?"
 * Returns: { text: "Hello! How are you?", markers: [{ type: 'emotion', value: 'happy' }, { type: 'movement', value: 'smiling' }] }
 */
export function parseMarkers(text: string): ParsedChunk {
  const markers: Marker[] = [];
  let cleanText = text;
  
  // First, handle new array format: ['emotion'] or ['movement']
  const arrayMarkerRegex = /\['([^']+)'\]/g;
  cleanText = cleanText.replace(arrayMarkerRegex, (match, value) => {
    const trimmedValue = value.trim().toLowerCase();
    
    // Map values to marker types based on known emotions and movements
    const emotions = ['happy', 'sad', 'angry', 'surprised', 'calm', 'excited', 'thoughtful', 'concerned', 'neutral'];
    const movements = ['idle', 'thinking', 'smiling', 'frown', 'talking', 'listening', 'wave', 'nod', 'point'];
    
    if (emotions.includes(trimmedValue)) {
      markers.push({ type: 'emotion', value: trimmedValue });
    } else if (movements.includes(trimmedValue)) {
      markers.push({ type: 'movement', value: trimmedValue });
    } else {
      // Try to infer type from common patterns
      if (['wave', 'nod', 'point', 'hand_raise', 'thumbs_up', 'shrug'].includes(trimmedValue)) {
        markers.push({ type: 'movement', value: trimmedValue });
      } else {
        // Default to emotion if uncertain
        markers.push({ type: 'emotion', value: trimmedValue });
      }
    }
    
    return ''; // Remove marker from text
  });
  
  // Then, handle old format: [emotion:value] or [movement:value]
  const oldMarkerRegex = /\[([^\]]+)\]/g;
  cleanText = cleanText.replace(oldMarkerRegex, (match, content) => {
    // Parse comma-separated markers
    const parts = content.split(',');
    parts.forEach(part => {
      const [type, value] = part.split(':');
      if (type && value) {
        const trimmedType = type.trim();
        const trimmedValue = value.trim();
        
        // Validate marker type (support both old and new formats)
        const validTypes = ['emotion', 'movement', 'gesture', 'pose', 'tone'];
        if (validTypes.includes(trimmedType)) {
          markers.push({ 
            type: trimmedType as Marker['type'], 
            value: trimmedValue 
          });
        } else {
          console.warn(`Unknown marker type: ${trimmedType}`);
        }
      }
    });
    return ''; // Remove marker from text
  });
  
  return { 
    text: cleanText.trim(), 
    markers 
  };
}

/**
 * Extract markers from text and return them in order of appearance
 * Useful for applying markers sequentially as text streams
 * Supports both ['value'] array format and [type:value] format
 */
export function extractMarkersSequentially(text: string): Array<{ position: number; markers: Marker[] }> {
  const result: Array<{ position: number; markers: Marker[] }> = [];
  
  // First, handle new array format: ['emotion'] or ['movement']
  const arrayMarkerRegex = /\['([^']+)'\]/g;
  let match;
  
  while ((match = arrayMarkerRegex.exec(text)) !== null) {
    const position = match.index;
    const value = match[1].trim().toLowerCase();
    const markers: Marker[] = [];
    
    // Map values to marker types based on known emotions and movements
    const emotions = ['happy', 'sad', 'angry', 'surprised', 'calm', 'excited', 'thoughtful', 'concerned', 'neutral'];
    const movements = ['idle', 'thinking', 'smiling', 'frown', 'talking', 'listening', 'wave', 'nod', 'point'];
    
    if (emotions.includes(value)) {
      markers.push({ type: 'emotion', value });
    } else if (movements.includes(value)) {
      markers.push({ type: 'movement', value });
    } else {
      // Try to infer type from common patterns
      if (['wave', 'nod', 'point', 'hand_raise', 'thumbs_up', 'shrug'].includes(value)) {
        markers.push({ type: 'movement', value });
      } else {
        // Default to emotion if uncertain
        markers.push({ type: 'emotion', value });
      }
    }
    
    if (markers.length > 0) {
      result.push({ position, markers });
    }
  }
  
  // Then, handle old format: [emotion:value] or [movement:value]
  const oldMarkerRegex = /\[([^\]]+)\]/g;
  while ((match = oldMarkerRegex.exec(text)) !== null) {
    // Skip if already processed as array format
    if (match[0].startsWith("['") && match[0].endsWith("']")) {
      continue;
    }
    
    const position = match.index;
    const content = match[1];
    const markers: Marker[] = [];
    
    // Parse comma-separated markers
    const parts = content.split(',');
    parts.forEach(part => {
      const [type, value] = part.split(':');
      if (type && value) {
        const trimmedType = type.trim();
        const trimmedValue = value.trim();
        
        const validTypes = ['emotion', 'movement', 'gesture', 'pose', 'tone'];
        if (validTypes.includes(trimmedType)) {
          markers.push({ 
            type: trimmedType as Marker['type'], 
            value: trimmedValue 
          });
        }
      }
    });
    
    if (markers.length > 0) {
      result.push({ position, markers });
    }
  }
  
  return result;
}

/**
 * Get the last marker of a specific type from parsed chunk
 */
export function getLastMarker(chunk: ParsedChunk, type: Marker['type']): Marker | null {
  const markersOfType = chunk.markers.filter(m => m.type === type);
  return markersOfType.length > 0 ? markersOfType[markersOfType.length - 1] : null;
}

/**
 * Get all markers of a specific type from parsed chunk
 */
export function getMarkersByType(chunk: ParsedChunk, type: Marker['type']): Marker[] {
  return chunk.markers.filter(m => m.type === type);
}

