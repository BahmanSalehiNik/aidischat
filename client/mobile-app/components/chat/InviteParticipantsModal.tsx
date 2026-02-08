import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { roomApi, agentsApi, searchApi, AgentWithProfile, SearchResult } from '../../utils/api';
import { inviteParticipantsStyles as styles } from './styles/inviteParticipantsStyles';
import { useRouter } from 'expo-router';

type InviteCategory = 'people' | 'myAgents' | 'otherAgents';

interface InviteParticipantsModalProps {
  visible: boolean;
  roomId: string;
  roomName?: string;
  existingMemberIds: string[];
  onClose: () => void;
}

interface InviteOption {
  id: string;
  label: string;
  subtitle?: string;
  avatarUrl?: string;
  type: 'human' | 'agent';
}

const TAB_CONFIG: Array<{ key: InviteCategory; label: string }> = [
  { key: 'people', label: 'People' },
  { key: 'myAgents', label: 'My Agents' },
  { key: 'otherAgents', label: 'Other Agents' },
];

export const InviteParticipantsModal: React.FC<InviteParticipantsModalProps> = ({
  visible,
  roomId,
  roomName,
  existingMemberIds,
  onClose,
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<InviteCategory>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<InviteOption[]>([]);
  const [myAgents, setMyAgents] = useState<InviteOption[]>([]);
  const [myAgentsLoading, setMyAgentsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitedMap, setInvitedMap] = useState<Record<string, boolean>>({});

  const memberIdSet = useMemo(() => new Set(existingMemberIds || []), [existingMemberIds]);

  const resetState = useCallback(() => {
    setActiveTab('people');
    setSearchQuery('');
    setSearchResults([]);
    setMyAgents([]); // Reset agents list when modal closes
    setMyAgentsLoading(false);
    setErrorMessage(null);
    setInvitingId(null);
    setInvitedMap({});
  }, []);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

  useEffect(() => {
    // Only load agents when:
    // 1. Modal is visible
    // 2. "My Agents" tab is active
    // 3. Agents haven't been loaded yet (or were reset)
    // 4. Not currently loading
    if (!visible || activeTab !== 'myAgents' || myAgentsLoading) {
      return;
    }

    // If agents are already loaded, don't reload (unless we explicitly want to refresh)
    if (myAgents.length > 0) {
      return;
    }

    const loadAgents = async () => {
      try {
        setMyAgentsLoading(true);
        setErrorMessage(null); // Clear any previous errors
        const response = await agentsApi.getAgents();
        const mapped = response.map(mapAgentToOption);
        setMyAgents(mapped);
      } catch (error: any) {
        console.error('Error loading agents:', error);
        setErrorMessage(error?.message || 'Failed to load your agents');
        setMyAgents([]); // Ensure empty array on error
      } finally {
        setMyAgentsLoading(false);
      }
    };

    loadAgents();
  }, [visible, activeTab]); // Removed myAgents.length and myAgentsLoading from deps to allow reload when tab changes

  useEffect(() => {
    if (!visible || activeTab === 'myAgents') {
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setErrorMessage(null);

    const timeout = setTimeout(async () => {
      try {
        const types = activeTab === 'people' ? ['users'] : ['agents'];
        const response = await searchApi.autocomplete(searchQuery.trim(), 8, types);
        const list =
          activeTab === 'people'
            ? response.users || []
            : response.agents || [];
        setSearchResults(list.map((entry) => mapSearchResultToOption(entry, activeTab)));
      } catch (error: any) {
        setErrorMessage(error?.message || 'Search failed. Please try again.');
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [visible, activeTab, searchQuery]);

  const handleInvite = async (option: InviteOption) => {
    setInvitingId(option.id);
    setErrorMessage(null);
    try {
      await roomApi.addParticipant(roomId, {
        participantId: option.id,
        participantType: option.type,
        role: 'member',
      });
      setInvitedMap((prev) => ({ ...prev, [option.id]: true }));
      Alert.alert('Invite sent', `${option.label} now has access to this chat.`);
    } catch (error: any) {
      const message = error?.message || 'Failed to send invite';
      setErrorMessage(message);
      Alert.alert('Unable to invite', message);
    } finally {
      setInvitingId(null);
    }
  };

  const renderResults = () => {
    if (activeTab === 'myAgents') {
      if (myAgentsLoading) {
        return <ActivityIndicator color="#007AFF" style={styles.loadingIndicator} />;
      }
      if (!myAgents.length) {
        return (
          <Text style={styles.emptyState}>
            You haven’t created any agents yet. Create one to invite it into this room.
          </Text>
        );
      }
      return myAgents.map((agent) => renderInviteRow(agent));
    }

    if (!searchQuery.trim()) {
      return (
        <Text style={styles.emptyState}>
          Start typing to search {activeTab === 'people' ? 'people' : 'public agents'} to invite.
        </Text>
      );
    }

    if (searchLoading) {
      return <ActivityIndicator color="#007AFF" style={styles.loadingIndicator} />;
    }

    if (!searchResults.length) {
      return <Text style={styles.emptyState}>No matches found. Try a different query.</Text>;
    }

    return searchResults.map((result) => renderInviteRow(result));
  };

  const renderInviteRow = (option: InviteOption) => {
    const isMember = memberIdSet.has(option.id);
    const isInvited = invitedMap[option.id];
    const disabled = isMember || isInvited || invitingId === option.id;
    const actionLabel = isMember ? 'Member' : isInvited ? 'Invited' : 'Invite';

    return (
      <View key={option.id} style={styles.resultRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            router.push({
              pathname: '/(main)/EntityProfileScreen',
              params: { entityType: option.type === 'agent' ? 'agent' : 'user', entityId: String(option.id) },
            });
            onClose();
          }}
        >
          {option.avatarUrl ? (
            <Image source={{ uri: option.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{option.label.charAt(0)}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.resultTextContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              router.push({
                pathname: '/(main)/EntityProfileScreen',
                params: { entityType: option.type === 'agent' ? 'agent' : 'user', entityId: String(option.id) },
              });
              onClose();
            }}
          >
            <Text style={styles.resultTitle}>{option.label}</Text>
          </TouchableOpacity>
          {!!option.subtitle && <Text style={styles.resultSubtitle}>{option.subtitle}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.inviteActionButton, disabled && styles.inviteActionButtonDisabled]}
          onPress={() => handleInvite(option)}
          disabled={disabled}
        >
          {invitingId === option.id ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.inviteActionButtonText}>{actionLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 55 : 0}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Invite to {roomName || 'this room'}</Text>
              <Text style={styles.sheetSubtitle}>Bring people or agents into the conversation</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#101828" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            {TAB_CONFIG.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
                onPress={() => {
                  setActiveTab(tab.key);
                  // Reset search when switching tabs
                  if (tab.key !== 'myAgents') {
                    setSearchQuery('');
                    setSearchResults([]);
                  }
                  // Reset agents list when switching away from "My Agents" to allow reload
                  if (tab.key !== 'myAgents') {
                    setMyAgents([]);
                  }
                }}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTab === tab.key && styles.tabButtonTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab !== 'myAgents' && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#667085" />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${activeTab === 'people' ? 'people' : 'agents'}...`}
                placeholderTextColor="#98A2B3"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={activeTab === 'people'}
              />
            </View>
          )}

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <ScrollView
            style={styles.resultsScroll}
            contentContainerStyle={styles.resultsContent}
            keyboardShouldPersistTaps="handled"
          >
            {renderResults()}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const mapAgentToOption = (entry: AgentWithProfile): InviteOption => {
  const profile = entry.agentProfile;
  const displayName =
    profile?.displayName ||
    profile?.name ||
    profile?.title ||
    `Agent ${entry.agent.id.slice(-4)}`;
  return {
    id: entry.agent.id,
    label: displayName,
    subtitle: profile?.title || profile?.profession || entry.agent.modelName,
    avatarUrl: profile?.avatarUrl,
    type: 'agent',
  };
};

const mapSearchResultToOption = (result: SearchResult, tab: InviteCategory): InviteOption => ({
  id: result.id,
  label: result.title,
  subtitle: result.subtitle || result.snippet,
  avatarUrl: result.avatarUrl,
  type: tab === 'people' ? 'human' : 'agent',
});

