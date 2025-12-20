// Animation Controller - Manages 3D model animations using Three.js AnimationMixer

import * as THREE from 'three';
import { 
  MovementState, 
  AnimationState, 
  AnimationConfig 
} from './animationTypes';
import {
  canTransition,
  canInterrupt,
  findAnimationName,
  getTransitionConfig,
} from './movementStateMachine';

export class AnimationController {
  private mixer: THREE.AnimationMixer;
  private model: THREE.Group;
  private animations: THREE.AnimationClip[];
  private actions: Map<string, THREE.AnimationAction> = new Map();
  private state: AnimationState;
  private currentAction: THREE.AnimationAction | null = null;
  private lastUpdateTime: number = 0;
  
  // Animation name mapping (state -> animation clip name)
  private animationNameMap: Map<MovementState, string> = new Map();
  
  constructor(model: THREE.Group, animations: THREE.AnimationClip[]) {
    this.model = model;
    this.animations = animations;
    this.mixer = new THREE.AnimationMixer(model);
    
    // Initialize state
    this.state = {
      currentState: MovementState.IDLE,
      previousState: null,
      isTransitioning: false,
      currentActionName: null,
    };
    
    // Create actions for all animations
    animations.forEach(clip => {
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity); // Default to looping
      this.actions.set(clip.name, action);
    });
    
    // Map movement states to animation names
    this.mapAnimationsToStates();
    
    // Start with idle animation
    this.transitionTo(MovementState.IDLE, false);
  }
  
  /**
   * Map available animations to movement states
   */
  private mapAnimationsToStates(): void {
    const availableNames = Array.from(this.actions.keys());
    
    Object.values(MovementState).forEach(state => {
      const animationName = findAnimationName(state, availableNames);
      if (animationName) {
        this.animationNameMap.set(state, animationName);
        console.log(`✅ [AnimationController] Mapped ${state} → ${animationName}`);
      } else {
        console.warn(`⚠️ [AnimationController] No animation found for state: ${state}`);
      }
    });
  }
  
  /**
   * Transition to a new movement state
   * @param newState - The target movement state
   * @param allowInterrupt - Whether to allow interrupting current animation
   */
  transitionTo(newState: MovementState, allowInterrupt: boolean = true): boolean {
    const currentState = this.state.currentState;
    
    // If already in this state, do nothing
    if (currentState === newState && this.currentAction?.isRunning()) {
      return true;
    }
    
    // Check if transition is valid
    if (!canTransition(currentState, newState)) {
      console.warn(
        `⚠️ [AnimationController] Invalid transition: ${currentState} → ${newState}`
      );
      return false;
    }
    
    // Check if we can interrupt current animation
    if (this.currentAction?.isRunning() && !allowInterrupt) {
      if (!canInterrupt(currentState, newState)) {
        console.warn(
          `⚠️ [AnimationController] Cannot interrupt ${currentState} with ${newState}`
        );
        return false;
      }
    }
    
    // Get animation name for the new state
    const animationName = this.animationNameMap.get(newState);
    if (!animationName) {
      console.warn(`⚠️ [AnimationController] No animation mapped for state: ${newState}`);
      return false;
    }
    
    // Get the action
    const newAction = this.actions.get(animationName);
    if (!newAction) {
      console.warn(`⚠️ [AnimationController] Action not found: ${animationName}`);
      return false;
    }
    
    // Get transition configuration
    const { fadeIn, fadeOut } = getTransitionConfig(currentState, newState);
    
    // Fade out current action
    if (this.currentAction && this.currentAction.isRunning()) {
      this.currentAction.fadeOut(fadeOut);
      
      // Stop after fade out
      setTimeout(() => {
        if (this.currentAction && !this.currentAction.isRunning()) {
          this.currentAction.stop();
        }
      }, fadeOut * 1000);
    }
    
    // Fade in new action
    newAction.reset();
    newAction.fadeIn(fadeIn);
    newAction.play();
    
    // Update state
    this.state = {
      currentState: newState,
      previousState: currentState,
      isTransitioning: true,
      currentActionName: animationName,
    };
    
    this.currentAction = newAction;
    
    // Mark transition as complete after fade in
    setTimeout(() => {
      this.state.isTransitioning = false;
    }, fadeIn * 1000);
    
    console.log(
      `🎬 [AnimationController] Transition: ${currentState} → ${newState} (${animationName})`
    );
    
    return true;
  }
  
  /**
   * Update animation mixer (call this in render loop)
   * @param deltaTime - Time elapsed since last update in seconds
   */
  update(deltaTime: number): void {
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
    this.lastUpdateTime = Date.now();
  }
  
  /**
   * Get current animation state
   */
  getState(): AnimationState {
    return { ...this.state };
  }
  
  /**
   * Get current movement state
   */
  getCurrentState(): MovementState {
    return this.state.currentState;
  }
  
  /**
   * Check if an animation is available for a state
   */
  hasAnimation(state: MovementState): boolean {
    return this.animationNameMap.has(state);
  }
  
  /**
   * Stop all animations
   */
  stopAll(): void {
    this.actions.forEach(action => {
      action.stop();
    });
    this.currentAction = null;
    this.state.currentState = MovementState.IDLE;
  }
  
  /**
   * Pause current animation
   */
  pause(): void {
    if (this.currentAction) {
      this.currentAction.paused = true;
    }
  }
  
  /**
   * Resume current animation
   */
  resume(): void {
    if (this.currentAction) {
      this.currentAction.paused = false;
    }
  }
  
  /**
   * Set animation speed (1.0 = normal, 2.0 = double speed, etc.)
   */
  setSpeed(speed: number): void {
    if (this.currentAction) {
      this.currentAction.timeScale = speed;
    }
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopAll();
    this.actions.clear();
    this.animationNameMap.clear();
    // Note: AnimationMixer doesn't have a dispose method, but we can clear references
    this.mixer = null as any;
    this.model = null as any;
    this.animations = [];
  }
}
