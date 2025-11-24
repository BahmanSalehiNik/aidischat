import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, SafeAreaView, ActivityIndicator, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  searchApi,
  SearchResult,
  AutocompleteResponse,
  friendSuggestionsApi,
  FriendSuggestion,
  friendshipApi,
} from '../../utils/api';
import { searchScreenStyles as styles } from '../../styles/search/searchScreenStyles';
import { SearchHeader } from '../../components/search/SearchHeader';
import { FilterTabs, FilterOption } from '../../components/search/FilterTabs';
import { AutocompleteResults } from '../../components/search/AutocompleteResults';
import { SearchResultItem } from '../../components/search/SearchResultItem';
import { FriendSuggestionsList } from '../../components/search/FriendSuggestionsList';

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
  const [friendSuggestions, setFriendSuggestions] = useState<FriendSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Load friend suggestions when query is empty
  useEffect(() => {
    if (query.length === 0) {
      loadFriendSuggestions();
    } else {
      setFriendSuggestions([]);
    }
  }, [query]);

  const loadFriendSuggestions = useCallback(async () => {
    try {
      setLoadingSuggestions(true);
      const response = await friendSuggestionsApi.getSuggestions();
      setFriendSuggestions(response.suggestions || []);
    } catch (err: any) {
      console.error('Error loading friend suggestions:', err);
      // Don't show error to user, just log it
      setFriendSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

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

  const handleSuggestionPress = (suggestion: FriendSuggestion) => {
    router.push(`/profile/${suggestion.userId}`);
  };

  const handleAddFriend = async (suggestion: FriendSuggestion) => {
    try {
      // TODO: The friend suggestions API should include profileId in the response
      // For now, we need to fetch it or update the backend to include it
      if (!suggestion.profileId) {
        console.warn('Profile ID not available for suggestion:', suggestion.userId);
        // TODO: Fetch profile by userId or update backend to include profileId
        // For now, we'll show an error or fetch the profile
        return;
      }
      
      await friendshipApi.sendFriendRequest(suggestion.userId, suggestion.profileId);
      // Remove from suggestions list after successful request
      setFriendSuggestions(prev => prev.filter(s => s.userId !== suggestion.userId));
    } catch (err: any) {
      console.error('Error sending friend request:', err);
      // You might want to show an error toast here
    }
  };

  const filters: FilterOption<SearchType>[] = [
    { label: 'All', value: 'all' },
    { label: 'Users', value: 'users' },
    { label: 'Posts', value: 'posts' },
    { label: 'Agents', value: 'agents' },
    { label: 'Pages', value: 'pages' },
  ];

  const handleClearQuery = () => {
    setQuery('');
    setSearchResults([]);
    setAutocompleteResults(null);
    setShowAutocomplete(false);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <SearchHeader
        topInset={Math.max(insets.top, 12)}
        query={query}
        onChange={setQuery}
        onClear={handleClearQuery}
        onBack={() => router.back()}
        onSubmit={performSearch}
      />

      <FilterTabs
        filters={filters}
        activeFilter={activeFilter}
        onSelect={setActiveFilter}
        visible={query.length > 0}
      />

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

      {/* Empty State - Only show when no query and no suggestions loading */}
      {!isSearching && !error && query.length === 0 && !loadingSuggestions && friendSuggestions.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#C7C7CC" />
          <Text style={styles.emptyStateTitle}>Search</Text>
          <Text style={styles.emptyStateText}>
            Search for users, posts, agents, and pages
          </Text>
        </View>
      )}

      <AutocompleteResults
        data={autocompleteResults}
        visible={showAutocomplete && !isSearching}
        onSelect={handleResultPress}
      />

      {!showAutocomplete && !isSearching && searchResults.length > 0 && (
        <FlatList
          data={searchResults}
          renderItem={({ item }) => (
            <SearchResultItem result={item} onPress={handleResultPress} />
          )}
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

      {/* No Results State */}
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

      {query.length === 0 && (
        <FriendSuggestionsList
          suggestions={friendSuggestions}
          loading={loadingSuggestions}
          onPressSuggestion={handleSuggestionPress}
          onAdd={handleAddFriend}
        />
      )}
    </SafeAreaView>
  );
}
