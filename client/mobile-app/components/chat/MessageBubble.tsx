import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform } from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { Message, useChatStore } from '../../store/chatStore';
import { QuotedMessageCard } from './QuotedMessageCard';
import { MessageReactionButton } from './MessageReactionButton';
import { MessageContextMenu } from './MessageContextMenu';

interface MessageBubbleProps {
  message: Message;
  onReactionPress?: (messageId: string, emoji: string | null) => void;
  onReplyPress?: (message: Message) => void;
  onQuotedMessagePress?: (messageId: string) => void;
  isHighlighted?: boolean; // For visual feedback when scrolling to message
}

// Don't memoize - we want re-renders when reactions change
export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  onReactionPress,
  onReplyPress,
  onQuotedMessagePress,
  isHighlighted = false,
}) => {
  const { user } = useAuthStore();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | undefined>();
  
  // Subscribe directly to this message in the store to ensure re-renders when reactions change
  // This bypasses FlashList's change detection and ensures the component always has the latest data
  // The store is the source of truth, so we always use the store message if found
  const storeMessage = useChatStore((state) => {
    const roomMessages = state.messages[message.roomId] || [];
    // Try to find by id first, then by tempId, and also check if tempId matches id (for optimistic messages that were replaced)
    const found = roomMessages.find(m => {
      // Exact ID match (most common case)
      if (m.id === message.id) return true;
      // TempId match (for optimistic messages that haven't been replaced yet)
      if (message.tempId && m.tempId === message.tempId) return true;
      // If message has tempId but store message has real id, check if they're the same message
      // (optimistic message was replaced with real message)
      if (message.tempId && m.id && !m.tempId) {
        // Check if this might be the same message by content, sender, and time
        const timeDiff = Math.abs(new Date(m.createdAt).getTime() - new Date(message.createdAt).getTime());
        const isMatch = (
          m.content === message.content &&
          m.senderId === message.senderId &&
          (m.replyToMessageId || null) === (message.replyToMessageId || null) &&
          timeDiff < 5000
        );
        if (isMatch) {
          console.log(`[MessageBubble] Found message by content match: tempId ${message.tempId} -> real ID ${m.id}`);
        }
        return isMatch;
      }
      return false;
    });
    
    if (found) {
      // Always use store message - it's the source of truth
      return found;
    }
    
    // If not found in store, use prop message (might be a new message that hasn't been added to store yet)
    return message;
  });
  
  // Always use store message - it's the source of truth and will have the latest reactions
  const currentMessage = storeMessage;

  // Use currentMessage instead of message to ensure we have the latest reaction data
  const msg = currentMessage;
  const isOwnMessage = msg.senderId === user?.id;
  
  // Aggregate reactions summary if not provided
  const reactionsSummary = msg.reactionsSummary || (() => {
    if (!msg.reactions || msg.reactions.length === 0) return [];
    const reactionMap = new Map<string, number>();
    msg.reactions.forEach((r) => {
      reactionMap.set(r.emoji, (reactionMap.get(r.emoji) || 0) + 1);
    });
    return Array.from(reactionMap.entries()).map(([emoji, count]) => ({ emoji, count }));
  })();

  // Get current user's reaction
  const currentUserReaction = msg.currentUserReaction || 
    (msg.reactions?.find((r) => r.userId === user?.id)?.emoji || null);

  // Get display name - prioritize senderName, then sender.name, then email prefix, then user ID
  const getDisplayName = () => {
    if (msg.senderType === 'agent') {
      return `🤖 ${msg.senderName || 'Agent'}`;
    }
    if (msg.senderName) {
      return msg.senderName;
    }
    if (msg.sender?.name) {
      return msg.sender.name;
    }
    // Try to extract email prefix from senderId if it looks like an email
    if (msg.senderId?.includes('@')) {
      return msg.senderId.split('@')[0];
    }
    // Fallback to first 8 chars of user ID
    return `User ${msg.senderId?.slice(0, 8) || 'Unknown'}`;
  };

  const handleLongPress = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setMenuPosition({ x: pageX - 100, y: pageY - 100 });
    setShowContextMenu(true);
  };

  const handleReaction = (emoji: string) => {
    const isRemoving = currentUserReaction === emoji;
    onReactionPress?.(msg.id, isRemoving ? null : emoji);
  };

  return (
    <>
      <View style={styles.messageWrapper}>
        <Pressable
          onLongPress={handleLongPress}
          style={[
            styles.container,
            isOwnMessage ? styles.ownMessage : styles.otherMessage,
            isHighlighted && (isOwnMessage ? styles.highlightedOwnMessage : styles.highlightedOtherMessage),
            isHighlighted && styles.highlighted,
            // Add bottom padding only when reactions are present to make room for them
            (reactionsSummary.length > 0 || currentUserReaction) && styles.containerWithReactions,
          ]}
        >
          {!isOwnMessage && (
            <Text style={styles.senderName}>
              {getDisplayName()}
            </Text>
          )}
          
          {/* Show quoted message if this is a reply - positioned on same side as message */}
          {msg.replyTo && (
            <View style={styles.replyContainer}>
              <QuotedMessageCard
                message={msg.replyTo}
                variant="inline"
                isOwnMessage={isOwnMessage}
                onPress={() => onQuotedMessagePress?.(msg.replyToMessageId || '')}
              />
            </View>
          )}
          
          <Text style={[styles.content, isOwnMessage && styles.ownContent]}>
            {msg.content}
          </Text>
          
          <View style={styles.footer}>
            <Text style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}>
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </Pressable>
        
        {/* Reactions - positioned at bottom, partially outside the message bubble - only show when reactions exist */}
        {(reactionsSummary.length > 0 || currentUserReaction) && (
          <View style={[
            styles.reactionsWrapper,
            isOwnMessage ? styles.reactionsWrapperOwn : styles.reactionsWrapperOther,
          ]}>
            <MessageReactionButton
              messageId={msg.id}
              roomId={msg.roomId}
              currentReaction={currentUserReaction}
              reactionsSummary={reactionsSummary}
              onReactionChange={(emoji) => onReactionPress?.(msg.id, emoji)}
            />
          </View>
        )}
      </View>

      <MessageContextMenu
        visible={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        onReaction={handleReaction}
        onReply={() => onReplyPress?.(msg)}
        position={menuPosition}
        isOwnMessage={isOwnMessage}
      />
    </>
  );
};

const styles = StyleSheet.create({
  messageWrapper: {
    position: 'relative',
  },
  container: {
    maxWidth: '75%',
    padding: Platform.OS === 'ios' ? 14 : 13, // Larger padding on iOS, slightly increased on Android
    borderRadius: 16,
    marginVertical: 12, // Increased spacing to prevent reactions from overlapping
    marginHorizontal: 12,
  },
  containerWithReactions: {
    paddingBottom: 20, // Extra padding at bottom to make room for reactions (only when reactions exist)
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  highlightedOwnMessage: {
    backgroundColor: '#0056CC', // Darker blue when highlighted
  },
  highlightedOtherMessage: {
    backgroundColor: '#E8F4FD', // Light blue background when highlighted
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  replyContainer: {
    marginBottom: 8,
  },
  replyContainerOwn: {
    // Reply container for own messages - no special styling needed
  },
  senderName: {
    fontSize: Platform.OS === 'ios' ? 15 : 13, // Larger on iOS, slightly increased on Android
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  content: {
    fontSize: Platform.OS === 'ios' ? 19 : 17, // Larger on iOS, slightly increased on Android
    color: '#000',
    lineHeight: Platform.OS === 'ios' ? 26 : 22, // Larger on iOS, slightly increased on Android
  },
  ownContent: {
    color: '#FFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: Platform.OS === 'ios' ? 14 : 12, // Larger on iOS, slightly increased on Android
    color: '#666',
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  replyButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  replyButtonText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '500',
  },
  highlighted: {
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  // Reactions wrapper - positioned at bottom, partially outside the bubble
  reactionsWrapper: {
    position: 'absolute',
    bottom: 0, // Positioned at the bottom edge of the message bubble
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1, // Ensure reactions appear above other messages
  },
  reactionsWrapperOwn: {
    right: 4, // Position on the right for own messages
  },
  reactionsWrapperOther: {
    left: 4, // Position on the left for other messages
  },
});

