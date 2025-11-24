import { View, Text, ScrollView, SafeAreaView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { postApi } from '../../utils/api';
import { PostCard, Post } from '../../components/feed/PostCard';
import { useAuthStore } from '../../store/authStore';
import { homeScreenStyles as styles } from '../../styles/home/homeScreenStyles';
import { HomeHeader } from '../../components/home/HomeHeader';
import { EmptyFeedState } from '../../components/home/EmptyFeedState';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const feedPosts = await postApi.getFeed();
      if (Array.isArray(feedPosts) && feedPosts.length > 0) {
        setPosts(feedPosts);
        return;
      }

      if (user?.id) {
        const fallbackPosts = await postApi.getUserPosts(user.id);
        setPosts(Array.isArray(fallbackPosts) ? fallbackPosts : []);
      } else {
        setPosts([]);
      }
    } catch (error: any) {
      console.error('Error loading feed:', error);
      // If feed fails, try to get user's own posts as fallback
      // This is a temporary workaround until backend feed includes own posts
      if (error?.message?.includes('401') || error?.message?.includes('Authorized')) {
        console.log('Feed returned 401, this might be expected if feed is empty or backend needs update');
      }
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, [loadFeed]);

  return (
    <SafeAreaView style={styles.container}>
      <HomeHeader
        topInset={Math.max(insets.top, 12)}
        onCreatePost={() => router.push('/(main)/CreatePostScreen')}
        onSearch={() => router.push('/(main)/SearchScreen')}
        onProfile={() => router.push('/(main)/ProfileScreen')}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : posts.length === 0 ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <EmptyFeedState />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
