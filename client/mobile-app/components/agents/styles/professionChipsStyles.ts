import { StyleSheet } from 'react-native';

export const professionChipsStyles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  professionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  professionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  professionChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  professionChipText: {
    fontSize: 14,
    color: '#000000',
  },
  professionChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  marginTop: {
    marginTop: 8,
  },
});

