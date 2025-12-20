# Animation System Implementation

## Overview

This animation system uses Three.js `AnimationMixer` to manage avatar movements (idle, thinking, walking, flying, talking) in the 3D model viewer.

## Architecture

```
AnimationController
├── Three.js AnimationMixer
├── Animation Actions (Map of clip names → actions)
├── State Machine (movement transitions)
└── Animation Name Mapping (state → clip name)
```

## Files

### Core Files

1. **`AnimationController.ts`** - Main animation controller class
   - Manages animation playback
   - Handles state transitions
   - Updates animation mixer

2. **`animationTypes.ts`** - Type definitions
   - `MovementState` enum
   - `AnimationPriority` enum
   - Type interfaces

3. **`movementStateMachine.ts`** - State machine logic
   - Valid state transitions
   - Animation name mapping
   - Transition configuration

## Usage

### Basic Usage

```typescript
import { AnimationController } from './AnimationController';
import { MovementState } from './animationTypes';

// Initialize (done automatically in Model3DViewer)
const controller = new AnimationController(model, animations);

// Transition to a new state
controller.transitionTo(MovementState.TALKING);

// Update in render loop
controller.update(deltaTime);
```

### Movement States

- **IDLE** - Default resting state
- **THINKING** - Thinking/pondering animation
- **WALKING** - Walking animation
- **FLYING** - Flying/hovering animation
- **TALKING** - Talking/speaking animation (highest priority)

### State Transitions

Valid transitions:
- `idle` → `thinking`, `walking`, `flying`, `talking`
- `thinking` → `idle`, `talking`
- `walking` → `idle`, `talking`
- `flying` → `idle`, `talking`
- `talking` → `idle`, `thinking`

### Animation Priority

Higher priority animations can interrupt lower priority ones:
1. **TALKING** (4) - Highest priority
2. **THINKING** (3)
3. **WALKING/FLYING** (2)
4. **IDLE** (1) - Lowest priority

## Animation Naming

The system automatically maps movement states to GLTF animation clip names. It tries these names (in order):

- **idle**: `idle`, `Idle`, `IDLE`, `rest`, `Rest`
- **thinking**: `thinking`, `Thinking`, `think`, `Think`, `pondering`
- **walking**: `walk`, `Walk`, `walking`, `Walking`, `walk_cycle`
- **flying**: `fly`, `Fly`, `flying`, `Flying`, `hover`, `Hover`
- **talking**: `talk`, `Talk`, `talking`, `Talking`, `speak`, `Speak`

## Integration with Model3DViewer

The `Model3DViewer` component automatically:
1. Creates `AnimationController` when model loads
2. Updates animations in render loop
3. Responds to `currentMovement` prop changes
4. Handles cleanup on unmount

## Example

```tsx
<Model3DViewer
  modelUrl={modelUrl}
  currentMovement="talking"  // Triggers talking animation
  currentEmotion="happy"
  markers={markers}
/>
```

## Future Enhancements

- [ ] Blend shapes for emotions
- [ ] Viseme synchronization
- [ ] Gesture animations
- [ ] Animation queuing
- [ ] Custom animation sequences
