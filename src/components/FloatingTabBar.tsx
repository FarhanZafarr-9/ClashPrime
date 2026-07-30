import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import PressableRipple from './PressableRipple';

type IconDef = { set: 'ion' | 'mc'; name: string };

const MAIN_TABS: { key: string; icon: IconDef }[] = [
  { key: 'index', icon: { set: 'ion', name: 'home' } },
  { key: 'army', icon: { set: 'mc', name: 'sword-cross' } },
  { key: 'buildings', icon: { set: 'mc', name: 'castle' } },
  { key: 'bases', icon: { set: 'ion', name: 'grid' } },
  { key: 'events', icon: { set: 'ion', name: 'calendar-outline' } },
  { key: 'settings', icon: { set: 'ion', name: 'settings-sharp' } },
];

const EXTRA_TABS: { key: string; label: string; icon: IconDef }[] = [
  { key: 'armies', label: 'Armies', icon: { set: 'ion', name: 'shield-half-outline' } },
  { key: 'achievements', label: 'Awards', icon: { set: 'ion', name: 'trophy-outline' } },
  { key: 'war', label: 'War', icon: { set: 'ion', name: 'flag-outline' } },
  { key: 'saved', label: 'Saved', icon: { set: 'ion', name: 'bookmarks-outline' } },
];

function TabIcon({ icon, color, size }: { icon: IconDef; color: string; size?: number }) {
  const s = size ?? 18;
  return icon.set === 'mc' ? (
    <MaterialCommunityIcons name={icon.name as any} size={s} color={color} />
  ) : (
    <Ionicons name={icon.name as any} size={s} color={color} />
  );
}

export default function FloatingTabBar({ state, navigation }: any) {
  const [menuVisible, setMenuVisible] = useState(false);

  const activeKey = state.routeNames[state.index];

  const navigate = (key: string) => {
    const route = state.routes.find((r: any) => r.key === key || r.name === key);
    if (route) {
      navigation.navigate(route.name);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.bar}>
          {MAIN_TABS.map((tab) => {
            const isActive = activeKey === tab.key;
            return (
              <PressableRipple key={tab.key} style={[styles.tabItem, isActive && styles.tabItemActive]} onPress={() => navigate(tab.key)}>
                <TabIcon icon={tab.icon} color={isActive ? Colors.textPrimary : Colors.textMuted} />
              </PressableRipple>
            );
          })}
          <PressableRipple style={styles.tabItem} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
          </PressableRipple>
        </View>
      </View>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)} statusBarTranslucent>
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.popup}>
            <Text style={styles.popupTitle}>More</Text>
            <View style={styles.popupGrid}>
              {EXTRA_TABS.map((tab) => {
                const isActive = activeKey === tab.key;
                return (
                  <PressableRipple
                    key={tab.key}
                    style={[styles.popupItem, isActive && styles.popupItemActive]}
                    onPress={() => { navigate(tab.key); setMenuVisible(false); }}
                  >
                    <TabIcon icon={tab.icon} color={isActive ? Colors.textPrimary : Colors.textSecondary} size={14} />
                    <Text style={[styles.popupItemText, isActive && styles.popupItemTextActive]}>{tab.label}</Text>
                  </PressableRipple>
                );
              })}
            </View>
            <PressableRipple style={styles.popupClose} onPress={() => setMenuVisible(false)}>
              <Text style={styles.popupCloseText}>Close</Text>
            </PressableRipple>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: Spacing.base,
    pointerEvents: 'box-none',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.bgElevated,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: Colors.accentSubtle,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingBottom: 110,
  },
  popup: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  popupTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },
  popupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  popupItem: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
  },
  popupItemActive: {
    backgroundColor: Colors.accentSubtle,
  },
  popupItemText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontSize: 11,
  },
  popupItemTextActive: {
    color: Colors.textPrimary,
  },
  popupClose: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.lg,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  popupCloseText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
