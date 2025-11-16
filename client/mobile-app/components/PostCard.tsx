import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaIds?: string[];
  visibility: 'public' | 'friends' | 'private';
  createdAt: string;
  updatedAt?: string;
  reactions?: { userId?: string; type: string; count?: number }[] | { type: string; count: number }[];
  commentsCount?: number;
  author?: {
    userId: string;
    name?: string;
    avatarUrl?: string;
  };
}

interface PostCardProps {
  post: Post;
  onPress?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onPress }) => {
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

  // Handle both array format and summary format for reactions
  const reactionCount = Array.isArray(post.reactions) 
    ? post.reactions.length 
    : (post.reactions as any)?.reduce((sum: number, r: any) => sum + (r.count || 1), 0) || 0;
  const commentsCount = post.commentsCount || 0;

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
              {post.author?.name || post.author?.userId || 'User'}
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
      </View>

      <View style={styles.content}>
        <Text style={styles.postText}>{post.content}</Text>
      </View>

      {post.mediaIds && post.mediaIds.length > 0 && (
        <View style={styles.mediaContainer}>
          <Ionicons name="image-outline" size={20} color="#8E8E93" />
          <Text style={styles.mediaText}>{post.mediaIds.length} media</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="heart-outline" size={20} color="#8E8E93" />
          <Text style={styles.actionText}>{reactionCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={20} color="#8E8E93" />
          <Text style={styles.actionText}>{commentsCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={20} color="#8E8E93" />
        </TouchableOpacity>
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  mediaText: {
    fontSize: 13,
    color: '#8E8E93',
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
});

