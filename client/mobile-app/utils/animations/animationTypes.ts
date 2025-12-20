// Animation Types and Enums

/**
 * Movement states for avatar animations
 */
export enum MovementState {
  IDLE = 'idle',
  THINKING = 'thinking',
  WALKING = 'walking',
  FLYING = 'flying',
  TALKING = 'talking',
}

/**
 * Animation priority levels (higher = more important)
 */
export enum AnimationPriority {
  IDLE = 1,
  WALKING = 2,
  FLYING = 2,
  THINKING = 3,
  TALKING = 4, // Highest priority
}

/**
 * Animation transition configuration
 */
export interface AnimationTransition {
  from: MovementState;
  to: MovementState;
  fadeIn: number; // Fade in duration in seconds
  fadeOut: number; // Fade out duration in seconds
  canInterrupt: boolean; // Whether this transition can interrupt current animation
}

/**
 * Animation state information
 */
export interface AnimationState {
  currentState: MovementState;
  previousState: MovementState | null;
  isTransitioning: boolean;
  currentActionName: string | null;
}

/**
 * Animation configuration for a model
 */
export interface AnimationConfig {
  animationName: string; // Name of the animation clip in GLTF
  movementState: MovementState;
  loop: boolean; // Whether to loop the animation
  priority: AnimationPriority;
  defaultDuration?: number; // Default duration if not in GLTF
}
