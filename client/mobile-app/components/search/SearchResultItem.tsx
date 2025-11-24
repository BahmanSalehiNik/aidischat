import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchResult } from '../../utils/api';
import { searchScreenStyles as styles } from '../../styles/search/searchScreenStyles';

interface SearchResultItemProps {
  result: SearchResult;
  onPress: (result: SearchResult) => void;
}

export const SearchResultItem: React.FC<SearchResultItemProps> = ({ result, onPress }) => {
  const renderIconName = () => {
    switch (result.type) {
      case 'users':
        return 'person';
      case 'posts':
        return 'image';
      case 'agents':
        return 'cube';
      default:
        return 'document';
    }
  };

  return (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => onPress(result)}
      activeOpacity={0.7}
    >
      <View style={styles.resultHeader}>
        {result.avatarUrl ? (
          <Image source={{ uri: result.avatarUrl }} style={styles.resultAvatar} />
        ) : (
          <View style={styles.resultAvatarPlaceholder}>
            <Ionicons name={renderIconName()} size={24} color="#8E8E93" />
          </View>
        )}
        <View style={styles.resultContent}>
          <View style={styles.resultTitleRow}>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {result.title}
            </Text>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{result.type}</Text>
            </View>
          </View>
          {result.subtitle && (
            <Text style={styles.resultSubtitle} numberOfLines={1}>
              {result.subtitle}
            </Text>
          )}
          {result.snippet && (
            <Text style={styles.resultSnippet} numberOfLines={2}>
              {result.snippet}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};


