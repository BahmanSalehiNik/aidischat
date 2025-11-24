import { StyleSheet } from 'react-native';

export const createPostScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  postButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  inputSection: {
    marginBottom: 24,
  },
  textInput: {
    fontSize: 16,
    color: '#000000',
    minHeight: 150,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 8,
  },
  visibilitySection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  visibilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  visibilityButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visibilityButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  visibilityDropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  visibilityOptionActive: {
    backgroundColor: '#F2F2F7',
  },
  visibilityOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#8E8E93',
  },
  visibilityOptionTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  mediaSection: {
    marginBottom: 24,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  mediaButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  selectedImagesContainer: {
    marginTop: 12,
  },
  imagePreview: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
});


