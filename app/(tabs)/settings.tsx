import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import {
  getPlayerTag,
  setPlayerTag,
  getApiToken,
  setApiToken,
} from '../../src/hooks/usePlayer';
import { usePlayerActions } from '../../src/hooks/usePlayerContext';
import { useDialog } from '../../src/components/AlertDialog';

interface SettingItemProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

function SettingItem({ icon, label, value, onPress, showArrow = true, danger }: SettingItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingItem, pressed && styles.settingPressed]}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
          <Ionicons name={icon as any} size={16} color={danger ? Colors.textPrimary : Colors.textTertiary} />
        </View>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue} numberOfLines={1}>{value}</Text>}
        {showArrow && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
      </View>
    </Pressable>
  );
}

interface SettingGroupProps {
  title?: string;
  children: React.ReactNode;
}

function SettingGroup({ title, children }: SettingGroupProps) {
  return (
    <View style={styles.group}>
      {title && <Text style={styles.groupTitle}>{title}</Text>}
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const { bumpTagVersion } = usePlayerActions();
  const { show: showDialog, Dialog } = useDialog();
  const [playerTag, setPlayerTagState] = useState('');
  const [apiToken, setApiTokenState] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [modalPlaceholder, setModalPlaceholder] = useState('');
  const [modalOnSave, setModalOnSave] = useState<(text: string) => void>(() => {});

  useEffect(() => {
    getPlayerTag().then(setPlayerTagState);
    getApiToken().then((t) => {
      setApiTokenState(t.substring(0, 20) + '…');
    });
  }, []);

  const openModal = (title: string, placeholder: string, current: string, onSave: (text: string) => void) => {
    setModalTitle(title);
    setModalValue(current);
    setModalPlaceholder(placeholder);
    setModalOnSave(() => onSave);
    setModalVisible(true);
  };

  const handleEditTag = () => {
    openModal('Player Tag', '#PG8U2LR00', playerTag, async (text) => {
      if (text && text.startsWith('#')) {
        await setPlayerTag(text);
        setPlayerTagState(text);
        bumpTagVersion();
      }
    });
  };

  const handleEditToken = () => {
    openModal('API Token', 'Paste your API token', '', async (text) => {
      if (text) {
        await setApiToken(text);
        setApiTokenState(text.substring(0, 20) + '…');
        bumpTagVersion();
      }
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <SettingGroup title="ACCOUNT">
          <SettingItem
            icon="person-outline"
            label="Player Tag"
            value={playerTag}
            onPress={handleEditTag}
          />
          <SettingItem
            icon="key-outline"
            label="API Token"
            value={apiToken}
            onPress={handleEditToken}
            showArrow={false}
          />
          <SettingItem
            icon="sync-outline"
            label="Sync Now"
            onPress={() => {
              bumpTagVersion();
              showDialog({ title: 'Sync', message: 'Data will refresh now.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
            }}
          />
        </SettingGroup>

        <SettingGroup title="APPEARANCE">
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="moon-outline" size={16} color={Colors.textTertiary} />
              </View>
              <Text style={styles.settingLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(v) => {
                if (!v) {
                  showDialog({
                    title: 'Dark Mode',
                    message: 'ClashPrime is designed for dark mode. Light mode coming soon.',
                    actions: [{ label: 'OK', primary: true, onPress: () => {} }],
                  });
                }
                setIsDark(true);
              }}
              trackColor={{ false: Colors.border, true: Colors.textMuted }}
              thumbColor={isDark ? Colors.textPrimary : Colors.bgCard}
            />
          </View>
        </SettingGroup>

        <SettingGroup title="DATA">
          <SettingItem
            icon="cloud-download-outline"
            label="Clear Cache"
            onPress={() => showDialog({ title: 'Cleared', message: 'Local cache cleared.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] })}
          />
          <SettingItem
            icon="download-outline"
            label="Export Data"
            onPress={() => showDialog({ title: 'Export', message: 'Feature coming soon.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] })}
          />
        </SettingGroup>

        <SettingGroup title="ABOUT">
          <SettingItem
            icon="information-circle-outline"
            label="About ClashPrime"
            value="v1.0.0"
            onPress={() => showDialog({ title: 'ClashPrime', message: 'A premium Clash of Clans companion app.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] })}
          />
          <SettingItem
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() => {}}
          />
          <SettingItem
            icon="heart-outline"
            label="Credits"
            onPress={() => showDialog({
              title: 'Credits',
              message: 'Built by @FarhanZafarr-9 on GitHub.',
              actions: [
                { label: 'Visit GitHub', onPress: () => {
                  import('expo-linking').then(({ openURL }) => {
                    openURL('https://github.com/FarhanZafarr-9');
                  });
                }},
                { label: 'Close', primary: true, onPress: () => {} },
              ],
            })}
          />
          <SettingItem
            icon="chatbubble-outline"
            label="Send Feedback"
            onPress={() => {}}
          />
        </SettingGroup>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ClashPrime v1.0.0</Text>
          <Text style={styles.footerSubtext}>Built by @FarhanZafarr-9</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <TextInput
              style={styles.modalInput}
              value={modalValue}
              onChangeText={setModalValue}
              placeholder={modalPlaceholder}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={() => {
                  modalOnSave(modalValue);
                  setModalVisible(false);
                }}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Dialog />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  group: {
    marginBottom: Spacing.xl,
  },
  groupTitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  groupCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    marginHorizontal: Spacing.base,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  settingPressed: {
    backgroundColor: Colors.bgCardHover,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDanger: {
    backgroundColor: Colors.destructive,
  },
  settingLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  settingLabelDanger: {
    color: Colors.textPrimary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: '45%',
    flexShrink: 0,
  },
  settingValue: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    flexShrink: 1,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.xs,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footerSubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.base,
  },
  modalTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  modalInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  modalCancelText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  modalSaveBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
  },
  modalSaveText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
});
