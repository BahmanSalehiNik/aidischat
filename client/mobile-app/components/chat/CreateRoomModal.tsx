import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createRoomModalStyles as styles } from './styles/createRoomModalStyles';

interface CreateRoomModalProps {
  visible: boolean;
  roomName: string;
  roomType: 'group' | 'direct';
  showTypeDropdown: boolean;
  creating: boolean;
  onRoomNameChange: (name: string) => void;
  onRoomTypeChange: (type: 'group' | 'direct') => void;
  onToggleDropdown: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  visible,
  roomName,
  roomType,
  showTypeDropdown,
  creating,
  onRoomNameChange,
  onRoomTypeChange,
  onToggleDropdown,
  onClose,
  onSubmit,
}) => {
  const roomNameInputRef = useRef<TextInput>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (visible) {
      // On iOS, ensure modal is fully rendered and ready before allowing input
      if (Platform.OS === 'ios') {
        let timer: NodeJS.Timeout;
        const interactionHandle = InteractionManager.runAfterInteractions(() => {
          timer = setTimeout(() => {
            setIsReady(true);
            if (roomNameInputRef.current) {
              roomNameInputRef.current.focus();
            }
          }, 150);
        });
        return () => {
          interactionHandle.cancel();
          if (timer) clearTimeout(timer);
        };
      } else {
        const timer = setTimeout(() => {
          setIsReady(true);
          if (roomNameInputRef.current) {
            roomNameInputRef.current.focus();
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      setIsReady(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Room</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000000" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBodyScroll}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Room Name</Text>
              <TextInput
                ref={roomNameInputRef}
                style={styles.textInput}
                placeholder="Enter room name"
                placeholderTextColor="#999"
                value={roomName}
                onChangeText={onRoomNameChange}
                editable={isReady}
                autoFocus={isReady}
                onFocus={() => {
                  if (showTypeDropdown) {
                    onToggleDropdown();
                  }
                }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Room Type</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => {
                  Keyboard.dismiss();
                  onToggleDropdown();
                }}
              >
                <Text style={styles.dropdownButtonText}>
                  {roomType === 'group' ? 'Group' : 'Direct'}
                </Text>
                <Ionicons
                  name={showTypeDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
              {showTypeDropdown && (
                <View style={styles.dropdownOptions}>
                  <TouchableOpacity
                    style={[
                      styles.dropdownOption,
                      roomType === 'group' && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      onRoomTypeChange('group');
                      onToggleDropdown();
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        roomType === 'group' && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      Group
                    </Text>
                    {roomType === 'group' && (
                      <Ionicons name="checkmark" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dropdownOption,
                      roomType === 'direct' && styles.dropdownOptionSelected,
                    ]}
                    onPress={() => {
                      onRoomTypeChange('direct');
                      onToggleDropdown();
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        roomType === 'direct' && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      Direct
                    </Text>
                    {roomType === 'direct' && (
                      <Ionicons name="checkmark" size={20} color="#007AFF" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
              disabled={creating}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.createModalButton,
                (!roomName.trim() || creating) && styles.createModalButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={!roomName.trim() || creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.createModalButtonText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

