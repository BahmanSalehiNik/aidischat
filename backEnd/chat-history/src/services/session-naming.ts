// src/services/session-naming.ts
/**
 * Session Naming Strategy
 * 
 * Auto-generates meaningful session names based on available context.
 * Supports multiple naming strategies that can be combined or used independently.
 */

export interface SessionNamingContext {
  roomId: string;
  roomName?: string;
  roomType?: 'dm' | 'group' | 'stage' | 'ai-sim';
  participantId: string;
  participantType: 'human' | 'agent';
  participantName?: string; // Name of the participant (user or agent)
  otherParticipantName?: string; // For DM rooms, name of the other participant
  startTime: Date;
  firstMessagePreview?: string; // First few words of the first message
  messageCount?: number;
}

export class SessionNamingService {
  /**
   * Generate a session name based on available context
   * Uses a priority-based approach:
   * 1. Room name (if available and meaningful)
   * 2. Participant-based naming (for DMs)
   * 3. Time-based naming (fallback)
   * 4. Content-based naming (if first message available)
   */
  static generateSessionName(context: SessionNamingContext): string {
    // Strategy 1: Use room name if available and not generic
    if (context.roomName && context.roomName.trim().length > 0) {
      // For group/stage rooms, use room name
      if (context.roomType === 'group' || context.roomType === 'stage') {
        return context.roomName;
      }
      
      // For DM rooms, prefer participant-based naming (see Strategy 2)
      // But if room name is custom, use it
      if (context.roomType === 'dm' && !this.isDefaultRoomName(context.roomName)) {
        return context.roomName;
      }
    }

    // Strategy 2: Participant-based naming (especially for DMs)
    if (context.roomType === 'dm' && context.otherParticipantName) {
      return `Chat with ${context.otherParticipantName}`;
    }

    // Strategy 3: Agent-based naming
    if (context.participantType === 'agent' && context.participantName) {
      return `Session with ${context.participantName}`;
    }

    // Strategy 4: Time-based naming with content preview
    const timeStr = this.formatSessionTime(context.startTime);
    
    if (context.firstMessagePreview) {
      const preview = this.truncatePreview(context.firstMessagePreview, 30);
      return `${timeStr} - ${preview}`;
    }

    // Strategy 5: Simple time-based (fallback)
    return timeStr;
  }

  /**
   * Format session time in a user-friendly way
   */
  private static formatSessionTime(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffDays = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      // Today - show time
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      // Yesterday
      return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      // This week - show day name
      return date.toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
    } else if (diffDays < 365) {
      // This year - show month and day
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } else {
      // Older - show full date
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }

  /**
   * Truncate message preview to fit in session name
   */
  private static truncatePreview(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Try to truncate at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Check if room name is a default/generic name
   */
  private static isDefaultRoomName(name: string): boolean {
    const lowerName = name.toLowerCase().trim();
    const defaultNames = [
      'chat',
      'conversation',
      'room',
      'dm',
      'direct message',
      'new chat',
    ];
    return defaultNames.some(defaultName => lowerName.includes(defaultName));
  }

  /**
   * Generate a short session name (for UI display where space is limited)
   */
  static generateShortSessionName(context: SessionNamingContext): string {
    // For short names, prioritize:
    // 1. Room name (if short)
    if (context.roomName && context.roomName.length <= 20) {
      return context.roomName;
    }

    // 2. Participant name (for DMs)
    if (context.roomType === 'dm' && context.otherParticipantName) {
      return context.otherParticipantName;
    }

    // 3. Time only
    const date = context.startTime;
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }
}

