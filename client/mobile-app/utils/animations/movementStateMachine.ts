// Movement State Machine - Defines valid state transitions

import { MovementState, AnimationPriority, AnimationTransition } from './animationTypes';

/**
 * Valid state transitions for movement animations
 * Defines which states can transition to which other states
 */
export const VALID_TRANSITIONS: Map<MovementState, MovementState[]> = new Map([
  [MovementState.IDLE, [
    MovementState.THINKING,
    MovementState.WALKING,
    MovementState.FLYING,
    MovementState.TALKING,
  ]],
  [MovementState.THINKING, [
    MovementState.IDLE,
    MovementState.TALKING,
  ]],
  [MovementState.WALKING, [
    MovementState.IDLE,
    MovementState.TALKING,
  ]],
  [MovementState.FLYING, [
    MovementState.IDLE,
    MovementState.TALKING,
  ]],
  [MovementState.TALKING, [
    MovementState.IDLE,
    MovementState.THINKING,
  ]],
]);

/**
 * Animation priority map
 */
export const ANIMATION_PRIORITIES: Map<MovementState, AnimationPriority> = new Map([
  [MovementState.IDLE, AnimationPriority.IDLE],
  [MovementState.WALKING, AnimationPriority.WALKING],
  [MovementState.FLYING, AnimationPriority.FLYING],
  [MovementState.THINKING, AnimationPriority.THINKING],
  [MovementState.TALKING, AnimationPriority.TALKING],
]);

/**
 * Default animation names in GLTF files
 * These are common names, but models may use different names
 */
export const DEFAULT_ANIMATION_NAMES: Map<MovementState, string[]> = new Map([
  [MovementState.IDLE, ['idle', 'Idle', 'IDLE', 'rest', 'Rest']],
  [MovementState.THINKING, ['thinking', 'Thinking', 'think', 'Think', 'pondering']],
  [MovementState.WALKING, ['walk', 'Walk', 'walking', 'Walking', 'walk_cycle']],
  [MovementState.FLYING, ['fly', 'Fly', 'flying', 'Flying', 'hover', 'Hover']],
  [MovementState.TALKING, ['talk', 'Talk', 'talking', 'Talking', 'speak', 'Speak']],
]);

/**
 * Check if a state transition is valid
 */
export function canTransition(from: MovementState, to: MovementState): boolean {
  const validTargets = VALID_TRANSITIONS.get(from);
  return validTargets?.includes(to) ?? false;
}

/**
 * Check if a state can interrupt another state
 */
export function canInterrupt(currentState: MovementState, newState: MovementState): boolean {
  const currentPriority = ANIMATION_PRIORITIES.get(currentState) ?? AnimationPriority.IDLE;
  const newPriority = ANIMATION_PRIORITIES.get(newState) ?? AnimationPriority.IDLE;
  
  // Higher priority can always interrupt lower priority
  if (newPriority > currentPriority) {
    return true;
  }
  
  // Same priority can interrupt if it's a valid transition
  if (newPriority === currentPriority) {
    return canTransition(currentState, newState);
  }
  
  return false;
}

/**
 * Find animation clip name from available animations
 * Tries common names and returns the first match
 */
export function findAnimationName(
  state: MovementState,
  availableAnimations: string[]
): string | null {
  const possibleNames = DEFAULT_ANIMATION_NAMES.get(state) ?? [];
  
  // Try exact match first
  for (const name of possibleNames) {
    if (availableAnimations.includes(name)) {
      return name;
    }
  }
  
  // Try case-insensitive match
  const lowerAvailable = availableAnimations.map(a => a.toLowerCase());
  for (const name of possibleNames) {
    const lowerName = name.toLowerCase();
    const index = lowerAvailable.indexOf(lowerName);
    if (index >= 0) {
      return availableAnimations[index]; // Return original case
    }
  }
  
  // Try partial match (contains)
  for (const name of possibleNames) {
    const match = availableAnimations.find(a => 
      a.toLowerCase().includes(name.toLowerCase()) || 
      name.toLowerCase().includes(a.toLowerCase())
    );
    if (match) {
      return match;
    }
  }
  
  return null;
}

/**
 * Get transition configuration for a state change
 */
export function getTransitionConfig(
  from: MovementState,
  to: MovementState
): { fadeIn: number; fadeOut: number } {
  // Default transition times
  const defaultFadeIn = 0.3;
  const defaultFadeOut = 0.2;
  
  // Special cases for smoother transitions
  if (to === MovementState.TALKING) {
    // Talking should fade in quickly
    return { fadeIn: 0.2, fadeOut: defaultFadeOut };
  }
  
  if (from === MovementState.TALKING) {
    // Exiting talking should fade out smoothly
    return { fadeIn: defaultFadeIn, fadeOut: 0.3 };
  }
  
  if (to === MovementState.IDLE) {
    // Returning to idle should be smooth
    return { fadeIn: 0.4, fadeOut: defaultFadeOut };
  }
  
  return { fadeIn: defaultFadeIn, fadeOut: defaultFadeOut };
}
