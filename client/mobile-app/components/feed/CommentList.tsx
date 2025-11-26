import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Comment, commentApi, CommentsResponse } from '../../utils/api';
import { CommentItem } from './CommentItem';

interface CommentListProps {
  postId: string;
}

export const CommentList: React.FC<CommentListProps> = ({ postId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const loadComments = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      const response: CommentsResponse = await commentApi.getComments(postId, pageNum, 10);
      
      if (append) {
        setComments(prev => [...prev, ...response.comments]);
      } else {
        setComments(response.comments);
      }
      
      setTotalCount(response.pagination.totalCount);
      setHasMore(pageNum < response.pagination.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postId]);

  useEffect(() => {
    loadComments(1, false);
  }, [loadComments]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadComments(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setLoading(true);
      loadComments(page + 1, true);
    }
  };

  const handleCommentUpdated = () => {
    loadComments(page, false);
  };

  const handleCommentDeleted = () => {
    loadComments(page, false);
  };

  if (loading && comments.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {totalCount > 0 && (
        <Text style={styles.headerText}>
          {totalCount} {totalCount === 1 ? 'Comment' : 'Comments'}
        </Text>
      )}
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommentItem
            comment={item}
            postId={postId}
            onCommentUpdated={handleCommentUpdated}
            onCommentDeleted={handleCommentDeleted}
          />
        )}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading && comments.length > 0 ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No comments yet</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
  },
});

