import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { agentManagerApi, AgentDraft } from '../../utils/api';

export default function AgentDraftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ agentId: string }>();
  const [drafts, setDrafts] = useState<AgentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [reviseModalVisible, setReviseModalVisible] = useState(false);
  const [reviseDraft, setReviseDraft] = useState<AgentDraft | null>(null);
  const [reviseText, setReviseText] = useState('');
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [draftToReject, setDraftToReject] = useState<AgentDraft | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await agentManagerApi.getDrafts(params.agentId!, { type: 'post' });
      setDrafts(data);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      Alert.alert('Error', 'Failed to load drafts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.agentId]);

  useEffect(() => {
    if (params.agentId) loadDrafts();
  }, [params.agentId, loadDrafts]);

  // Refresh drafts whenever the user navigates back to this screen
  useFocusEffect(
    useCallback(() => {
      if (params.agentId) loadDrafts();
    }, [params.agentId, loadDrafts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  const approveDraft = async (draft: AgentDraft) => {
    try {
      setBusyDraftId(draft.id);
      await agentManagerApi.approveDraft(draft.id, 'post');
      Alert.alert('Approved', 'Draft approved and queued for publishing.');
      loadDrafts();
    } catch (e: any) {
      console.error('approveDraft error:', e);
      Alert.alert('Error', e?.message || 'Failed to approve draft');
    } finally {
      setBusyDraftId(null);
    }
  };

  const openReject = async (draft: AgentDraft) => {
    setDraftToReject(draft);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const openRevise = (draft: AgentDraft) => {
    setReviseDraft(draft);
    setReviseText('');
    setReviseModalVisible(true);
  };

  const submitRevise = async () => {
    if (!reviseDraft) return;
    if (!reviseText.trim()) {
      Alert.alert('Feedback required', 'Please add a short feedback message for the agent.');
      return;
    }

    try {
      setBusyDraftId(reviseDraft.id);
      await agentManagerApi.reviseDraft(reviseDraft.id, reviseText.trim());
      setReviseModalVisible(false);
      Alert.alert('Sent', 'Revision requested. The draft will update when the agent responds.');
      loadDrafts();
    } catch (e: any) {
      console.error('submitRevise error:', e);
      Alert.alert('Error', e?.message || 'Failed to send feedback');
    } finally {
      setBusyDraftId(null);
    }
  };

  const submitReject = async () => {
    if (!draftToReject) return;
    try {
      setBusyDraftId(draftToReject.id);
      await agentManagerApi.rejectDraft(draftToReject.id, 'post', rejectReason.trim() || undefined);
      setRejectModalVisible(false);
      Alert.alert('Rejected', 'Draft rejected.');
      loadDrafts();
    } catch (e: any) {
      console.error('submitReject error:', e);
      Alert.alert('Error', e?.message || 'Failed to reject draft');
    } finally {
      setBusyDraftId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      case 'expired':
        return '#8E8E93';
      default:
        return '#8E8E93';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Drafts</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Drafts</Text>
      </View>

      {drafts.length === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Ionicons name="document-text-outline" size={64} color="#C7C7CC" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', marginTop: 16, marginBottom: 8 }}>No Drafts</Text>
          <Text style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center' }}>
            Your agent's post drafts will appear here once they are created.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {drafts.map((draft, index) => (
            <TouchableOpacity
              key={draft.id || `draft-${index}`}
              style={{
                backgroundColor: '#F9F9F9',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View
                      style={{
                        backgroundColor: getStatusColor(draft.status) + '20',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: getStatusColor(draft.status) }}>
                        {draft.status.toUpperCase()}
                      </Text>
                    </View>
                    {draft.visibility && (
                      <Text style={{ fontSize: 12, color: '#8E8E93' }}>
                        {draft.visibility}
                      </Text>
                    )}
                  </View>
                  {draft.content && (
                    <Text style={{ fontSize: 14, color: '#000000', marginTop: 8 }} numberOfLines={3}>
                      {draft.content}
                    </Text>
                  )}

                  {draft.media && draft.media.length > 0 && draft.media[0]?.url ? (
                    <View style={{ marginTop: 12 }}>
                      <ExpoImage
                        source={{ uri: draft.media[0].url }}
                        style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: '#E5E5EA' }}
                        contentFit="cover"
                      />
                    </View>
                  ) : null}
                </View>
              </View>
              {draft.status === 'pending' && (
                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => approveDraft(draft)}
                    disabled={busyDraftId === draft.id}
                    style={{
                      flex: 1,
                      backgroundColor: '#34C759',
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: busyDraftId === draft.id ? 0.6 : 1,
                      marginRight: 10,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{busyDraftId === draft.id ? 'Working…' : 'Approve'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => openRevise(draft)}
                    disabled={busyDraftId === draft.id}
                    style={{
                      flex: 1,
                      backgroundColor: '#007AFF',
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: busyDraftId === draft.id ? 0.6 : 1,
                      marginRight: 10,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Revise</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => openReject(draft)}
                    disabled={busyDraftId === draft.id}
                    style={{
                      flex: 1,
                      backgroundColor: '#FF3B30',
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: 'center',
                      opacity: busyDraftId === draft.id ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: '#8E8E93' }}>
                  Created: {formatDate(draft.createdAt)}
                </Text>
                <Text style={{ fontSize: 12, color: '#8E8E93' }}>
                  Expires: {formatDate(draft.expiresAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={reviseModalVisible} transparent animationType="fade" onRequestClose={() => setReviseModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Revise draft</Text>
            <Text style={{ fontSize: 13, color: '#8E8E93', marginBottom: 12 }}>
              Tell your agent what to change (tone, length, add/remove details, etc).
            </Text>
            <TextInput
              value={reviseText}
              onChangeText={setReviseText}
              placeholder="e.g. Make it shorter and more friendly. Mention the photo."
              multiline
              style={{
                minHeight: 110,
                borderWidth: 1,
                borderColor: '#E5E5EA',
                borderRadius: 10,
                padding: 10,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setReviseModalVisible(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F2F2F7', alignItems: 'center', marginRight: 10 }}>
                <Text style={{ fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitRevise} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#007AFF', alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Reject draft</Text>
            <Text style={{ fontSize: 13, color: '#8E8E93', marginBottom: 12 }}>
              Optional: add a reason (helps the agent improve next time).
            </Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Too long / wrong tone / not relevant"
              multiline
              style={{
                minHeight: 90,
                borderWidth: 1,
                borderColor: '#E5E5EA',
                borderRadius: 10,
                padding: 10,
                textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F2F2F7', alignItems: 'center', marginRight: 10 }}>
                <Text style={{ fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitReject} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#FF3B30', alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

