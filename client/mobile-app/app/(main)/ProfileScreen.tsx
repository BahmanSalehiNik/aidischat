import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useState, useEffect, useCallback } from 'react';
import { authApi, postApi, chatHistoryApi, ChatSession } from '../../utils/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostCard, Post } from '../../components/feed/PostCard';
import { profileScreenStyles as styles } from '../../styles/profile/profileScreenStyles';
import { PostDetailModal } from './PostDetailModal';
import { SessionItem } from '../../components/chat/SessionItem';

type TabType = 'posts' | 'agents' | 'friends' | 'chatHistory';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ activeTab?: string }>();
  const { user } = useAuthStore();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('posts');

  // Handle activeTab parameter from navigation (e.g., when returning from SessionDetailScreen)
  useEffect(() => {
    if (params.activeTab && ['posts', 'agents', 'friends', 'chatHistory'].includes(params.activeTab)) {
      setActiveTab(params.activeTab as TabType);
    }
  }, [params.activeTab]);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const insets = useSafeAreaInsets();
  
  const [counts, setCounts] = useState({
    posts: 0,
    friends: 0,
    agents: 0,
    chatHistory: 0,
  });
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loadingChatHistory, setLoadingChatHistory] = useState(false);

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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadChatHistory = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoadingChatHistory(true);
      const response = await chatHistoryApi.getUserSessions({
        participantType: 'human',
        limit: 50,
        offset: 0,
        includeActive: true,
      });
      setChatSessions(response.sessions);
      setCounts(prev => ({ ...prev, chatHistory: response.pagination.total }));
    } catch (error) {
      console.error('Error loading chat history:', error);
      setChatSessions([]);
    } finally {
      setLoadingChatHistory(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'posts' && user?.id) {
      loadUserPosts();
    } else if (activeTab === 'chatHistory' && user?.id) {
      loadChatHistory();
    }
  }, [activeTab, user?.id, loadUserPosts, loadChatHistory]);

  // Reload data when tab becomes active
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'posts' && user?.id) {
        loadUserPosts();
      } else if (activeTab === 'chatHistory' && user?.id) {
        loadChatHistory();
      }
    }, [activeTab, user?.id, loadUserPosts, loadChatHistory])
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'posts') {
      loadUserPosts();
    } else if (activeTab === 'chatHistory') {
      loadChatHistory();
    } else {
      setRefreshing(false);
    }
  }, [activeTab, loadUserPosts, loadChatHistory]);

  const handlePostPress = useCallback((post: Post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  }, []);

  const handlePostUpdated = useCallback(() => {
    loadUserPosts();
    setShowPostModal(false);
  }, [loadUserPosts]);

  const handlePostDeleted = useCallback(() => {
    setUserPosts(prev => prev.filter(p => p.id !== selectedPost?.id));
    setCounts(prev => ({ ...prev, posts: prev.posts - 1 }));
    setShowPostModal(false);
    setSelectedPost(null);
  }, [selectedPost]);

  const handlePostReactionChange = useCallback(() => {
    // Refresh posts to show updated reactions
    loadUserPosts();
  }, [loadUserPosts]);

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
        refreshControl={
          (activeTab === 'posts' || activeTab === 'chatHistory') 
            ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> 
            : undefined
        }
        scrollEnabled={true}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                if (!user?.id) return;
                router.push({
                  pathname: '/(main)/EntityProfileScreen',
                  params: { entityType: 'user', entityId: String(user.id) },
                });
              }}
            >
              <Ionicons name="person-circle" size={100} color="#C7C7CC" />
            </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.tab, activeTab === 'chatHistory' && styles.activeTab]}
            onPress={() => setActiveTab('chatHistory')}
          >
            <Ionicons 
              name="chatbubbles" 
              size={20} 
              color={activeTab === 'chatHistory' ? '#007AFF' : '#8E8E93'} 
            />
            <Text style={[styles.tabText, activeTab === 'chatHistory' && styles.activeTabText]}>
              History
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
                <View style={styles.postsLoadingContainer}>
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
                    <PostCard
                      key={post.id}
                      post={post}
                      onPress={() => handlePostPress(post)}
                      onCommentPress={() => handlePostPress(post)}
                      onPostUpdated={handlePostReactionChange}
                      onPostDeleted={handlePostDeleted}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          <PostDetailModal
            visible={showPostModal}
            post={selectedPost}
            onClose={() => {
              setShowPostModal(false);
              setSelectedPost(null);
            }}
            onPostUpdated={handlePostUpdated}
            onPostDeleted={handlePostDeleted}
          />

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

          {activeTab === 'chatHistory' && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Chat History</Text>
                <Text style={styles.sectionCount}>{counts.chatHistory} sessions</Text>
              </View>
              {loadingChatHistory ? (
                <View style={styles.postsLoadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                </View>
              ) : chatSessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={64} color="#C7C7CC" />
                  <Text style={styles.emptyStateTitle}>No Chat History</Text>
                  <Text style={styles.emptyStateText}>
                    You haven't started any chat sessions yet.
                  </Text>
                </View>
              ) : (
                <>
                  {chatSessions.map((session) => {
                    const sessionId = session.id || (session as any)._id;
                    console.log('[ProfileScreen] Session object:', { id: session.id, _id: (session as any)._id, sessionId });
                    return (
                      <SessionItem
                        key={sessionId}
                        session={session}
                        onPress={(session) => {
                          const id = session.id || (session as any)._id;
                          console.log('[ProfileScreen] Navigating to session:', id);
                          router.push({
                            pathname: '/(main)/SessionDetailScreen',
                            params: { 
                              sessionId: id,
                              returnTo: '/(main)/ProfileScreen', // Tell SessionDetailScreen where to return
                            },
                          });
                        }}
                      />
                    );
                  })}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
