import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchApi, SearchResult, AutocompleteResponse } from '../../utils/api';

type SearchType = 'all' | 'users' | 'posts' | 'agents' | 'pages';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SearchType>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResponse | null>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(async () => {
    if (query.length < 1) return;

    setError(null);
    setShowAutocomplete(true);
    setIsSearching(true);

    try {
      // Show autocomplete for quick results
      const autocomplete = await searchApi.autocomplete(query, 5);
      setAutocompleteResults(autocomplete);

      // Perform full search if query is longer
      if (query.length >= 2) {
        const types = activeFilter === 'all' ? undefined : [activeFilter];
        const searchResponse = await searchApi.search(query, types);
        setSearchResults(searchResponse.results || []);
        setShowAutocomplete(false);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed');
      setSearchResults([]);
      setAutocompleteResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [query, activeFilter]);

  // Debounce search
  useEffect(() => {
    if (query.length < 1) {
      setSearchResults([]);
      setAutocompleteResults(null);
      setShowAutocomplete(false);
      setIsSearching(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, activeFilter, performSearch]);

  const handleResultPress = (result: SearchResult) => {
    switch (result.type) {
      case 'users':
        router.push(`/profile/${result.id}`);
        break;
      case 'posts':
        router.push(`/post/${result.id}`);
        break;
      case 'agents':
        router.push(`/agent/${result.id}`);
        break;
      case 'pages':
        router.push(`/page/${result.id}`);
        break;
    }
  };

  const renderAutocompleteItem = (result: SearchResult, type: string) => (
    <TouchableOpacity
      key={`${type}-${result.id}`}
      style={styles.autocompleteItem}
      onPress={() => handleResultPress(result)}
    >
      {result.avatarUrl ? (
        <Image source={{ uri: result.avatarUrl }} style={styles.autocompleteAvatar} />
      ) : (
        <View style={styles.autocompleteAvatarPlaceholder}>
          <Ionicons
            name={type === 'users' ? 'person' : type === 'posts' ? 'image' : 'cube'}
            size={20}
            color="#8E8E93"
          />
        </View>
      )}
      <View style={styles.autocompleteContent}>
        <Text style={styles.autocompleteTitle}>{result.title}</Text>
        {result.subtitle && (
          <Text style={styles.autocompleteSubtitle}>{result.subtitle}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleResultPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultHeader}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.resultAvatar} />
        ) : (
          <View style={styles.resultAvatarPlaceholder}>
            <Ionicons
              name={
                item.type === 'users'
                  ? 'person'
                  : item.type === 'posts'
                  ? 'image'
                  : item.type === 'agents'
                  ? 'cube'
                  : 'document'
              }
              size={24}
              color="#8E8E93"
            />
          </View>
        )}
        <View style={styles.resultContent}>
          <View style={styles.resultTitleRow}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{item.type}</Text>
            </View>
          </View>
          {item.subtitle && (
            <Text style={styles.resultSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
          {item.snippet && (
            <Text style={styles.resultSnippet} numberOfLines={2}>
              {item.snippet}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAutocomplete = () => {
    if (!autocompleteResults || !showAutocomplete) return null;

    const hasResults =
      (autocompleteResults.users?.length || 0) +
      (autocompleteResults.posts?.length || 0) +
      (autocompleteResults.agents?.length || 0) +
      (autocompleteResults.pages?.length || 0) >
      0;

    if (!hasResults) return null;

    return (
      <View style={styles.autocompleteContainer}>
        {autocompleteResults.users && autocompleteResults.users.length > 0 && (
          <View style={styles.autocompleteSection}>
            <Text style={styles.autocompleteSectionTitle}>Users</Text>
            {autocompleteResults.users.map((user) =>
              renderAutocompleteItem(user, 'users')
            )}
          </View>
        )}
        {autocompleteResults.posts && autocompleteResults.posts.length > 0 && (
          <View style={styles.autocompleteSection}>
            <Text style={styles.autocompleteSectionTitle}>Posts</Text>
            {autocompleteResults.posts.map((post) =>
              renderAutocompleteItem(post, 'posts')
            )}
          </View>
        )}
        {autocompleteResults.agents && autocompleteResults.agents.length > 0 && (
          <View style={styles.autocompleteSection}>
            <Text style={styles.autocompleteSectionTitle}>Agents</Text>
            {autocompleteResults.agents.map((agent) =>
              renderAutocompleteItem(agent, 'agents')
            )}
          </View>
        )}
        {autocompleteResults.pages && autocompleteResults.pages.length > 0 && (
          <View style={styles.autocompleteSection}>
            <Text style={styles.autocompleteSectionTitle}>Pages</Text>
            {autocompleteResults.pages.map((page) =>
              renderAutocompleteItem(page, 'pages')
            )}
          </View>
        )}
      </View>
    );
  };

  const filters: { label: string; value: SearchType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Users', value: 'users' },
    { label: 'Posts', value: 'posts' },
    { label: 'Agents', value: 'agents' },
    { label: 'Pages', value: 'pages' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <View style={styles.searchContainer} pointerEvents="box-none">
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users, posts, agents..."
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={(text) => {
              console.log('TextInput onChangeText:', text);
              setQuery(text);
            }}
            editable={true}
            autoFocus={true}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={performSearch}
            keyboardType="default"
            clearButtonMode="never"
            textContentType="none"
            enablesReturnKeyAutomatically={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setSearchResults([]);
                setAutocompleteResults(null);
              }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      {query.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterButton,
                activeFilter === filter.value && styles.filterButtonActive,
              ]}
              onPress={() => setActiveFilter(filter.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.value && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {isSearching && query.length > 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={24} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!isSearching && !error && query.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyStateTitle}>Search</Text>
          <Text style={styles.emptyStateText}>
            Search for users, posts, agents, and pages
          </Text>
        </View>
      )}

      {showAutocomplete && !isSearching && autocompleteResults && renderAutocomplete()}

      {!showAutocomplete && !isSearching && searchResults.length > 0 && (
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.resultsList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color="#C7C7CC" />
              <Text style={styles.emptyStateText}>No results found</Text>
            </View>
          }
        />
      )}

      {!showAutocomplete &&
        !isSearching &&
        query.length >= 2 &&
        searchResults.length === 0 &&
        !error && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyStateText}>No results found</Text>
            <Text style={styles.emptyStateSubtext}>
              Try different keywords or filters
            </Text>
          </View>
        )}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    padding: 0,
    margin: 0,
    height: '100%',
    textAlignVertical: 'center',
  },
  clearButton: {
    padding: 4,
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 4,
  },
  autocompleteContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  autocompleteSection: {
    paddingVertical: 8,
  },
  autocompleteSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  autocompleteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  autocompleteAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  autocompleteContent: {
    flex: 1,
  },
  autocompleteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  autocompleteSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  resultsList: {
    paddingBottom: 16,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  resultAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  resultTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  typeBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  resultSnippet: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
});
