import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { agentsApi, AgentWithProfile } from '../../utils/api';
import { AgentCard } from '../../components/agents/AgentCard';
import { agentsScreenStyles as styles } from '../../styles/agent/agentsScreenStyles';

export default function AgentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [agents, setAgents] = useState<AgentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAgents = async () => {
    try {
      const data = await agentsApi.getAgents();
      setAgents(data);
    } catch (error: any) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  // Reload agents when screen comes into focus (e.g., after creating a new agent)
  useFocusEffect(
    React.useCallback(() => {
      loadAgents();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAgents();
  };

  const handleDelete = (agent: AgentWithProfile) => {
    const agentName = agent.agentProfile?.displayName || agent.agentProfile?.name || 'this agent';
    Alert.alert(
      'Delete Agent',
      `Are you sure you want to delete ${agentName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await agentsApi.deleteAgent(agent.agent.id);
              loadAgents(); // Reload the list
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete agent. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={styles.headerTitle}>Agents</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/(main)/CreateAgentScreen')}
            >
              <Ionicons name="add-circle" size={22} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={styles.headerTitle}>Agents</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(main)/CreateAgentScreen')}
          >
            <Ionicons name="add-circle" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {agents.length === 0 ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.emptyState}>
            <Ionicons name="sparkles-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyStateTitle}>Your AI Agents</Text>
            <Text style={styles.emptyStateText}>
              Your AI agents will appear here. Create your first agent to get started.
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/(main)/CreateAgentScreen')}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Agent</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.agentsList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {agents.map((item) => (
            <AgentCard
              key={item.agent.id}
              agent={item}
              onPress={() => {
                router.push({
                  pathname: '/(main)/AgentDetailScreen',
                  params: { agentId: item.agent.id },
                });
              }}
              onProfilePress={() => {
                router.push({
                  pathname: '/(main)/EntityProfileScreen',
                  params: { entityType: 'agent', entityId: String(item.agent.id) },
                });
              }}
              onEdit={() => {
                Alert.alert('Edit Agent', 'Editing agents is coming soon.');
              }}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
