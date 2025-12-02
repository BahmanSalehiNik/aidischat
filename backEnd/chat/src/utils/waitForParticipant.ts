import { RoomParticipant } from '../models/room-participant';
import { Room } from '../models/room';

/**
 * Wait for room to be synced via Kafka event
 * This handles race conditions during service startup when RoomCreatedEvent hasn't been processed yet
 */
export async function waitForRoomSync(
  roomId: string,
  maxWaitMs: number = 5000 // 5 seconds to handle Kafka processing delays during startup
): Promise<typeof Room.prototype | null> {
  const startTime = Date.now();
  const checkInterval = 100; // Check every 100ms
  let checkCount = 0;
  
  while (Date.now() - startTime < maxWaitMs) {
    checkCount++;
    const room = await Room.findById(roomId);
    
    if (room) {
      const elapsed = Date.now() - startTime;
      console.log(`[waitForRoomSync] ✅ Room found after ${elapsed}ms (${checkCount} checks): ${roomId}`);
      return room;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  const elapsed = Date.now() - startTime;
  console.warn(`[waitForRoomSync] ⚠️ Room not found after ${elapsed}ms (${checkCount} checks): ${roomId} - RoomCreatedEvent may be delayed or failed`);
  return null;
}

/**
 * Wait for participant to be synced via Kafka event
 * This handles race conditions during service startup when listeners haven't processed events yet
 */
export async function waitForParticipantSync(
  roomId: string, 
  userId: string,
  maxWaitMs: number = 5000 // 5 seconds to handle Kafka processing delays during startup
): Promise<typeof RoomParticipant.prototype | null> {
  const startTime = Date.now();
  const checkInterval = 100; // Check every 100ms
  let checkCount = 0;
  
  while (Date.now() - startTime < maxWaitMs) {
    checkCount++;
    const participant = await RoomParticipant.findOne({ 
      roomId, 
      participantId: userId,
      leftAt: { $exists: false }
    });
    
    if (participant) {
      const elapsed = Date.now() - startTime;
      console.log(`[waitForParticipantSync] ✅ Participant found after ${elapsed}ms (${checkCount} checks): ${userId} -> ${roomId}`);
      return participant;
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  const elapsed = Date.now() - startTime;
  console.warn(`[waitForParticipantSync] ⚠️ Participant not found after ${elapsed}ms (${checkCount} checks): ${userId} -> ${roomId} - Kafka event may be delayed or failed`);
  return null;
}

/**
 * Check if user is room creator as fallback and create participant
 */
export async function checkRoomCreatorFallback(
  roomId: string,
  userId: string
): Promise<typeof RoomParticipant.prototype | null> {
  const room = await Room.findById(roomId);
  
  if (!room) {
    console.error(`[checkRoomCreatorFallback] ❌ Room ${roomId} not found in chat service DB - RoomCreated event may not have been processed`);
    return null;
  }
  
  if (room.createdBy === userId) {
    console.log(`[checkRoomCreatorFallback] ✅ User is room creator, creating participant locally as fallback: ${userId} -> ${roomId}`);
    
    // Check if participant already exists (idempotency)
    const existing = await RoomParticipant.findOne({ 
      roomId, 
      participantId: userId,
      leftAt: { $exists: false }
    });
    
    if (existing) {
      console.log(`[checkRoomCreatorFallback] Participant already exists, returning existing`);
      return existing;
    }
    
    const fallbackParticipant = RoomParticipant.build({
      roomId,
      participantId: userId,
      participantType: 'human',
      role: 'owner',
    });
    await fallbackParticipant.save();
    
    const participant = await RoomParticipant.findOne({ 
      roomId, 
      participantId: userId,
      leftAt: { $exists: false }
    });
    console.log(`[checkRoomCreatorFallback] ✅ Participant created locally as fallback`);
    return participant;
  }
  
  return null;
}

/**
 * Get participant with retry logic for startup race conditions
 * This handles the case where RoomCreatedEvent and RoomParticipantAddedEvent haven't been processed yet
 */
export async function getParticipantWithRetry(
  roomId: string,
  userId: string
): Promise<typeof RoomParticipant.prototype | null> {
  // First, check if room exists (RoomCreatedEvent must be processed first)
  let room = await Room.findById(roomId);
  
  // If room doesn't exist, wait for RoomCreatedEvent to be processed (up to 8 seconds for first room)
  if (!room) {
    console.log(`[getParticipantWithRetry] Room not found locally, waiting for RoomCreatedEvent: ${roomId}`);
    room = await waitForRoomSync(roomId, 8000); // Increased wait time for first room creation
  }
  
  if (!room) {
    console.error(`[getParticipantWithRetry] ❌ Room ${roomId} not found - RoomCreatedEvent may not have been processed`);
    return null;
  }

  // Now check if participant exists locally
  let participant = await RoomParticipant.findOne({ 
    roomId, 
    participantId: userId,
    leftAt: { $exists: false }
  });

  // If not found locally, wait for RoomParticipantAddedEvent to be processed (up to 8 seconds)
  if (!participant) {
    console.log(`[getParticipantWithRetry] Participant not found locally, waiting for RoomParticipantAddedEvent: ${userId} -> ${roomId}`);
    participant = await waitForParticipantSync(roomId, userId, 8000); // Increased wait time for first room creation
  }

  // Last resort fallback: If user created the room, create participant locally
  // This handles cases where RoomParticipantAddedEvent failed or was significantly delayed
  if (!participant && room.createdBy === userId) {
    console.log(`[getParticipantWithRetry] ✅ User is room creator, creating participant locally as fallback: ${userId} -> ${roomId}`);
    participant = await checkRoomCreatorFallback(roomId, userId);
  }

  return participant;
}

