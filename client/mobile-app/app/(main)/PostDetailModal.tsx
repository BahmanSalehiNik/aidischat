import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Post } from '../../components/feed/PostCard';
import { CommentItem } from '../../components/feed/CommentItem';
import { CommentInput } from '../../components/feed/CommentInput';
import { ReactionButton } from '../../components/feed/ReactionButton';
import { useAuthStore } from '../../store/authStore';
import { Image as ExpoImage } from 'expo-image';
import { commentApi, Comment, CommentsResponse, postApi } from '../../utils/api';
import { ActivityIndicator } from 'react-native';

const REACTION_EMOJI_MAP: Record<string, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  sad: '😢',
  angry: '😠',
};

interface PostDetailModalProps {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onPostUpdated?: () => void;
  onPostDeleted?: () => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  visible,
  post,
  onClose,
  onPostUpdated,
  onPostDeleted,
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [postData, setPostData] = useState<Post | null>(post);

  // Update postData when post prop changes
  React.useEffect(() => {
    setPostData(post);
  }, [post]);

  // Load comments
  const loadComments = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!post?.id) return;
    
    try {
      setLoadingComments(true);
      const response: CommentsResponse = await commentApi.getComments(post.id, page, 10);
      
      if (append) {
        setComments(prev => [...prev, ...response.comments]);
      } else {
        setComments(response.comments);
      }
      
      setHasMoreComments(page < response.pagination.totalPages);
      setCommentsPage(page);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
      setRefreshing(false);
    }
  }, [post?.id]);

  React.useEffect(() => {
    if (visible && post?.id) {
      loadComments(1, false);
    }
  }, [visible, post?.id, loadComments]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadComments(1, false);
    // Also refresh post data
    if (post?.id) {
      postApi.getPost(post.id).then(updatedPost => {
        setPostData(updatedPost as any);
      }).catch(console.error);
    }
  };

  const handleCommentAdded = () => {
    loadComments(1, false);
    // Refresh post to update comments count
    if (post?.id) {
      postApi.getPost(post.id).then(updatedPost => {
        setPostData(updatedPost as any);
      }).catch(console.error);
    }
  };

  const handleReactionChange = () => {
    // Refresh post data after reaction change
    if (post?.id) {
      postApi.getPost(post.id).then(updatedPost => {
        setPostData(updatedPost as any);
        onPostUpdated?.();
      }).catch(console.error);
    }
  };

  if (!post || !postData) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
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

  // Transform reactions from backend format to display format
  // Backend may return reactionsSummary (preferred) or reactions array
  const getReactionCounts = () => {
    // Prefer reactionsSummary if available (from backend)
    if (postData.reactionsSummary && Array.isArray(postData.reactionsSummary) && postData.reactionsSummary.length > 0) {
      return postData.reactionsSummary.map((r: any) => ({
        type: (r.type || 'like') as 'like' | 'love' | 'haha' | 'sad' | 'angry',
        count: r.count || 1,
      }));
    }

    if (!Array.isArray(postData.reactions) || postData.reactions.length === 0) {
      return [];
    }

    // Check if already in summary format (has count property)
    if (postData.reactions[0] && 'count' in postData.reactions[0]) {
      return postData.reactions.map((r: any) => ({
        type: (r.type || 'like') as 'like' | 'love' | 'haha' | 'sad' | 'angry',
        count: r.count || 1,
      }));
    }

    // Transform from userId/type format to summary format
    const reactionMap = new Map<string, number>();
    postData.reactions.forEach((r: any) => {
      const type = r.type || 'like';
      reactionMap.set(type, (reactionMap.get(type) || 0) + 1);
    });

    return Array.from(reactionMap.entries()).map(([type, count]) => ({
      type: type as 'like' | 'love' | 'haha' | 'sad' | 'angry',
      count,
    }));
  };

  // Get current user's reaction
  // Prefer currentUserReaction from backend if available
  const getCurrentUserReaction = (): string | null => {
    if (postData.currentUserReaction) {
      return postData.currentUserReaction.type;
    }

    if (!user?.id || !Array.isArray(postData.reactions) || postData.reactions.length === 0) {
      return null;
    }
    // Check if reactions are in userId/type format
    if (postData.reactions[0] && 'userId' in postData.reactions[0]) {
      const userReaction = postData.reactions.find((r: any) => r.userId === user.id);
      return userReaction?.type || null;
    }
    return null;
  };

  const currentUserReaction = getCurrentUserReaction();
  const reactionCounts = getReactionCounts();
  const commentsCount = postData.commentsCount || 0;

  const renderPostStats = () => {
    if (!reactionCounts.length && !commentsCount) {
      return null;
    }
    return (
      <View style={styles.postStatsRow}>
        <View style={styles.postStatsLeft}>
          {reactionCounts.slice(0, 3).map((reaction) => (
            <View
              key={reaction.type}
              style={[
                styles.postReactionBadge,
                currentUserReaction === reaction.type && styles.postReactionBadgeActive,
              ]}
            >
              <Text style={styles.postReactionEmoji}>
                {REACTION_EMOJI_MAP[reaction.type] || '👍'}
              </Text>
              <Text style={styles.postReactionCount}>{reaction.count}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.postCommentsLabel}>
          {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
        </Text>
      </View>
    );
  };

  // Get display name for user
  const getUserDisplayName = (author?: { name?: string; userId?: string; email?: string }) => {
    if (author?.name) return author.name;
    if (author?.email) return author.email.split('@')[0];
    if (author?.userId) return author.userId;
    return 'User';
  };

  // Render post header
  const renderPostHeader = () => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#007AFF" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {getUserDisplayName(postData.author)}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.timestamp}>{formatDate(postData.createdAt)}</Text>
              <Ionicons
                name={getVisibilityIcon(postData.visibility) as any}
                size={12}
                color="#8E8E93"
                style={styles.visibilityIcon}
              />
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.postText}>{postData.content}</Text>

      {postData.media && postData.media.length > 0 && (
        <View style={styles.mediaContainer}>
          {postData.media.map((mediaItem, index) => (
            <ExpoImage
              key={index}
              source={{ uri: mediaItem.url }}
              style={styles.mediaImage}
              contentFit="cover"
              transition={200}
            />
          ))}
        </View>
      )}

      {renderPostStats()}

      <View style={styles.postFooter}>
        <ReactionButton
          postId={postData.id}
          currentReaction={currentUserReaction as any}
          iconName="thumbs-up-sharp"
          buttonLabel="Like"
          onReactionChange={handleReactionChange}
        />
        <View style={styles.footerSpacer} />
      </View>
    </View>
  );

  // Render comment header
  const renderCommentHeader = () => {
    if (comments.length === 0) return null;
    return (
      <View style={styles.commentHeader}>
        <Text style={styles.commentHeaderText}>
          {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
        </Text>
      </View>
    );
  };

  // Render comment item
  const renderComment = ({ item }: { item: Comment }) => (
    <CommentItem
      comment={item}
      postId={postData.id}
      onCommentUpdated={() => loadComments(commentsPage, false)}
      onCommentDeleted={() => loadComments(commentsPage, false)}
    />
  );

  // FlatList data - use a marker for the post header
  type ListItem = { type: 'post' } | Comment;
  const listData: ListItem[] = [{ type: 'post' }, ...comments];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={listData}
          keyExtractor={(item, index) => {
            if ('type' in item && item.type === 'post') {
              return 'post';
            }
            return `comment-${(item as Comment).id || index}`;
          }}
          renderItem={({ item }) => {
            if ('type' in item && item.type === 'post') {
              return (
                <>
                  {renderPostHeader()}
                  {renderCommentHeader()}
                </>
              );
            }
            return renderComment({ item: item as Comment });
          }}
          ListEmptyComponent={
            !loadingComments ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet</Text>
              </View>
            ) : null
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={() => {
            if (!loadingComments && hasMoreComments) {
              loadComments(commentsPage + 1, true);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingComments && comments.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : null
          }
          style={styles.listView}
          contentContainerStyle={styles.listContent}
        />

        {/* Comment Input */}
        <CommentInput postId={postData.id} onCommentAdded={handleCommentAdded} />
      </KeyboardAvoidingView>
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
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerSpacer: {
    width: 36,
  },
  listView: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  commentHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  commentHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  postContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  postHeader: {
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
  postText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaContainer: {
    marginBottom: 12,
  },
  postStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  postStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  postReactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
    gap: 4,
  },
  postReactionBadgeActive: {
    backgroundColor: '#E0ECFF',
  },
  postReactionEmoji: {
    fontSize: 16,
  },
  postReactionCount: {
    fontSize: 13,
    color: '#3C3C43',
    fontWeight: '500',
  },
  postCommentsLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  mediaImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
  },
  footerSpacer: {
    flex: 1,
  },
});

// Default export for expo-router (this file is a component, not a route)
export default function PostDetailModalRoute() {
  return null;
}

