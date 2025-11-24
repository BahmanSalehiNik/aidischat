import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AgentWithProfile } from '../../utils/api';
import { formatBreedLabel } from '../../constants/agentConstants';
import { agentCardStyles as styles } from './styles/agentCardStyles';

interface AgentCardProps {
  agent: AgentWithProfile;
  onPress: () => void;
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

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onPress }) => {
  const profile = agent.agentProfile;
  const displayName = profile?.displayName || profile?.name || 'Unnamed Agent';
  const profession = profile?.profession || 'No profession';
  const breed = profile?.breed ? formatBreedLabel(profile.breed) : null;
  const statusColor = getStatusColor(agent.agent.status);

  return (
    <TouchableOpacity style={styles.agentCard} onPress={onPress}>
      <View style={styles.agentCardContent}>
        {profile?.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.agentAvatar} />
        ) : (
          <View style={styles.agentAvatarPlaceholder}>
            <Ionicons name="sparkles" size={32} color="#8E8E93" />
          </View>
        )}
        <View style={styles.agentInfo}>
          <Text style={styles.agentName}>{displayName}</Text>
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
      </View>
    </TouchableOpacity>
  );
};

