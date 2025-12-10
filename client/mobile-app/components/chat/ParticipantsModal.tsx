import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { roomApi, searchApi } from '../../utils/api';

interface Participant {
  id: string;
  name?: string;
  type?: 'human' | 'agent';
}

interface ParticipantsModalProps {
  visible: boolean;
  roomId?: string;
  roomName?: string;
  participantIds: string[];
  messages?: Array<{ 
    senderId: string; 
    senderName?: string; 
    senderType?: 'human' | 'agent';
    sender?: { id: string; name?: string; email?: string; avatar?: string };
  }>; // Optional messages to extract names from
  onClose: () => void;
}

export const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
  visible,
  roomId,
  roomName,
  participantIds,
  messages = [],
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && participantIds.length > 0) {
      loadParticipants();
    } else {
      setParticipants([]);
    }
  }, [visible, participantIds.length, participantIds.join(','), messages.length, JSON.stringify(messages.map(m => ({ id: m.senderId, name: m.senderName })))]);

  const loadParticipants = async () => {
    setLoading(true);
    try {
      // First, try to extract names from messages (most reliable source)
      const nameMap = new Map<string, { name?: string; type?: 'human' | 'agent' }>();
      messages.forEach((msg) => {
        if (msg.senderId) {
          // Normalize senderId (trim whitespace, convert to string)
          const normalizedSenderId = String(msg.senderId).trim();
          
          // Use senderName if available, otherwise try to extract from sender object
          // Also check if sender has email and extract prefix
          const name = msg.senderName || 
                      (msg as any).sender?.name || 
                      ((msg as any).sender?.email ? (msg as any).sender.email.split('@')[0] : null);
          const type = msg.senderType || (msg as any).senderType || 'human';
          
          if (name) {
            // Only set if we don't already have a better name for this ID
            const existing = nameMap.get(normalizedSenderId);
            if (!existing || !existing.name || existing.name.length < name.length) {
              nameMap.set(normalizedSenderId, {
                name,
                type: type as 'human' | 'agent',
              });
              console.log(`[ParticipantsModal] Added to nameMap: ${normalizedSenderId} -> ${name} (${type})`);
            }
          } else {
            console.log(`[ParticipantsModal] No name found for senderId: ${normalizedSenderId}, senderName: ${msg.senderName}, sender.name: ${(msg as any).sender?.name}`);
          }
        }
      });
      
      console.log('[ParticipantsModal] Name map from messages:', Array.from(nameMap.entries()));
      console.log('[ParticipantsModal] Participant IDs:', participantIds);
      console.log('[ParticipantsModal] Messages count:', messages.length);
      console.log('[ParticipantsModal] Messages with senderName:', messages.filter(m => m.senderName).length);
      console.log('[ParticipantsModal] Messages with sender.name:', messages.filter(m => (m as any).sender?.name).length);
      
      // Debug: Check if participant IDs match message senderIds
      const messageSenderIds = new Set(messages.map(m => m.senderId).filter(Boolean));
      const participantIdSet = new Set(participantIds);
      const matchingIds = participantIds.filter(id => messageSenderIds.has(id));
      const missingFromMessages = participantIds.filter(id => !messageSenderIds.has(id));
      console.log('[ParticipantsModal] ID matching:', {
        participantIdsCount: participantIds.length,
        messageSenderIdsCount: messageSenderIds.size,
        matchingIds,
        missingFromMessages,
        nameMapKeys: Array.from(nameMap.keys()),
      });

      // Try to get room details which might include participant info
      // This is optional - we can work with just participantIds and messages
      // Note: If this fails, we'll use participantIds and messages instead
      let roomData: any = null;
      if (roomId) {
        try {
          roomData = await roomApi.getRoom(roomId);
          console.log('[ParticipantsModal] Successfully fetched room details');
        } catch (error: any) {
          // Room lookup failed - this could be:
          // 1. User is not a participant (403) - but we're in the chat, so this shouldn't happen
          // 2. Room not found (404) - room might be deleted or there's a data inconsistency
          // Continue without room data - we have participantIds and messages which is sufficient
          console.warn('[ParticipantsModal] Could not fetch room details, using participantIds and messages instead:', {
            roomId,
            error: error?.message,
            status: error?.status,
          });
          // Continue without room data - we have participantIds and messages
        }
      }

      // If room data has participants with details, use that (PREFERRED - most reliable)
      if (roomData?.participants && Array.isArray(roomData.participants)) {
        console.log('[ParticipantsModal] Using participants from room data:', roomData.participants.length);
        
        // Process participants and fetch missing agent names
        const participantList = await Promise.all(
          roomData.participants.map(async (p: { participantId?: string; id?: string; name?: string; username?: string; email?: string; participantType?: string; type?: string }) => {
            const id = p.participantId || p.id;
            if (!id) return null; // Skip if no ID
            
            // Normalize ID for comparison (trim whitespace, convert to string)
            const normalizedId = String(id).trim();
            const fromMessages = nameMap.get(normalizedId);
            console.log(`[ParticipantsModal] Processing participant ${id}:`, {
              participantId: id,
              normalizedId,
              fromRoomData: { 
                name: p.name, 
                username: p.username, 
                email: p.email,
                participantType: p.participantType,
                type: p.type,
              },
              fromMessages: fromMessages ? { name: fromMessages.name, type: fromMessages.type } : null,
            });
            
            // Determine participant type - prioritize room data, then messages, then heuristics
            // If no email address, it's likely an agent (MongoDB ObjectId), otherwise human
            const isEmail = normalizedId.includes('@');
            const participantType = p.participantType || p.type || fromMessages?.type || 
                                   (isEmail ? 'human' : 'agent');
            
            // Priority: fromMessages (most reliable) > p.name (from room service) > p.username > email prefix > fetch from API (for agents) > fallback
            // CRITICAL: Check fromMessages FIRST if it's an agent, since messages have the most reliable name
            // Also check if p.name is just a placeholder (starts with "agent_" or equals the ID)
            // This handles cases where room data returns placeholder names like "agent_1765025168144"
            const isPlaceholderName = p.name && (
              p.name.startsWith('agent_') || 
              p.name === normalizedId || 
              p.name === id ||
              p.name === `agent_${normalizedId}` ||
              p.name === `agent_${id}` ||
              p.name.startsWith('User ')
            );
            
            // Get email prefix, but check if it's also a placeholder
            const emailPrefix = p.email?.split('@')[0];
            const isEmailPrefixPlaceholder = emailPrefix && (
              emailPrefix.startsWith('agent_') ||
              emailPrefix === normalizedId ||
              emailPrefix === id
            );
            
            // Priority: fromMessages (most reliable) > p.name (if not placeholder) > p.username > email prefix (if not placeholder) > fetch from API (for agents) > fallback
            let name = fromMessages?.name || 
                      (!isPlaceholderName ? p.name : null) || 
                      p.username || 
                      (!isEmailPrefixPlaceholder ? emailPrefix : null);
            
            console.log(`[ParticipantsModal] Name resolution for ${normalizedId}:`, {
              fromMessagesName: fromMessages?.name,
              roomDataName: p.name,
              isPlaceholderName,
              roomDataUsername: p.username,
              currentName: name,
              participantType,
              hasParticipantType: !!(p.participantType || p.type),
              isEmail,
              willTryAgentAPI: !name && (participantType === 'agent' || !isEmail),
            });
            
            // If name is still missing, try to fetch it
            // Strategy: If it's not an email (likely an agent with MongoDB ObjectId), try agent API first
            // If that fails or it's an email, fall back to user search or default
            if (!name) {
              // Try agent API if:
              // 1. It's explicitly an agent, OR
              // 2. It's not an email (MongoDB ObjectId format, likely an agent)
              const shouldTryAgent = participantType === 'agent' || !isEmail;
              
              if (shouldTryAgent) {
                console.log(`[ParticipantsModal] No name found for ${participantType === 'agent' ? 'agent' : 'non-email participant'} ${normalizedId}, trying agent API...`);
                try {
                  const { agentsApi } = await import('../../utils/api');
                  try {
                    const agentResponse = await agentsApi.getAgent(normalizedId);
                    // The API returns { agent, agentProfile }, and name is in agentProfile
                    const agentProfile = (agentResponse as any).agentProfile;
                    name = agentProfile?.name || agentProfile?.displayName || (agentResponse as any).agent?.name;
                    if (name) {
                      console.log(`[ParticipantsModal] ✅ Fetched agent name from API for ${normalizedId}: ${name}`);
                    } else {
                      console.warn(`[ParticipantsModal] ⚠️ Agent API returned no name for ${normalizedId}`, {
                        hasAgent: !!(agentResponse as any).agent,
                        hasAgentProfile: !!agentProfile,
                        agentProfileName: agentProfile?.name,
                        agentProfileDisplayName: agentProfile?.displayName,
                      });
                    }
                  } catch (agentError: any) {
                    console.log(`[ParticipantsModal] Agent API call failed for ${normalizedId} (${agentError?.status || agentError?.message}), trying search...`);
                    // Try search as fallback
                    try {
                      const agentSearchResult = await searchApi.autocomplete(normalizedId, 1, ['agents']);
                      if (agentSearchResult.agents && agentSearchResult.agents.length > 0) {
                        const agent = agentSearchResult.agents.find((a: any) => a.id === normalizedId) || agentSearchResult.agents[0];
                        if (agent) {
                          name = (agent as any).title || (agent as any).subtitle || (agent as any).snippet;
                          if (name) {
                            console.log(`[ParticipantsModal] ✅ Fetched agent name from search for ${normalizedId}: ${name}`);
                          }
                        }
                      } else {
                        console.log(`[ParticipantsModal] No agent found in search for ${normalizedId}`);
                      }
                    } catch (searchError) {
                      console.log(`[ParticipantsModal] Search also failed for ${normalizedId}:`, searchError);
                    }
                  }
                } catch (error) {
                  console.error(`[ParticipantsModal] Error importing agentsApi for ${normalizedId}:`, error);
                }
              }
              
              // If still no name and it's an email, we already tried email prefix above
              // For non-emails that failed agent API, we'll use fallback below
              if (!name && isEmail) {
                console.log(`[ParticipantsModal] No name found for human ${normalizedId}, using email prefix fallback`);
              }
            }
            
            // Final fallback if name is still missing
            if (!name) {
              name = id.includes('@') ? id.split('@')[0] : `User ${id.slice(0, 8)}`;
            }
            
            return {
              id: normalizedId,
              name,
              type: participantType as 'human' | 'agent',
            };
          })
        );
        
        const filteredList = participantList.filter((p: Participant | null): p is Participant => p !== null);
        console.log('[ParticipantsModal] Participant list with names:', filteredList.map((p: Participant) => ({ id: p.id, name: p.name, type: p.type })));
        setParticipants(filteredList);
        setLoading(false);
        return;
      }

      // Otherwise, try to fetch details for each participant individually
      const participantList: Participant[] = await Promise.all(
        participantIds.map(async (id) => {
          // First check if we have name from messages (most reliable - already denormalized)
          const fromMessages = nameMap.get(id);
          if (fromMessages?.name) {
            console.log(`[ParticipantsModal] Using name from messages for ${id}: ${fromMessages.name}`);
            return {
              id,
              name: fromMessages.name, // Use the name from messages directly
              type: fromMessages.type || 'human',
            };
          }
          
          // If we have type from messages but no name, still use the type
          const typeFromMessages = fromMessages?.type;

          // Check if it's an email (human user) - extract email prefix
          if (id.includes('@')) {
            const emailPrefix = id.split('@')[0];
            console.log(`[ParticipantsModal] Email detected for ${id}, prefix: ${emailPrefix}`);
            // Always use email prefix as name for emails (most reliable)
            // Try to search for user details to get their name, but don't wait if it fails
            const searchPromise = searchApi.autocomplete(emailPrefix, 5, ['users'])
              .then((searchResult) => {
                if (searchResult.users && searchResult.users.length > 0) {
                  // Find the user that matches this email
                  const user = searchResult.users.find((u: any) => 
                    u.id === id || (u as any).email === id || (u as any).username === emailPrefix
                  ) || searchResult.users[0];
                  
                  // SearchResult has title, subtitle, snippet
                  return (user as any).title || (user as any).subtitle || emailPrefix;
                }
                return emailPrefix;
              })
              .catch(() => emailPrefix);
            
            // For now, use email prefix immediately (we can enhance later to update with search results)
            console.log(`[ParticipantsModal] Using email prefix for ${id}: ${emailPrefix}`);
            return {
              id,
              name: emailPrefix, // Always use email prefix for emails
              type: 'human' as const,
            };
          }
          
          // MongoDB ObjectIds are 24 chars - they can be either human or agent
          // Don't assume long IDs are agents. Try to determine type from messages or search.
          
          // If we know the type from messages, use it to guide our search
          const knownType = typeFromMessages;
          
          // First, try to search for user (more common case, or if we know it's human)
          // Skip agent API entirely if we don't know it's an agent - prevents 404 errors
          if (!knownType || knownType === 'human') {
            try {
              // Try searching by ID first
              const userSearchResult = await searchApi.autocomplete(id, 5, ['users']);
              if (userSearchResult.users && userSearchResult.users.length > 0) {
                // Try to find exact match by ID
                const exactMatch = userSearchResult.users.find((u: any) => u.id === id);
                if (exactMatch) {
                  // SearchResult has title, subtitle, snippet - use title as name, or extract from subtitle
                  const userName = (exactMatch as any).title || (exactMatch as any).subtitle || (exactMatch as any).snippet;
                  if (userName) {
                    console.log(`[ParticipantsModal] Found user by ID search for ${id}: ${userName}`);
                    return {
                      id,
                      name: userName,
                      type: 'human' as const,
                    };
                  }
                }
                // If no exact match, try first result (might be close)
                const firstUser = userSearchResult.users[0];
                if (firstUser) {
                  const userName = (firstUser as any).title || (firstUser as any).subtitle || (firstUser as any).snippet;
                  if (userName) {
                    console.log(`[ParticipantsModal] Using first user result for ${id}: ${userName}`);
                    return {
                      id,
                      name: userName,
                      type: 'human' as const,
                    };
                  }
                }
              }
            } catch (error) {
              console.log(`[ParticipantsModal] User search failed for ${id}:`, error);
              // Continue to fallback
            }
          }
          
          // If we explicitly know it's an agent from messages, try agent API
          // This prevents 404 errors for human users
          if (knownType === 'agent') {
            try {
              const { agentsApi } = await import('../../utils/api');
              try {
                const agent = await agentsApi.getAgent(id);
                const agentName = agent.name || agent.username;
                if (agentName) {
                  console.log(`[ParticipantsModal] Found agent by API for ${id}: ${agentName}`);
                  return {
                    id,
                    name: agentName,
                    type: 'agent' as const,
                  };
                }
              } catch (agentError: any) {
                // Try search as fallback (404 is expected and suppressed in API client)
                const agentSearchResult = await searchApi.autocomplete(id, 1, ['agents']);
                if (agentSearchResult.agents && agentSearchResult.agents.length > 0) {
                  const agent = agentSearchResult.agents.find((a: any) => a.id === id) || agentSearchResult.agents[0];
                  if (agent) {
                    // SearchResult has title, subtitle, snippet - use title as name
                    const agentName = (agent as any).title || (agent as any).subtitle || (agent as any).snippet;
                    if (agentName) {
                      console.log(`[ParticipantsModal] Found agent by search for ${id}: ${agentName}`);
                      return {
                        id,
                        name: agentName,
                        type: 'agent' as const,
                      };
                    }
                  }
                }
              }
            } catch (error: any) {
              // Fall through to default
            }
          }
          
          // Final fallback - default to human (more common) unless explicitly contains 'agent'
          // Use email prefix if it's an email, otherwise try to get email from current user
          let fallbackName: string;
          let fallbackType: 'human' | 'agent' = knownType || 'human';
          
          if (id.includes('@')) {
            fallbackName = id.split('@')[0]; // Email prefix
            fallbackType = 'human';
          } else if (id.toLowerCase().includes('agent') || knownType === 'agent') {
            fallbackName = `Agent ${id.slice(0, 8)}`;
            fallbackType = 'agent';
          } else {
            // Default to human for unknown IDs (MongoDB ObjectIds are usually users)
            // Try to get current user's email prefix if this is the current user
            try {
              const { useAuthStore } = await import('../../store/authStore');
              const { user } = useAuthStore.getState();
              if (user && user.id === id && user.email) {
                fallbackName = user.email.split('@')[0];
                console.log(`[ParticipantsModal] Using current user email prefix for ${id}: ${fallbackName}`);
              } else {
                // For other users, we don't have their email, so use short ID
                // But this should rarely happen if messages have senderName
                fallbackName = `User ${id.slice(0, 8)}`;
                console.log(`[ParticipantsModal] No name found for ${id}, using fallback: ${fallbackName}`);
              }
            } catch (error) {
              fallbackName = `User ${id.slice(0, 8)}`;
            }
            fallbackType = 'human';
          }
          
          return {
            id,
            name: fallbackName,
            type: fallbackType,
          };
        })
      );
      
      // Ensure all participants have a name (never use the full ID as name)
      // Also ensure type is correct - default to human unless explicitly agent
      const finalList = participantList.map(p => {
        let name = p.name && p.name !== p.id 
          ? p.name 
          : (p.id.includes('@') 
            ? p.id.split('@')[0] 
            : (p.id.toLowerCase().includes('agent')
              ? `Agent ${p.id.slice(0, 8)}`
              : `User ${p.id.slice(0, 8)}`));
        
        // Fix type - only set to agent if explicitly contains 'agent' or we confirmed it's an agent
        // MongoDB ObjectIds (24 chars) are usually users, not agents
        let type = p.type;
        if (!p.type || (p.type === 'agent' && !p.id.toLowerCase().includes('agent') && p.name?.toLowerCase().includes('user'))) {
          // If type was incorrectly set to agent but name suggests user, fix it
          type = 'human';
        }
        
        return {
          ...p,
          name,
          type,
        };
      });
      
      console.log('[ParticipantsModal] Final participant list:', finalList);
      setParticipants(finalList);
    } catch (error) {
      console.error('Error loading participants:', error);
      // Fallback: create basic participant list from IDs with email prefix extraction
      setParticipants(
        participantIds.map((id) => {
          // Always extract email prefix if it's an email
          let name: string;
          if (id.includes('@')) {
            name = id.split('@')[0];
          } else if (id.length > 20 || id.toLowerCase().includes('agent')) {
            name = `Agent ${id.slice(0, 8)}`;
          } else {
            name = `User ${id.slice(0, 8)}`;
          }
          
          return {
            id,
            name,
            type: (id.includes('agent') || id.length > 24 ? 'agent' : 'human') as 'human' | 'agent',
          };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Participants</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          <Text style={styles.roomName}>{roomName || 'Conversation'}</Text>
          <Text style={styles.participantCount}>
            {participantIds.length} {participantIds.length === 1 ? 'participant' : 'participants'}
          </Text>

          <View style={styles.participantsList}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            ) : participantIds.length === 0 ? (
              <Text style={styles.emptyText}>No participants yet</Text>
            ) : (
              participants.map((participant, index) => (
                <View key={participant.id || index} style={styles.participantItem}>
                  <View style={[
                    styles.avatar,
                    participant.type === 'agent' && styles.avatarAgent
                  ]}>
                    <Ionicons 
                      name={participant.type === 'agent' ? 'sparkles' : 'person'} 
                      size={24} 
                      color={participant.type === 'agent' ? '#FF6B6B' : '#007AFF'} 
                    />
                  </View>
                  <View style={styles.participantInfo}>
                    <View style={styles.participantNameRow}>
                      <Text style={styles.participantName}>
                        {participant.name || 
                         (participant.id.includes('@') 
                          ? participant.id.split('@')[0] 
                          : `User ${participant.id.slice(0, 8)}`)}
                      </Text>
                      {participant.type && (
                        <View style={[
                          styles.typeBadge,
                          participant.type === 'agent' && styles.typeBadgeAgent
                        ]}>
                          <Text style={[
                            styles.typeText,
                            participant.type === 'agent' && styles.typeTextAgent
                          ]}>
                            {participant.type === 'agent' ? 'AI' : 'Human'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.participantId}>{participant.id}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  roomName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  participantCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  participantsList: {
    gap: 12,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  typeBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeAgent: {
    backgroundColor: '#FFE5E5',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#007AFF',
  },
  typeTextAgent: {
    color: '#FF6B6B',
  },
  participantId: {
    fontSize: 12,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  avatarAgent: {
    backgroundColor: '#FFE5E5',
  },
});

