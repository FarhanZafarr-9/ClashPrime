import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import PressableRipple from '../src/components/PressableRipple';
import { useDialog } from '../src/components/AlertDialog';
import { usePlayer } from '../src/hooks/usePlayerContext';
import { parseCocExport, cocExportToBuildingLevels, normalizeTag, CocImportResult } from '../src/utils/cocExport';
import { getBuildingCategories } from '../src/utils/buildingData';
import { getBuildingEffectiveMax, getBuildingLevelImageSource } from '../src/utils/buildingImages';
import { getCountAtTH, getBuildingCopies, toJsonName } from '../src/utils/buildingCopies';
import { Colors, Typography, Spacing, Radius } from '../src/theme';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

function BuildingRowIcon({ storeName, level }: { storeName: string; level: number }) {
  const src = getBuildingLevelImageSource(toJsonName(storeName), level);
  return src ? (
    <Image source={src} style={styles.levelIcon} resizeMode="contain" />
  ) : (
    <View style={styles.levelIconBox}>
      <Ionicons name="business-outline" size={16} color={Colors.textTertiary} />
    </View>
  );
}

export default function ImportExportScreen() {
  const router = useRouter();
  const { player, accounts, setBulkLevels, applyLevelsToAccount } = usePlayer();
  const { show, Dialog } = useDialog();

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CocImportResult | null>(null);
  const [exportTag, setExportTag] = useState<string | null>(null);

  const handleParse = (raw: string) => {
    const parsed = parseCocExport(raw);
    if (!parsed.ok || !parsed.data) {
      setError(parsed.error ?? 'Failed to parse export.');
      setResult(null);
      setExportTag(null);
      return;
    }
    setError(null);
    setResult(cocExportToBuildingLevels(parsed.data));
    setExportTag(normalizeTag(parsed.data.tag) || null);
  };

  const handlePaste = async () => {
    try {
      const raw = await Clipboard.getStringAsync();
      if (raw) {
        setText(raw);
        handleParse(raw);
      } else {
        setError('Clipboard is empty. Copy the export JSON first, then try again.');
      }
    } catch {
      setError('Could not read the clipboard. Paste the JSON manually instead.');
    }
  };

  const applyCount = result?.resolved.length ?? 0;
  const canApply = applyCount > 0 && !!player;

  // Which attached account the export's tag points at (null when the tag is
  // absent or doesn't match an attached account — falls back to the active one).
  const targetAccount = exportTag
    ? accounts.find((a) => a.tag.toUpperCase() === exportTag) ?? null
    : null;
  const targetIsActive = targetAccount?.tag === player?.tag;
  const tagUnattached = exportTag !== null && targetAccount === null;

  // Building categories and their header icons (matches the home tab).
  const BUILDING_CAT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    Defenses: 'shield-half-outline',
    Resources: 'cash-outline',
    Traps: 'warning-outline',
    Army: 'hammer-outline',
    Walls: 'grid-outline',
  };

  // Projected progress per building category after the import, compared with the
  // current levels — shown as "before % → after %" rows like the home dialog.
  const progressImpact = useMemo(() => {
    if (!player || !result) return [];
    const th = player.townHallLevel ?? 0;
    const merged = { ...(player.buildingLevels || {}), ...result.levels };
    const rows: { key: string; icon: keyof typeof Ionicons.glyphMap; before: number; after: number }[] = [];
    for (const cat of ['Defenses', 'Resources', 'Army', 'Traps', 'Walls']) {
      const items = getBuildingCategories(th)[cat] ?? {};
      const entries = Object.entries(items).filter(([, thData]) => {
        const thEntry = thData[String(th)];
        return thEntry != null && (thEntry.level ?? 0) > 0;
      });
      if (entries.length === 0) continue;
      const calc = (levels: Record<string, number>) => {
        let totalLevel = 0;
        let totalMax = 0;
        for (const [name] of entries) {
          const effectiveMax = getBuildingEffectiveMax(name, th);
          const count = getCountAtTH(name, th);
          const copies = getBuildingCopies(name, levels, player.buildings, effectiveMax, count, player.lastMaxedTH, th);
          totalLevel += copies.levels.reduce((s, l) => s + l, 0);
          totalMax += count * effectiveMax;
        }
        return totalMax > 0 ? totalLevel / totalMax : 0;
      };
      const before = calc(player.buildingLevels || {});
      const after = calc(merged);
      if (Math.abs(after - before) > 0.0001) {
        rows.push({ key: cat, icon: BUILDING_CAT_ICONS[cat] ?? 'apps-outline', before, after });
      }
    }
    return rows;
  }, [player, result]);

  const doApply = (tag: string) => {
    if (!result || !player) return;
    const th = player.townHallLevel ?? 12;
    const perBuilding = result.resolved.map((item) => ({
      name: item.storeName,
      levels: new Array(Math.max(item.copies, 1)).fill(item.level),
      maxLevel: getBuildingEffectiveMax(item.storeName, th),
    }));
    if (tag === player.tag) {
      setBulkLevels(result.levels, perBuilding);
      router.back();
      return;
    }
    const target = accounts.find((a) => a.tag === tag);
    applyLevelsToAccount(tag, result.levels, perBuilding);
    show({
      title: 'Levels applied',
      message: `Building levels were saved to ${target?.name || tag}. Switch to that account to see them.`,
      actions: [{ label: 'OK', primary: true, onPress: () => router.back() }],
    });
  };

  const handleApply = () => {
    if (!result || !player) return;
    if (tagUnattached) {
      show({
        title: 'Account not attached',
        message: `This export is for ${exportTag}, which isn't one of your attached accounts. Levels will be applied to ${player.name} (${player.tag}) instead. Continue?`,
        actions: [
          { label: 'Cancel', onPress: () => {} },
          { label: 'Import to active', primary: true, onPress: () => doApply(player.tag) },
        ],
      });
      return;
    }
    const targetTag = targetAccount?.tag ?? player.tag;
    const forActive = targetAccount === null || targetIsActive;
    show({
      title: 'Apply imported levels?',
      message: forActive
        ? `Set ${applyCount} building level${applyCount === 1 ? '' : 's'} for ${player.name}. Existing levels you did not import are kept.`
        : `Set ${applyCount} building level${applyCount === 1 ? '' : 's'} for ${targetAccount!.name || targetAccount!.tag} (${targetAccount!.tag}). This account is not active right now — the levels are saved to its cache.`,
      actions: [
        { label: 'Cancel', onPress: () => {} },
        { label: 'Apply', primary: true, onPress: () => doApply(targetTag) },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <PressableRipple style={styles.backBtn} onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </PressableRipple>
          <View style={styles.headerText}>
            <Text style={styles.title}>Import Levels</Text>
            <Text style={styles.subtitle}>From a Clash of Clans JSON Export</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="document-text-outline" size={20} color={Colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Paste the export</Text>
                <Text style={styles.cardSubtitle}>Home Village buildings and traps are imported</Text>
              </View>
            </View>

            <TextInput
              style={styles.input}
              multiline
              value={text}
              onChangeText={(t) => {
                setText(t);
                if (error) setError(null);
              }}
              placeholder={'Paste the full export JSON here…\ne.g. {"tag":"#AAAAAA","buildings":[…],…}'}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              textAlignVertical="top"
            />

            <View style={styles.btnRow}>
              <PressableRipple style={styles.ghostBtn} onPress={handlePaste}>
                <Ionicons name="clipboard-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.ghostBtnText}>Paste from clipboard</Text>
              </PressableRipple>
              <PressableRipple
                style={styles.parseBtn}
                onPress={() => handleParse(text)}
                disabled={!text.trim()}
              >
                <Text style={styles.parseBtnText}>Parse</Text>
              </PressableRipple>
            </View>

            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.destructive} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>

          {result ? (
            <View style={styles.resultSection}>
              <Text style={styles.sectionTitle}>Import Summary</Text>
              <View style={styles.rows}>
                {(() => {
                  const summaryRows = [
                    { key: 'tag', icon: 'pricetag-outline' as const, label: 'Export tag', value: exportTag ?? '—', warning: !!exportTag && tagUnattached },
                    {
                      key: 'target',
                      icon: 'person-outline' as const,
                      label: 'Importing to',
                      value: tagUnattached
                        ? `${player?.name ?? 'active account'} (not attached)`
                        : targetAccount
                          ? (targetAccount.name || targetAccount.tag) + (targetIsActive ? ' (active)' : '')
                          : `${player?.name ?? 'active account'} (active)`,
                      warning: tagUnattached,
                    },
                    { key: 'matched', icon: 'checkmark-done-outline' as const, label: 'Buildings matched', value: String(result.resolved.length) },
                    { key: 'skipped', icon: 'eye-off-outline' as const, label: 'Skipped (not tracked)', value: String(result.skipped.length) },
                    { key: 'unknown', icon: 'help-circle-outline' as const, label: 'Unknown IDs', value: String(result.unresolved.length), warning: result.unresolved.length > 0 },
                  ];
                  return summaryRows.map((r, i) => (
                    <View
                      key={r.key}
                      style={[
                        styles.row,
                        i === 0 && styles.rowFirst,
                        i === summaryRows.length - 1 && styles.rowLast,
                        i < summaryRows.length - 1 && styles.rowBorder,
                      ]}
                    >
                      <Ionicons name={r.icon} size={15} color={Colors.textSecondary} />
                      <Text style={styles.rowLabel}>{r.label}</Text>
                      <Text style={[styles.rowAfter, r.warning && { color: Colors.warning }]} numberOfLines={1}>
                        {r.value}
                      </Text>
                    </View>
                  ));
                })()}
              </View>

              {progressImpact.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Progress Impact</Text>
                  <View style={styles.rows}>
                    {progressImpact.map((c, i) => (
                      <View
                        key={c.key}
                        style={[
                          styles.row,
                          i === 0 && styles.rowFirst,
                          i === progressImpact.length - 1 && styles.rowLast,
                          i < progressImpact.length - 1 && styles.rowBorder,
                        ]}
                      >
                        <Ionicons name={c.icon} size={15} color={Colors.textSecondary} />
                        <Text style={styles.rowLabel}>{c.key}</Text>
                        <Text style={styles.rowValue}>
                          <Text style={styles.rowBefore}>{Math.round(c.before * 100)}%</Text>
                          {'  →  '}
                          <Text style={styles.rowAfter}>{Math.round(c.after * 100)}%</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {result.unresolved.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Unknown building IDs</Text>
                  <Text style={styles.sectionHint}>
                    These IDs are not in the app's data package and will be ignored.
                  </Text>
                  <View style={styles.list}>
                    {result.unresolved.map((u, i) => (
                      <View key={u.dataId} style={[styles.levelRow, i < result.unresolved.length - 1 && styles.levelRowBorder]}>
                        <Text style={styles.levelName} numberOfLines={1}>#{u.dataId}</Text>
                        <Text style={styles.levelValue}>Lv {u.level} · ×{u.copies}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              <PressableRipple
                style={[styles.applyBtn, !canApply && styles.applyBtnDisabled]}
                onPress={handleApply}
                disabled={!canApply}
              >
                <Text style={styles.applyBtnText}>
                  {player
                    ? `Apply ${applyCount} level${applyCount === 1 ? '' : 's'} to ${player.name}`
                    : 'Waiting for account…'}
                </Text>
              </PressableRipple>

              {result.resolved.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Buildings to update</Text>
                  <View style={styles.list}>
                    {result.resolved.map((item, i) => (
                      <View key={item.storeName} style={[styles.levelRow, i < result.resolved.length - 1 && styles.levelRowBorder]}>
                        <BuildingRowIcon storeName={item.storeName} level={item.level} />
                        <Text style={styles.levelName} numberOfLines={1}>{item.displayName}</Text>
                        <Text style={styles.levelValue}>Lv {item.level} · ×{item.copies}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              {result.skipped.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Not tracked by the app</Text>
                  <Text style={styles.sectionHint}>
                    Town Hall and similar entities are skipped because the app reads those from the API.
                  </Text>
                  <View style={styles.list}>
                    {result.skipped.map((item, i) => (
                      <View key={item.storeName} style={[styles.levelRow, i < result.skipped.length - 1 && styles.levelRowBorder]}>
                        <BuildingRowIcon storeName={item.storeName} level={item.level} />
                        <Text style={styles.levelName} numberOfLines={1}>{item.displayName}</Text>
                        <Text style={styles.levelValue}>Lv {item.level} · ×{item.copies}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Dialog />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    marginRight: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...Typography.title2,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  scroll: {
    padding: Spacing.base,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  cardSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  input: {
    width: '100%',
    maxWidth: '100%',
    height: 150,
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    color: Colors.textPrimary,
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ghostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  ghostBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  parseBtn: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  parseBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    ...Typography.footnote,
    color: Colors.destructive,
    flex: 1,
    lineHeight: 16,
  },
  resultSection: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sectionHint: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    lineHeight: 16,
    paddingHorizontal: Spacing.sm,
  },
  rows: {
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.bgSubtle,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowFirst: {
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  rowLast: {
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
  },
  rowLabel: {
    flex: 1,
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  rowValue: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rowBefore: {
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  rowAfter: {
    ...Typography.subhead,
    color: Colors.success,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  list: {
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgSubtle,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.base,
  },
  levelRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  levelIcon: {
    width: 24,
    height: 24,
  },
  levelIconBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelName: {
    flex: 1,
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  levelValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  applyBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '700',
  },
});
