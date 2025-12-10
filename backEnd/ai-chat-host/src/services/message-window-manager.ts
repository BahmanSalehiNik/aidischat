import { MessageWindow, MessageWindowModel, WindowMessage } from '../models/message-window';
import { ANALYSIS_CONFIG } from '../config/constants';

export class MessageWindowManager {
  /**
   * Add a message to the window for a room
   * Maintains sliding window of last N messages (FIFO)
   */
  async addMessage(
    roomId: string,
    message: {
      id: string;
      content: string;
      senderId: string;
      senderType: 'human' | 'agent';
      createdAt: Date | string;
    }
  ): Promise<MessageWindow> {
    // Get or create window
    let window = await MessageWindowModel.get(roomId);
    if (!window) {
      window = MessageWindowModel.create(roomId);
    }

    // Convert createdAt to Date if string
    const createdAt = typeof message.createdAt === 'string' 
      ? new Date(message.createdAt) 
      : message.createdAt;

    // Create window message
    const windowMessage: WindowMessage = {
      id: message.id,
      content: message.content,
      senderId: message.senderId,
      senderType: message.senderType,
      createdAt,
    };

    // Add message to window (FIFO - remove oldest if exceeds size)
    window.messages.push(windowMessage);
    
    // Maintain sliding window size
    if (window.messages.length > ANALYSIS_CONFIG.WINDOW_SIZE) {
      window.messages.shift(); // Remove oldest message
    }

    // Update timestamps
    window.lastMessageAt = createdAt;

    // Save window
    await MessageWindowModel.save(window);

    console.log(`[MessageWindowManager] Added message to window for room ${roomId}, window size: ${window.messages.length}`);

    return window;
  }

  /**
   * Get current window for a room
   */
  async getWindow(roomId: string): Promise<MessageWindow | null> {
    return await MessageWindowModel.get(roomId);
  }

  /**
   * Clear window for a room
   */
  async clearWindow(roomId: string): Promise<void> {
    await MessageWindowModel.clear(roomId);
    console.log(`[MessageWindowManager] Cleared window for room ${roomId}`);
  }

  /**
   * Get only human messages from window (for analysis)
   */
  getHumanMessages(window: MessageWindow): WindowMessage[] {
    return window.messages.filter(m => m.senderType === 'human');
  }

  /**
   * Get combined text from all messages in window
   */
  getCombinedText(window: MessageWindow): string {
    return window.messages
      .map(m => m.content)
      .filter(content => content && content.trim().length > 0)
      .join(' ');
  }
}

export const messageWindowManager = new MessageWindowManager();

