import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useState, useEffect, useCallback } from 'react';
import { authApi, postApi } from '../../utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostCard, Post } from '../../components/PostCard';

type TabType = 'posts' | 'agents' | 'friends';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();
  
  const [counts, setCounts] = useState({
    posts: 0,
    friends: 0,
    agents: 0,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 'posts' && user?.id) {
      loadUserPosts();
    }
  }, [activeTab, user?.id]);

  // Reload posts when the posts tab becomes active
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'posts' && user?.id) {
        loadUserPosts();
      }
    }, [activeTab, user?.id, loadUserPosts])
  );

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await authApi.getCurrentUser();
      setProfileData(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPosts = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoadingPosts(true);
      const posts = await postApi.getUserPosts(user.id);
      const postsArray = Array.isArray(posts) ? posts : [];
      setUserPosts(postsArray);
      setCounts(prev => ({ ...prev, posts: postsArray.length }));
    } catch (error) {
      console.error('Error loading user posts:', error);
      setUserPosts([]);
    } finally {
      setLoadingPosts(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'posts') {
      loadUserPosts();
    } else {
      setRefreshing(false);
    }
  }, [activeTab, loadUserPosts]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/(main)/SettingsScreen')}
          >
            <Ionicons name="settings-outline" size={24} color="#000000" />
          </TouchableOpacity>
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/(main)/SettingsScreen')}
        >
          <Ionicons name="settings-outline" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={activeTab === 'posts' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        scrollEnabled={true}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={100} color="#C7C7CC" />
            <TouchableOpacity style={styles.editAvatarButton}>
              <Ionicons name="camera" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>
            {profileData?.name || user?.email?.split('@')[0] || 'User'}
          </Text>
          {profileData?.bio && (
            <Text style={styles.profileBio}>{profileData.bio}</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              // TODO: Navigate to edit profile
            }}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addPostButton}
            onPress={() => router.push('/(main)/CreatePostScreen')}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.addPostButtonText}>Add Post</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons 
              name="grid" 
              size={20} 
              color={activeTab === 'posts' ? '#007AFF' : '#8E8E93'} 
            />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'agents' && styles.activeTab]}
            onPress={() => setActiveTab('agents')}
          >
            <Ionicons 
              name="sparkles" 
              size={20} 
              color={activeTab === 'agents' ? '#007AFF' : '#8E8E93'} 
            />
            <Text style={[styles.tabText, activeTab === 'agents' && styles.activeTabText]}>
              Agents
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
            onPress={() => setActiveTab('friends')}
          >
            <Ionicons 
              name="people" 
              size={20} 
              color={activeTab === 'friends' ? '#007AFF' : '#8E8E93'} 
            />
            <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
              Friends
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'posts' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Posts</Text>
                <Text style={styles.sectionCount}>{counts.posts} items</Text>
              </View>
              {loadingPosts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                </View>
              ) : userPosts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="grid-outline" size={64} color="#C7C7CC" />
                  <Text style={styles.emptyStateTitle}>No Posts Yet</Text>
                  <Text style={styles.emptyStateText}>
                    Share your first post to get started
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => router.push('/(main)/CreatePostScreen')}
                  >
                    <Text style={styles.emptyStateButtonText}>Create Post</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  {userPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'agents' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Agents</Text>
                <Text style={styles.sectionCount}>{counts.agents} agents</Text>
              </View>
              <View style={styles.emptyState}>
                <Ionicons name="sparkles" size={64} color="#C7C7CC" />
                <Text style={styles.emptyStateTitle}>No Agents Yet</Text>
                <Text style={styles.emptyStateText}>
                  Create your first AI agent to get started
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => {
                    // TODO: Navigate to create agent screen
                  }}
                >
                  <Text style={styles.emptyStateButtonText}>Create Agent</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'friends' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Friends</Text>
                <Text style={styles.sectionCount}>{counts.friends} friends</Text>
              </View>
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={64} color="#C7C7CC" />
                <Text style={styles.emptyStateTitle}>No Friends Yet</Text>
                <Text style={styles.emptyStateText}>
                  Start connecting with people you know
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => router.push('/(main)/SearchScreen')}
                >
                  <Text style={styles.emptyStateButtonText}>Find Friends</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  settingsButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  profileBio: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  addPostButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addPostButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  activeTabText: {
    color: '#007AFF',
  },
  tabContent: {
    minHeight: 200,
  },
  sectionContainer: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  sectionCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 8,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
