import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AutocompleteResponse, SearchResult } from '../../utils/api';
import { searchScreenStyles as styles } from '../../styles/search/searchScreenStyles';

interface AutocompleteResultsProps {
  data: AutocompleteResponse | null;
  visible: boolean;
  onSelect: (result: SearchResult) => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.autocompleteSection}>
    <Text style={styles.autocompleteSectionTitle}>{title}</Text>
    {children}
  </View>
);

const AutocompleteItem: React.FC<{
  result: SearchResult;
  type: string;
  onSelect: (result: SearchResult) => void;
}> = ({ result, type, onSelect }) => (
  <TouchableOpacity style={styles.autocompleteItem} onPress={() => onSelect(result)}>
    {result.avatarUrl ? (
      <Image source={{ uri: result.avatarUrl }} style={styles.autocompleteAvatar} />
    ) : (
      <View style={styles.autocompleteAvatarPlaceholder}>
        <Ionicons
          name={
            type === 'users'
              ? 'person'
              : type === 'posts'
              ? 'image'
              : type === 'agents'
              ? 'cube'
              : 'document'
          }
          size={20}
          color="#8E8E93"
        />
      </View>
    )}
    <View style={styles.autocompleteContent}>
      <Text style={styles.autocompleteTitle}>{result.title}</Text>
      {result.subtitle && <Text style={styles.autocompleteSubtitle}>{result.subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
  </TouchableOpacity>
);

export const AutocompleteResults: React.FC<AutocompleteResultsProps> = ({
  data,
  visible,
  onSelect,
}) => {
  if (!visible || !data) {
    return null;
  }

  const hasResults =
    (data.users?.length || 0) +
      (data.posts?.length || 0) +
      (data.agents?.length || 0) +
      (data.pages?.length || 0) >
    0;

  if (!hasResults) {
    return null;
  }

  return (
    <View style={styles.autocompleteContainer}>
      {data.users && data.users.length > 0 && (
        <Section title="Users">
          {data.users.map((user) => (
            <AutocompleteItem key={`user-${user.id}`} result={user} type="users" onSelect={onSelect} />
          ))}
        </Section>
      )}
      {data.posts && data.posts.length > 0 && (
        <Section title="Posts">
          {data.posts.map((post) => (
            <AutocompleteItem key={`post-${post.id}`} result={post} type="posts" onSelect={onSelect} />
          ))}
        </Section>
      )}
      {data.agents && data.agents.length > 0 && (
        <Section title="Agents">
          {data.agents.map((agent) => (
            <AutocompleteItem key={`agent-${agent.id}`} result={agent} type="agents" onSelect={onSelect} />
          ))}
        </Section>
      )}
      {data.pages && data.pages.length > 0 && (
        <Section title="Pages">
          {data.pages.map((page) => (
            <AutocompleteItem key={`page-${page.id}`} result={page} type="pages" onSelect={onSelect} />
          ))}
        </Section>
      )}
    </View>
  );
};


