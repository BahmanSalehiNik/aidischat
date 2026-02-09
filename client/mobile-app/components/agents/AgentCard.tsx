import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AgentWithProfile } from '../../utils/api';
import { formatBreedLabel } from '../../constants/agentConstants';
import { agentCardStyles as styles } from './styles/agentCardStyles';
import { mediaApi } from '../../utils/api';

interface AgentCardProps {
  agent: AgentWithProfile;
  onPress: () => void;
  onProfilePress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return '#34C759';
    case 'pending':
      return '#FF9500';
    case 'failed':
      return '#FF3B30';
    default:
      return '#8E8E93';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onPress, onProfilePress, onEdit, onDelete }) => {
  const profile = agent.agentProfile;
  const displayName = profile?.displayName || profile?.name || 'Unnamed Agent';
  const profession = profile?.profession || 'No profession';
  const breed = profile?.breed ? formatBreedLabel(profile.breed) : null;
  const statusColor = getStatusColor(agent.agent.status);
  const [signedAvatarUrl, setSignedAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const agentId = agent?.agent?.id;
    const raw = profile?.avatarUrl;
    if (!agentId || !raw || typeof raw !== 'string') {
      setSignedAvatarUrl(null);
      return;
    }
    // If already signed (contains SAS query), use it directly.
    if (raw.includes('?')) {
      setSignedAvatarUrl(raw);
      return;
    }

    (async () => {
      try {
        const primary = await mediaApi.listByOwner(String(agentId), 'profile:avatar', { limit: 1, expiresSeconds: 60 * 60 * 6 });
        const firstPrimary = Array.isArray(primary) && primary.length ? primary[0] : null;
        const fallback = !firstPrimary
          ? await mediaApi.listByOwner(String(agentId), 'profile', { limit: 1, expiresSeconds: 60 * 60 * 6 })
          : null;
        const firstFallback = Array.isArray(fallback) && fallback?.length ? fallback[0] : null;

        const m = firstPrimary || firstFallback;
        const url = m?.downloadUrl || m?.url || raw;
        if (!cancelled) setSignedAvatarUrl(url ? String(url) : null);
      } catch {
        if (!cancelled) setSignedAvatarUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agent?.agent?.id, profile?.avatarUrl]);

  return (
    <View style={styles.agentCard}>
      <TouchableOpacity style={styles.agentCardContent} onPress={onPress}>
        <TouchableOpacity activeOpacity={0.7} onPress={onProfilePress}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: String(signedAvatarUrl || profile.avatarUrl) }} style={styles.agentAvatar} />
          ) : (
            <View style={styles.agentAvatarPlaceholder}>
              <Ionicons name="sparkles" size={32} color="#8E8E93" />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.agentInfo}>
          <TouchableOpacity activeOpacity={0.7} onPress={onProfilePress}>
            <Text style={styles.agentName}>{displayName}</Text>
          </TouchableOpacity>
          <View style={styles.agentDetails}>
            {breed && <Text style={styles.agentBreed}>{breed}</Text>}
            <Text style={styles.agentProfession}>{profession}</Text>
          </View>
          <View style={styles.agentMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(agent.agent.status)}
              </Text>
            </View>
            <Text style={styles.modelText}>
              {agent.agent.modelProvider} • {agent.agent.modelName}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
      {(onEdit || onDelete) && (
        <View style={styles.actionButtons}>
          {onEdit && (
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Ionicons name="create-outline" size={18} color="#007AFF" />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

