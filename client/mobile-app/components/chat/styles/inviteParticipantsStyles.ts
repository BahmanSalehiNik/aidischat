import { StyleSheet, Platform } from 'react-native';

// Header bar height (padding 12*2 + text ~31px) = ~55px, add small gap
const HEADER_BAR_HEIGHT = 55;

export const inviteParticipantsStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    top: HEADER_BAR_HEIGHT,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#101828',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F2F4F7',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#667085',
  },
  tabButtonTextActive: {
    color: '#007AFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#101828',
    fontSize: 15,
  },
  errorText: {
    color: '#D92D20',
    fontSize: 13,
    marginBottom: 8,
  },
  resultsScroll: {
    flexGrow: 0,
  },
  resultsContent: {
    paddingBottom: 12,
  },
  loadingIndicator: {
    marginVertical: 16,
  },
  emptyState: {
    textAlign: 'center',
    color: '#98A2B3',
    fontSize: 14,
    marginVertical: 20,
    paddingHorizontal: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#E0ECFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    color: '#175CD3',
    fontWeight: '600',
    fontSize: 16,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#101828',
  },
  resultSubtitle: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
  },
  inviteActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#007AFF',
    minWidth: 84,
    alignItems: 'center',
  },
  inviteActionButtonDisabled: {
    backgroundColor: '#D0D5DD',
  },
  inviteActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});

