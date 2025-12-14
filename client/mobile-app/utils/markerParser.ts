// utils/markerParser.ts
// Parser for emotion/movement markers in AR stream text

export interface Marker {
  type: 'emotion' | 'gesture' | 'pose' | 'tone';
  value: string;
}

export interface ParsedChunk {
  text: string;
  markers: Marker[];
}

/**
 * Parse markers from text chunk
 * Example: "[emotion:happy]Hello! [gesture:wave]How are you?"
 * Returns: { text: "Hello! How are you?", markers: [{ type: 'emotion', value: 'happy' }, { type: 'gesture', value: 'wave' }] }
 */
export function parseMarkers(text: string): ParsedChunk {
  const markers: Marker[] = [];
  let cleanText = text;
  
  // Match [type:value] or [type1:value1,type2:value2]
  const markerRegex = /\[([^\]]+)\]/g;
  
  cleanText = text.replace(markerRegex, (match, content) => {
    // Parse comma-separated markers
    const parts = content.split(',');
    parts.forEach(part => {
      const [type, value] = part.split(':');
      if (type && value) {
        const trimmedType = type.trim();
        const trimmedValue = value.trim();
        
        // Validate marker type
        if (['emotion', 'gesture', 'pose', 'tone'].includes(trimmedType)) {
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
 */
export function extractMarkersSequentially(text: string): Array<{ position: number; markers: Marker[] }> {
  const result: Array<{ position: number; markers: Marker[] }> = [];
  const markerRegex = /\[([^\]]+)\]/g;
  let match;
  
  while ((match = markerRegex.exec(text)) !== null) {
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
        
        if (['emotion', 'gesture', 'pose', 'tone'].includes(trimmedType)) {
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

