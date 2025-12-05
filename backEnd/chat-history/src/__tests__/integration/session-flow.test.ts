/**
 * Integration Test for Chat History Service
 * 
 * Tests the chat history service core functionality:
 * - Session creation and management
 * - Message-to-session linking
 * - Session queries by participant
 * - Session naming
 * 
 * Test Scenario:
 * 1. 2 users and 1 agent join a chat room
 * 2. Send 10 messages (mixed from all participants)
 * 3. New user joins the chat
 * 4. Each participant leaves after 2 messages (consecutively)
 * 5. Verify messages are stored correctly
 * 6. Verify sessions are created properly per user/agent
 * 7. Verify correct messages are linked to sessions
 * 8. Verify session naming
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Session } from '../../models/session';
import { MessageSessionLink } from '../../models/message-session-link';
import { SessionManager } from '../../services/session-manager';
import { SessionNamingService } from '../../services/session-naming';
import crypto from 'crypto';

// Test data
const TEST_USER1_ID = 'test-user-1';
const TEST_USER1_NAME = 'Alice';
const TEST_USER2_ID = 'test-user-2';
const TEST_USER2_NAME = 'Bob';
const TEST_USER3_ID = 'test-user-3';
const TEST_USER3_NAME = 'Charlie';
const TEST_AGENT_ID = 'test-agent-123';
const TEST_AGENT_NAME = 'AI Assistant';
const TEST_ROOM_ID = 'test-room-456';
const TEST_ROOM_NAME = 'Test Chat Room';
const TEST_ROOM_TYPE = 'group' as const;

let mongoServer: MongoMemoryServer;
const messageHistory: Array<{
  id: string;
  roomId: string;
  senderId: string;
  senderType: 'human' | 'agent';
  senderName: string;
  content: string;
  createdAt: Date;
}> = [];

describe('Chat History Service Integration Test', () => {
  beforeAll(async () => {
    // Setup MongoDB (in-memory for testing)
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB test server connected');

    process.env.JWT_DEV = 'test-jwt-secret';
  });

  beforeEach(async () => {
    // Clear MongoDB
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.collections();
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
    
    // Clear message history
    messageHistory.length = 0;
  });

  afterAll(async () => {
    if (mongoServer) {
      await mongoServer.stop();
    }
    await mongoose.connection.close();
  });

  it('should create sessions correctly with participants joining and leaving', async () => {
    console.log('\n📝 Starting integration test...\n');

    // Helper function to simulate a message
    const sendMessage = async (
      senderId: string,
      senderType: 'human' | 'agent',
      senderName: string,
      content: string,
      delayMs: number = 100
    ): Promise<string> => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      const messageId = crypto.randomUUID();
      const createdAt = new Date();
      
      messageHistory.push({
        id: messageId,
        roomId: TEST_ROOM_ID,
        senderId,
        senderType,
        senderName,
        content,
        createdAt,
      });

      // Simulate MessageCreated event by calling SessionManager directly
      await SessionManager.linkMessageToSession(
        messageId,
        TEST_ROOM_ID,
        senderId,
        senderType,
        createdAt
      );

      return messageId;
    };

    // Step 1: Initial participants join and send 10 messages
    console.log('📝 Step 1: Initial participants join and send 10 messages...');
    
    const initialMessages = [
      { sender: TEST_USER1_ID, type: 'human' as const, name: TEST_USER1_NAME, content: 'Hello everyone!' },
      { sender: TEST_USER2_ID, type: 'human' as const, name: TEST_USER2_NAME, content: 'Hi Alice!' },
      { sender: TEST_AGENT_ID, type: 'agent' as const, name: TEST_AGENT_NAME, content: 'Greetings! How can I help?' },
      { sender: TEST_USER1_ID, type: 'human' as const, name: TEST_USER1_NAME, content: 'Just testing the chat system' },
      { sender: TEST_USER2_ID, type: 'human' as const, name: TEST_USER2_NAME, content: 'Looks good so far' },
      { sender: TEST_AGENT_ID, type: 'agent' as const, name: TEST_AGENT_NAME, content: 'I\'m here to assist' },
      { sender: TEST_USER1_ID, type: 'human' as const, name: TEST_USER1_NAME, content: 'Message 7' },
      { sender: TEST_USER2_ID, type: 'human' as const, name: TEST_USER2_NAME, content: 'Message 8' },
      { sender: TEST_AGENT_ID, type: 'agent' as const, name: TEST_AGENT_NAME, content: 'Message 9' },
      { sender: TEST_USER1_ID, type: 'human' as const, name: TEST_USER1_NAME, content: 'Message 10' },
    ];

    for (const msg of initialMessages) {
      await sendMessage(msg.sender, msg.type, msg.name, msg.content);
    }

    console.log(`✅ Sent ${initialMessages.length} initial messages`);

    // Step 2: New user joins
    console.log('\n📝 Step 2: New user (Charlie) joins...');
    await sendMessage(TEST_USER3_ID, 'human', TEST_USER3_NAME, 'Hello! I just joined');
    console.log('✅ Charlie joined and sent first message');

    // Step 3: Each participant leaves after 2 messages (consecutively)
    console.log('\n📝 Step 3: Participants leave after 2 messages each...');
    
    // User1 sends 2 more messages then "leaves" (stops sending)
    await sendMessage(TEST_USER1_ID, 'human', TEST_USER1_NAME, 'User1 message before leaving 1');
    await sendMessage(TEST_USER1_ID, 'human', TEST_USER1_NAME, 'User1 message before leaving 2');
    console.log('✅ User1 sent 2 messages and left');

    // User2 sends 2 more messages then "leaves"
    await sendMessage(TEST_USER2_ID, 'human', TEST_USER2_NAME, 'User2 message before leaving 1');
    await sendMessage(TEST_USER2_ID, 'human', TEST_USER2_NAME, 'User2 message before leaving 2');
    console.log('✅ User2 sent 2 messages and left');

    // Agent sends 2 more messages then "leaves"
    await sendMessage(TEST_AGENT_ID, 'agent', TEST_AGENT_NAME, 'Agent message before leaving 1');
    await sendMessage(TEST_AGENT_ID, 'agent', TEST_AGENT_NAME, 'Agent message before leaving 2');
    console.log('✅ Agent sent 2 messages and left');

    // User3 sends 2 more messages then "leaves"
    await sendMessage(TEST_USER3_ID, 'human', TEST_USER3_NAME, 'User3 message before leaving 1');
    await sendMessage(TEST_USER3_ID, 'human', TEST_USER3_NAME, 'User3 message before leaving 2');
    console.log('✅ User3 sent 2 messages and left');

    // Wait a bit for any async processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Verify messages are stored
    console.log('\n📝 Step 4: Verifying messages are stored...');
    // 10 initial + 1 join + (2*4 leaving messages) = 10 + 1 + 8 = 19 total
    expect(messageHistory.length).toBe(19);
    console.log(`✅ Total messages: ${messageHistory.length}`);

    // Step 5: Verify sessions are created for each participant
    console.log('\n📝 Step 5: Verifying sessions are created...');
    
    // Check User1 sessions
    const user1Sessions = await SessionManager.getSessionsByParticipant(
      TEST_USER1_ID,
      'human',
      { roomId: TEST_ROOM_ID }
    );
    expect(user1Sessions.sessions.length).toBeGreaterThan(0);
    console.log(`✅ User1 has ${user1Sessions.sessions.length} session(s)`);

    // Check User2 sessions
    const user2Sessions = await SessionManager.getSessionsByParticipant(
      TEST_USER2_ID,
      'human',
      { roomId: TEST_ROOM_ID }
    );
    expect(user2Sessions.sessions.length).toBeGreaterThan(0);
    console.log(`✅ User2 has ${user2Sessions.sessions.length} session(s)`);

    // Check User3 sessions
    const user3Sessions = await SessionManager.getSessionsByParticipant(
      TEST_USER3_ID,
      'human',
      { roomId: TEST_ROOM_ID }
    );
    expect(user3Sessions.sessions.length).toBeGreaterThan(0);
    console.log(`✅ User3 has ${user3Sessions.sessions.length} session(s)`);

    // Check Agent sessions
    const agentSessions = await SessionManager.getSessionsByParticipant(
      TEST_AGENT_ID,
      'agent',
      { roomId: TEST_ROOM_ID }
    );
    expect(agentSessions.sessions.length).toBeGreaterThan(0);
    console.log(`✅ Agent has ${agentSessions.sessions.length} session(s)`);

    // Step 6: Verify correct messages are linked to sessions
    console.log('\n📝 Step 6: Verifying message-session links...');
    
    // Get all sessions for all participants
    const allSessions = [
      ...user1Sessions.sessions,
      ...user2Sessions.sessions,
      ...user3Sessions.sessions,
      ...agentSessions.sessions,
    ];

    // Count messages per session
    let totalLinkedMessages = 0;
    for (const session of allSessions) {
      // Use _id for lean() results, or id if transform was applied
      const sessionId = (session as any)._id || session.id;
      const sessionMessages = await SessionManager.getMessagesBySession(sessionId);
      totalLinkedMessages += sessionMessages.messageIds.length;
      
      // Verify session has firstMessageId and lastMessageId
      expect(session.firstMessageId).toBeDefined();
      expect(session.lastMessageId).toBeDefined();
      expect(session.messageCount).toBeGreaterThan(0);
      
      // Verify message count matches linked messages
      expect(session.messageCount).toBe(sessionMessages.total);
    }

    expect(totalLinkedMessages).toBe(messageHistory.length);
    console.log(`✅ All ${totalLinkedMessages} messages are linked to sessions`);

    // Step 7: Verify message content in sessions
    console.log('\n📝 Step 7: Verifying message content in sessions...');
    
    // Get User1's session and verify it contains User1's messages
    const user1Session = user1Sessions.sessions[0];
    const user1SessionId = (user1Session as any)._id || user1Session.id;
    const user1SessionMessages = await SessionManager.getMessagesBySession(user1SessionId);
    const user1MessageIds = new Set(user1SessionMessages.messageIds);
    
    const user1ActualMessages = messageHistory.filter(m => m.senderId === TEST_USER1_ID);
    expect(user1ActualMessages.length).toBeGreaterThan(0);
    
    // Verify all User1 messages are in the session
    for (const msg of user1ActualMessages) {
      expect(user1MessageIds.has(msg.id)).toBe(true);
    }
    console.log(`✅ User1 session contains all ${user1ActualMessages.length} of User1's messages`);

    // Step 8: Verify session naming
    console.log('\n📝 Step 8: Verifying session naming...');
    
    for (const session of allSessions) {
      // Get first message for preview
      const firstMessage = messageHistory.find(m => m.id === session.firstMessageId);
      
      // Handle date conversion (lean() returns dates as Date objects, but ensure it's a Date)
      const startTime = session.startTime instanceof Date 
        ? session.startTime 
        : new Date(session.startTime);
      
      const name = SessionNamingService.generateSessionName({
        roomId: session.roomId,
        roomName: TEST_ROOM_NAME,
        roomType: TEST_ROOM_TYPE,
        participantId: session.participantId,
        participantType: session.participantType,
        participantName: session.participantType === 'human' 
          ? (session.participantId === TEST_USER1_ID ? TEST_USER1_NAME : 
             session.participantId === TEST_USER2_ID ? TEST_USER2_NAME : TEST_USER3_NAME)
          : TEST_AGENT_NAME,
        startTime,
        firstMessagePreview: firstMessage?.content,
        messageCount: session.messageCount,
      });
      
      expect(name).toBeDefined();
      expect(name.length).toBeGreaterThan(0);
      console.log(`  - ${session.participantType} ${session.participantId}: "${name}"`);
    }
    console.log('✅ All sessions have valid names');

    // Step 9: Verify session boundaries (firstMessageId and lastMessageId)
    console.log('\n📝 Step 9: Verifying session boundaries...');
    
    for (const session of allSessions) {
      // Verify first message exists
      const firstMessage = messageHistory.find(m => m.id === session.firstMessageId);
      expect(firstMessage).toBeDefined();
      expect(firstMessage?.senderId).toBe(session.participantId);
      
      // Verify last message exists
      const lastMessage = messageHistory.find(m => m.id === session.lastMessageId);
      expect(lastMessage).toBeDefined();
      expect(lastMessage?.senderId).toBe(session.participantId);
      
      // Verify last message is not before first message
      if (firstMessage && lastMessage) {
        const firstMsgTime = firstMessage.createdAt instanceof Date 
          ? firstMessage.createdAt 
          : new Date(firstMessage.createdAt);
        const lastMsgTime = lastMessage.createdAt instanceof Date 
          ? lastMessage.createdAt 
          : new Date(lastMessage.createdAt);
        expect(lastMsgTime.getTime()).toBeGreaterThanOrEqual(
          firstMsgTime.getTime()
        );
      }
    }
    console.log('✅ All session boundaries are valid');

    // Step 10: Verify session timing
    console.log('\n📝 Step 10: Verifying session timing...');
    
    for (const session of allSessions) {
      expect(session.startTime).toBeDefined();
      expect(session.lastActivityTime).toBeDefined();
      
      // Handle date conversion
      const startTime = session.startTime instanceof Date 
        ? session.startTime 
        : new Date(session.startTime);
      const lastActivityTime = session.lastActivityTime instanceof Date 
        ? session.lastActivityTime 
        : new Date(session.lastActivityTime);
      
      expect(lastActivityTime.getTime()).toBeGreaterThanOrEqual(
        startTime.getTime()
      );
      
      // For ended sessions, endTime should be after startTime
      if (session.endTime) {
        const endTime = session.endTime instanceof Date 
          ? session.endTime 
          : new Date(session.endTime);
        expect(endTime.getTime()).toBeGreaterThanOrEqual(
          startTime.getTime()
        );
      }
    }
    console.log('✅ All session timings are valid');

    // Final summary
    console.log('\n✅ Integration test completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Total messages: ${messageHistory.length}`);
    console.log(`  - User1 sessions: ${user1Sessions.sessions.length}`);
    console.log(`  - User2 sessions: ${user2Sessions.sessions.length}`);
    console.log(`  - User3 sessions: ${user3Sessions.sessions.length}`);
    console.log(`  - Agent sessions: ${agentSessions.sessions.length}`);
    console.log(`  - Total sessions: ${allSessions.length}`);
    console.log(`  - All messages linked: ✅`);
    console.log(`  - Session naming: ✅`);
    console.log(`  - Session boundaries: ✅`);
  }, 60000); // 60 second timeout
});

