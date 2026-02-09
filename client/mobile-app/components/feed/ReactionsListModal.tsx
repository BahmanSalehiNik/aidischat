import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { postApi } from '../../utils/api';
import { useRouter } from 'expo-router';

const REACTION_EMOJI_MAP: Record<string, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  sad: '😢',
  angry: '😠',
};

type ReactionType = 'all' | 'like' | 'love' | 'haha' | 'sad' | 'angry';

export function ReactionsListModal(props: {
  visible: boolean;
  postId: string | null | undefined;
  authorIsAgent?: boolean;
  onClose: () => void;
  reactionCounts?: Array<{ type: string; count: number }>;
}) {
  const router = useRouter();
  const { visible, postId, onClose, reactionCounts } = props;
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [activeType, setActiveType] = useState<ReactionType>('all');

  const tabs = useMemo(() => {
    const counts = new Map<string, number>((reactionCounts || []).map((r: any) => [String(r.type), Number(r.count || 0)]));
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    return [
      { type: 'all' as const, label: `All${total ? ` (${total})` : ''}` },
      { type: 'like' as const, label: `${REACTION_EMOJI_MAP.like}${counts.get('like') ? ` ${counts.get('like')}` : ''}` },
      { type: 'love' as const, label: `${REACTION_EMOJI_MAP.love}${counts.get('love') ? ` ${counts.get('love')}` : ''}` },
      { type: 'haha' as const, label: `${REACTION_EMOJI_MAP.haha}${counts.get('haha') ? ` ${counts.get('haha')}` : ''}` },
      { type: 'sad' as const, label: `${REACTION_EMOJI_MAP.sad}${counts.get('sad') ? ` ${counts.get('sad')}` : ''}` },
      { type: 'angry' as const, label: `${REACTION_EMOJI_MAP.angry}${counts.get('angry') ? ` ${counts.get('angry')}` : ''}` },
    ];
  }, [reactionCounts]);

  const filtered = useMemo(() => {
    if (activeType === 'all') return items;
    return items.filter((it: any) => it?.type === activeType);
  }, [items, activeType]);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res = await postApi.getPostReactions(postId, { limit: 200, offset: 0 });
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (e: any) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  React.useEffect(() => {
    if (visible) {
      setActiveType('all');
      load();
    }
  }, [visible, load]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={onClose} style={{ paddingVertical: 6, paddingRight: 10 }}>
            <Ionicons name="close" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#000000', flex: 1 }}>Reactions</Text>
          <TouchableOpacity onPress={load} style={{ paddingVertical: 6, paddingLeft: 10 }}>
            <Ionicons name="refresh" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.type}
              onPress={() => setActiveType(t.type)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: activeType === t.type ? '#E0ECFF' : '#F2F2F7',
              }}
            >
              <Text style={{ fontWeight: '700', color: activeType === t.type ? '#007AFF' : '#3C3C43' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(it: any, idx) => String(it?.id || `${it?.user?.userId || 'u'}:${it?.type || 't'}:${idx}`)}
            renderItem={({ item }) => {
              const user = item?.user || {};
              const name = String(user?.name || user?.email?.split?.('@')?.[0] || user?.userId || 'User');
              const avatarUrl = user?.avatarUrl ? String(user.avatarUrl) : null;
              const isAgent = Boolean(user?.isAgent);
              const userId = String(user?.userId || '');

              return (
                <TouchableOpacity
                  onPress={() => {
                    if (!userId) return;
                    router.push({
                      pathname: '/(main)/EntityProfileScreen',
                      params: { entityType: isAgent ? 'agent' : 'user', entityId: userId },
                    });
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' }}
                  activeOpacity={0.7}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {avatarUrl ? (
                      <ExpoImage source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
                    ) : (
                      <Ionicons name={isAgent ? 'sparkles' : 'person'} size={18} color="#8E8E93" />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#000000' }} numberOfLines={1}>
                      {name}
                    </Text>
                    {isAgent ? (
                      <Text style={{ marginTop: 2, fontSize: 12, color: '#8E8E93' }} numberOfLines={1}>
                        Agent
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 18, marginLeft: 10 }}>{REACTION_EMOJI_MAP[String(item?.type)] || '👍'}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ paddingTop: 36, alignItems: 'center' }}>
                <Ionicons name="heart-outline" size={46} color="#C7C7CC" />
                <Text style={{ marginTop: 10, color: '#8E8E93' }}>No reactions yet</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}


