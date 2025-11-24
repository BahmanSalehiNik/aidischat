import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FriendSuggestion } from '../../utils/api';
import { searchScreenStyles as styles } from '../../styles/search/searchScreenStyles';

interface FriendSuggestionsListProps {
  suggestions: FriendSuggestion[];
  loading: boolean;
  onPressSuggestion: (suggestion: FriendSuggestion) => void;
  onAdd: (suggestion: FriendSuggestion) => void;
}

export const FriendSuggestionsList: React.FC<FriendSuggestionsListProps> = ({
  suggestions,
  loading,
  onPressSuggestion,
  onAdd,
}) => {
  if (loading) {
    return (
      <ScrollView
        style={styles.suggestionsContainer}
        contentContainerStyle={styles.suggestionsContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.suggestionsLoading}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      </ScrollView>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  const renderSuggestion = (suggestion: FriendSuggestion) => {
    const displayName = suggestion.fullName || suggestion.username || 'User';
    const reasonText =
      suggestion.reason === 'mutual'
        ? `${suggestion.mutualCount || 0} mutual friends`
        : suggestion.reason === 'popular'
        ? 'Popular user'
        : 'New user';

    return (
      <TouchableOpacity
        key={suggestion.userId}
        style={styles.suggestionCard}
        onPress={() => onPressSuggestion(suggestion)}
        activeOpacity={0.7}
      >
        <View style={styles.suggestionContent}>
          {suggestion.profilePicture ? (
            <Image source={{ uri: suggestion.profilePicture }} style={styles.suggestionAvatar} />
          ) : (
            <View style={styles.suggestionAvatarPlaceholder}>
              <Ionicons name="person" size={32} color="#8E8E93" />
            </View>
          )}
          <View style={styles.suggestionInfo}>
            <Text style={styles.suggestionName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.suggestionReason} numberOfLines={1}>
              {reasonText}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={(e) => {
              e.stopPropagation();
              onAdd(suggestion);
            }}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={styles.suggestionsContainer}
      contentContainerStyle={styles.suggestionsContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.suggestionsHeader}>
        <Text style={styles.suggestionsTitle}>People You May Know</Text>
      </View>
      {suggestions.map(renderSuggestion)}
    </ScrollView>
  );
};


