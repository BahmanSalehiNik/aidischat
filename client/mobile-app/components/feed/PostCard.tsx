import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useAuthStore } from '../../store/authStore';
import { postApi } from '../../utils/api';
import { ReactionButton } from './ReactionButton';

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaIds?: string[];
  media?: Array<{ id?: string; url: string; originalUrl?: string; type?: string }>;
  visibility: 'public' | 'friends' | 'private';
  createdAt: string;
  updatedAt?: string;
  reactions?: { userId?: string; type: string; count?: number }[] | { type: string; count: number }[];
  reactionsSummary?: { type: string; count: number }[];
  currentUserReaction?: { userId: string; type: string };
  commentsCount?: number;
  author?: {
    userId: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}

interface PostCardProps {
  post: Post;
  onPress?: () => void;
  onPostUpdated?: () => void;
  onPostDeleted?: () => void;
  onCommentPress?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ 
  post, 
  onPress, 
  onPostUpdated, 
  onPostDeleted,
  onCommentPress 
}) => {
  const { user } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnPost = post.userId === user?.id;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return 'globe-outline';
      case 'friends':
        return 'people-outline';
      case 'private':
        return 'lock-closed-outline';
      default:
        return 'globe-outline';
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await postApi.deletePost(post.id);
              onPostDeleted?.();
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            } finally {
              setIsDeleting(false);
              setShowMenu(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    setShowMenu(false);
    // TODO: Navigate to edit post screen or show edit modal
    Alert.alert('Edit Post', 'Edit functionality coming soon');
  };

  // Transform reactions from backend format to display format
  // Backend may return reactionsSummary (preferred) or reactions array
const REACTION_EMOJI_MAP: Record<string, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  sad: '😢',
  angry: '😠',
};

const getReactionCounts = () => {
    // Prefer reactionsSummary if available (from backend)
    if (post.reactionsSummary && Array.isArray(post.reactionsSummary) && post.reactionsSummary.length > 0) {
      return post.reactionsSummary.map((r: any) => ({
        type: (r.type || 'like') as 'like' | 'love' | 'haha' | 'sad' | 'angry',
        count: r.count || 1,
      }));
    }

    if (!Array.isArray(post.reactions) || post.reactions.length === 0) {
      return [];
    }

    // Check if already in summary format (has count property)
    if (post.reactions[0] && 'count' in post.reactions[0]) {
      return post.reactions.map((r: any) => ({
        type: (r.type || 'like') as 'like' | 'love' | 'haha' | 'sad' | 'angry',
        count: r.count || 1,
      }));
    }

    // Transform from userId/type format to summary format
    const reactionMap = new Map<string, number>();
    post.reactions.forEach((r: any) => {
      const type = r.type || 'like';
      reactionMap.set(type, (reactionMap.get(type) || 0) + 1);
    });

    return Array.from(reactionMap.entries()).map(([type, count]) => ({
      type: type as 'like' | 'love' | 'haha' | 'sad' | 'angry',
      count,
    }));
  };

  const reactionCounts = getReactionCounts();

  // Get current user's reaction
  // Prefer currentUserReaction from backend if available
  const getCurrentUserReaction = (): string | null => {
    if (post.currentUserReaction) {
      return post.currentUserReaction.type;
    }

    if (!user?.id || !Array.isArray(post.reactions) || post.reactions.length === 0) {
      return null;
    }
    // Check if reactions are in userId/type format
    if (post.reactions[0] && 'userId' in post.reactions[0]) {
      const userReaction = post.reactions.find((r: any) => r.userId === user.id);
      return userReaction?.type || null;
    }
    return null;
  };

  const currentUserReaction = getCurrentUserReaction();
  const commentsCount = post.commentsCount || 0;

  const renderStatsRow = () => {
    if (!reactionCounts.length && !commentsCount) {
      return null;
    }

    return (
      <View style={styles.statsRow}>
        <View style={styles.reactionStats}>
          {reactionCounts.slice(0, 3).map((reaction) => (
            <View
              key={reaction.type}
              style={[
                styles.reactionBadge,
                currentUserReaction === reaction.type && styles.reactionBadgeActive,
              ]}
            >
              <Text style={styles.reactionEmoji}>
                {REACTION_EMOJI_MAP[reaction.type] || '👍'}
              </Text>
              <Text style={styles.reactionCount}>{reaction.count}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={onCommentPress || onPress}>
          <Text style={styles.commentsLabel}>
            {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#007AFF" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {post.author?.name || 
               (post.author?.email ? post.author.email.split('@')[0] : null) ||
               post.author?.userId || 
               'User'}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.timestamp}>{formatDate(post.createdAt)}</Text>
              <Ionicons
                name={getVisibilityIcon(post.visibility) as any}
                size={12}
                color="#8E8E93"
                style={styles.visibilityIcon}
              />
            </View>
          </View>
        </View>
        {isOwnPost && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenu(true)}
            disabled={isDeleting}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.postText}>{post.content}</Text>
      </View>

      {post.media && post.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.media.length === 1 ? (
            <ExpoImage
              source={{ uri: post.media[0].url }}
              style={styles.singleImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
              {post.media.map((mediaItem, index) => (
                <ExpoImage
                  key={index}
                  source={{ uri: mediaItem.url }}
                  style={styles.multiImage}
                  contentFit="cover"
                  transition={200}
                />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {renderStatsRow()}

      <View style={styles.footer}>
        <ReactionButton
          postId={post.id}
          currentReaction={currentUserReaction as any}
          buttonLabel="Like"
          iconName="thumbs-up-sharp"
          onReactionChange={() => {
            onPostUpdated?.();
          }}
        />
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={onCommentPress || onPress}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#8E8E93" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={20} color="#8E8E93" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEdit}
            >
              <Ionicons name="pencil" size={20} color="#007AFF" />
              <Text style={styles.menuItemText}>Edit Post</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              <Ionicons name="trash" size={20} color="#FF3B30" />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
                {isDeleting ? 'Deleting...' : 'Delete Post'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowMenu(false)}
            >
              <Text style={styles.menuItemText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
  },
  visibilityIcon: {
    marginLeft: 6,
  },
  content: {
    marginBottom: 12,
  },
  postText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
  },
  mediaContainer: {
    marginBottom: 12,
  },
  singleImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  mediaScroll: {
    marginVertical: 0,
  },
  multiImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 4,
  },
  reactionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  reactionBadgeActive: {
    backgroundColor: '#E0ECFF',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: '#3C3C43',
    fontWeight: '500',
  },
  commentsLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  menuButton: {
    padding: 4,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  menuItemDanger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  menuItemText: {
    fontSize: 16,
    color: '#000000',
  },
  menuItemTextDanger: {
    color: '#FF3B30',
  },
});

