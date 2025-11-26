import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Comment, commentApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { ReactionButton } from './ReactionButton';

interface CommentItemProps {
  comment: Comment;
  postId: string;
  onCommentUpdated?: () => void;
  onCommentDeleted?: () => void;
}

const REACTION_EMOJI_MAP: Record<string, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  sad: '😢',
  angry: '😠',
};

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  postId,
  onCommentUpdated,
  onCommentDeleted,
}) => {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnComment = comment.userId === user?.id;

  const handleEdit = async () => {
    if (!editText.trim() || editText === comment.text) {
      setIsEditing(false);
      setEditText(comment.text);
      return;
    }

    try {
      await commentApi.updateComment(postId, comment.id, editText.trim());
      setIsEditing(false);
      onCommentUpdated?.();
    } catch (error) {
      console.error('Error updating comment:', error);
      Alert.alert('Error', 'Failed to update comment');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await commentApi.deleteComment(postId, comment.id);
              onCommentDeleted?.();
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

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

  if (isEditing) {
    return (
      <View style={styles.container}>
        <TextInput
          style={styles.editInput}
          value={editText}
          onChangeText={setEditText}
          multiline
          maxLength={1000}
          autoFocus
        />
        <View style={styles.editActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setIsEditing(false);
              setEditText(comment.text);
            }}
          >
            <Text style={styles.editButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.editButton, styles.saveButton]}
            onPress={handleEdit}
          >
            <Text style={[styles.editButtonText, styles.saveButtonText]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const reactionCounts = Array.isArray(comment.reactions)
    ? comment.reactions.map((r: any) => ({
        type: r.type as 'like' | 'love' | 'haha' | 'sad' | 'angry',
        count: r.count || 1,
      }))
    : [];

  const renderReactionSummary = () => {
    if (!reactionCounts.length) {
      return null;
    }
    return (
      <View style={styles.commentReactionRow}>
        {reactionCounts.map((reaction) => (
          <View key={reaction.type} style={styles.commentReactionBadge}>
            <Text style={styles.commentReactionEmoji}>
              {REACTION_EMOJI_MAP[reaction.type] || '👍'}
            </Text>
            <Text style={styles.commentReactionCount}>{reaction.count}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#007AFF" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {comment.author?.name || 
               (comment.author?.email ? comment.author.email.split('@')[0] : null) ||
               comment.userId || 
               'User'}
            </Text>
            <Text style={styles.timestamp}>{formatDate(comment.createdAt)}</Text>
          </View>
        </View>
        {isOwnComment && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setIsEditing(true)}
              disabled={isDeleting}
            >
              <Ionicons name="pencil" size={16} color="#8E8E93" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Ionicons name="hourglass" size={16} color="#8E8E93" />
              ) : (
                <Ionicons name="trash" size={16} color="#FF3B30" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Text style={styles.commentText}>{comment.text}</Text>
      {renderReactionSummary()}
      <View style={styles.footer}>
        <ReactionButton
          commentId={comment.id}
          currentReaction={comment.currentUserReaction?.type as any}
          onReactionChange={() => {
            // Refresh comment data if needed
            onCommentUpdated?.();
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  commentText: {
    fontSize: 15,
    color: '#000000',
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentReactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  commentReactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  commentReactionEmoji: {
    fontSize: 12,
  },
  commentReactionCount: {
    fontSize: 11,
    color: '#3C3C43',
    fontWeight: '500',
  },
  editInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#000000',
    minHeight: 80,
    marginBottom: 8,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  editButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#FFFFFF',
  },
});

