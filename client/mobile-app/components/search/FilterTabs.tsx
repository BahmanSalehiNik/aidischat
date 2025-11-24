import React from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { searchScreenStyles as styles } from '../../styles/search/searchScreenStyles';

export interface FilterOption<T extends string = string> {
  label: string;
  value: T;
}

interface FilterTabsProps<T extends string = string> {
  filters: FilterOption<T>[];
  activeFilter: T;
  onSelect: (value: T) => void;
  visible?: boolean;
}

export function FilterTabs<T extends string = string>({
  filters,
  activeFilter,
  onSelect,
  visible = true,
}: FilterTabsProps<T>) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.filterContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={styles.filterScrollView}
      >
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterButton,
              activeFilter === filter.value && styles.filterButtonActive,
            ]}
            onPress={() => onSelect(filter.value)}
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
    </View>
  );
}


