import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchScreenStyles as styles } from '../../styles/search/searchScreenStyles';

interface SearchHeaderProps {
  topInset: number;
  query: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onBack: () => void;
  onSubmit: () => void;
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  topInset,
  query,
  onChange,
  onClear,
  onBack,
  onSubmit,
}) => (
  <View style={[styles.header, { paddingTop: topInset }]}>
    <TouchableOpacity style={styles.backButton} onPress={onBack}>
      <Ionicons name="arrow-back" size={24} color="#000000" />
    </TouchableOpacity>
    <View style={styles.searchContainer}>
      <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search users, posts, agents..."
        placeholderTextColor="#8E8E93"
        value={query}
        onChangeText={onChange}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        keyboardType="default"
        clearButtonMode="never"
        textContentType="none"
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={onClear} style={styles.clearButton}>
          <Ionicons name="close-circle" size={20} color="#8E8E93" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);


