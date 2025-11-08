// src/routes/get-user-rooms.ts
import express, { Request, Response } from 'express';
import { Room } from '../models/room';
import { Participant } from '../models/room-participant';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.get('/api/users/rooms', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const userId = req.jwtPayload!.id;
  const { page = '1', limit = '20' } = req.query;
  
  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Get all rooms (not deleted), limited to first 20 for now
  // TODO: Implement proper algorithm for which rooms users should see
  // Note: deletedAt has default: null in schema, so we check for null or not existing
  const rooms = await Room.find({
    $or: [
      { deletedAt: null },
      { deletedAt: { $exists: false } }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .skip(skip);
  
  console.log(`[getUserRooms] Query result: ${rooms.length} rooms found`);
  if (rooms.length > 0) {
    console.log(`[getUserRooms] First room sample: id=${rooms[0].id}, deletedAt=${rooms[0].deletedAt}`);
  }

  console.log(`[getUserRooms] Found ${rooms.length} rooms for user ${userId}`);

  // Get participant info for the current user in these rooms
  const roomIds = rooms.map(r => r.id);
  const participants = await Participant.find({
    roomId: { $in: roomIds },
    participantId: userId,
    participantType: 'human',
    leftAt: { $exists: false }
  });

  console.log(`[getUserRooms] User is participant in ${participants.length} of these rooms`);

  // Create a map for quick lookup
  const participantMap = new Map(
    participants.map(p => [p.roomId, p])
  );

  // Include participant info (role) for each room if user is a participant
  const roomsWithParticipantInfo = rooms.map(room => {
    const participant = participantMap.get(room.id);
    const roomJson = room.toJSON();
    return {
      ...roomJson,
      role: participant?.role || null, // null if user is not a participant
      joinedAt: participant?.joinedAt || null,
      isParticipant: !!participant, // Flag to indicate if user is already in the room
    };
  });

  // Get total count for pagination
  const total = await Room.countDocuments({
    $or: [
      { deletedAt: null },
      { deletedAt: { $exists: false } }
    ]
  });

  console.log(`[getUserRooms] Returning ${roomsWithParticipantInfo.length} rooms, total: ${total}`);

  res.status(200).send({
    rooms: roomsWithParticipantInfo,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  });
});

export { router as getUserRoomsRouter };

