import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { EmptyState } from '../../src/components/EmptyState';
import { SavedBase, getSavedBases, removeBase } from '../../src/hooks/usePlayer';
import { useDialog } from '../../src/components/AlertDialog';

type Tab = 'saved' | 'favorites' | 'recent' | 'armies';

const DEMO_ARMIES = [
  { id: 'a1', name: 'Lavaloon', troopCount: 28, spellCount: 11 },
  { id: 'a2', name: 'Hybrid QC', troopCount: 30, spellCount: 11 },
  { id: 'a3', name: 'Yeti Smash', troopCount: 26, spellCount: 11 },
];

export default function SavedScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('saved');
  const [bases, setBases] = useState<SavedBase[]>([]);
  const { show: showDialog, Dialog } = useDialog();

  useFocusEffect(
    useCallback(() => {
      getSavedBases().then(setBases);
    }, [])
  );

  const handleRemove = (id: string) => {
    showDialog({
      title: 'Remove',
      message: 'Remove this saved base?',
      actions: [
        { label: 'Cancel', onPress: () => {} },
        {
          label: 'Remove',
          destructive: true,
          onPress: async () => {
            await removeBase(id);
            setBases((prev) => prev.filter((b) => b.id !== id));
          },
        },
      ],
    });
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'saved', label: 'Saved', icon: 'bookmark-outline' },
    { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
    { key: 'recent', label: 'Recent', icon: 'time-outline' },
    { key: 'armies', label: 'Armies', icon: 'flash-outline' },
  ];

  const savedBases = bases;
  const recentBases = bases.filter((b) => b.copiedAt).slice(0, 5);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.key ? Colors.bg : Colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'saved' && (
          savedBases.length === 0 ? (
            <EmptyState
              icon="🔖"
              title="No saved bases"
              description="Save bases from the Base Library to access them quickly."
            />
          ) : (
            savedBases.map((base) => (
              <View key={base.id} style={styles.listItem}>
                <View style={styles.itemIcon}>
                  <Text style={styles.itemIconText}>TH{base.townHallLevel}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{base.name}</Text>
                  <Text style={styles.itemMeta}>{base.category} · Rating {base.rating}</Text>
                </View>
                <Pressable onPress={() => handleRemove(base.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
                </Pressable>
              </View>
            ))
          )
        )}

        {activeTab === 'favorites' && (
          <EmptyState
            icon="♡"
            title="No favorites yet"
            description="Tap the heart icon on any base to add it to your favorites."
          />
        )}

        {activeTab === 'recent' && (
          recentBases.length === 0 ? (
            <EmptyState
              icon="⏱"
              title="No recently copied"
              description="Copied base layouts will appear here for quick access."
            />
          ) : (
            recentBases.map((base) => (
              <View key={base.id} style={styles.listItem}>
                <View style={styles.itemIcon}>
                  <Text style={styles.itemIconText}>TH{base.townHallLevel}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{base.name}</Text>
                  <Text style={styles.itemMeta}>
                    {base.copiedAt
                      ? new Date(base.copiedAt).toLocaleDateString()
                      : 'Unknown date'}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color={Colors.textTertiary} />
              </View>
            ))
          )
        )}

        {activeTab === 'armies' && (
          DEMO_ARMIES.length === 0 ? (
            <EmptyState
              icon="⚔️"
              title="No saved armies"
              description="Save army compositions from the profile to reuse them."
            />
          ) : (
            DEMO_ARMIES.map((army) => (
              <View key={army.id} style={styles.listItem}>
                <View style={styles.itemIcon}>
                  <Ionicons name="flash" size={16} color={Colors.textPrimary} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{army.name}</Text>
                  <Text style={styles.itemMeta}>
                    {army.troopCount} troops · {army.spellCount} spells
                  </Text>
                </View>
                <Pressable hitSlop={8}>
                  <Ionicons name="copy-outline" size={16} color={Colors.textTertiary} />
                </Pressable>
              </View>
            ))
          )
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      <Dialog />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
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
  tabsContainer: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    paddingBottom: Spacing.base,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 44,
    maxWidth: 160,
    height: 36,
    paddingHorizontal: Spacing.base,
    paddingVertical: 0,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  tabText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.bg,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: Spacing.base,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  itemMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
