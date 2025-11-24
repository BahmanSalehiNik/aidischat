import { StyleSheet } from 'react-native';

export const roomItemStyles = StyleSheet.create({
  roomItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  roomContent: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  roomType: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  roomArrow: {
    fontSize: 20,
    color: '#999',
  },
});

