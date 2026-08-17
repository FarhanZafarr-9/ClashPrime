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
import { useBuilderCount } from '../src/hooks/useBuilderCount';
import { parseCocExport, cocExportToBuildingLevels, normalizeTag, CocImportResult } from '../src/utils/cocExport';
import { getBuildingEffectiveMax, getBuildingLevelImageSource } from '../src/utils/buildingImages';
import { getCountAtTH, getBuildingCopies, toJsonName } from '../src/utils/buildingCopies';
import { buildingUpgradeCosts, buildingUpgradeChainTimes, scheduleChains, sumCosts, formatCost, formatTime, formatTimeShort, formatCostBreakdown } from '../src/utils/upgradeCosts';
import { PACKAGE_RESOURCE_IMAGES } from '../src/data/packageImages';
import { BUILDING_RESOURCE_META, type BuildingCostResource } from '../src/utils/buildingData';
import { Colors, Typography, Spacing, Radius, useTheme } from '../src/theme';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const RESOURCE_ORDER: BuildingCostResource[] = [
  'Gold',
  'Elixir',
  'Dark Elixir',
  'Builder Gold',
  'Builder Elixir',
  'Gold or Elixir',
  'Builder Gold or Builder Elixir',
];

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
  const { colors } = useTheme();
  const { count: builderCount } = useBuilderCount();

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

  // Which attached account the export's tag points at (null when the tag is
  // absent or doesn't match an attached account — falls back to the active one).
  const targetAccount = exportTag
    ? accounts.find((a) => a.tag.toUpperCase() === exportTag) ?? null
    : null;
  const targetIsActive = targetAccount?.tag === player?.tag;
  const tagUnattached = exportTag !== null && targetAccount === null;

  // Actual upgrades the import would perform: only buildings whose imported
  // level is higher than their current per-copy level. Each copy is upgraded
  // independently, and time/cost come straight from the package data.
  const upgradeRows = useMemo(() => {
    if (!player || !result) return [];
    const th = player.townHallLevel ?? 0;
    const rows: {
      storeName: string;
      displayName: string;
      currentLevel: number;
      targetLevel: number;
      copies: number;
      levels: number[];
      timeSec: number;
      cost: number;
      byResource: Record<string, number>;
    }[] = [];
    for (const item of result.resolved) {
      const effectiveMax = getBuildingEffectiveMax(item.storeName, th);
      if (effectiveMax <= 0) continue;
      const count = getCountAtTH(item.storeName, th);
      const targetLevel = Math.min(item.level, effectiveMax);
      const copies = getBuildingCopies(
        item.storeName,
        player.buildingLevels,
        player.buildings,
        effectiveMax,
        count,
        player.lastMaxedTH,
        th,
      );
      const highestCurrent = copies.levels.length > 0 ? Math.max(...copies.levels) : 0;
      if (targetLevel <= highestCurrent) continue;
      const ct = buildingUpgradeCosts(item.storeName, copies.levels, targetLevel);
      if (ct.time <= 0 && ct.cost <= 0) continue;
      rows.push({
        storeName: item.storeName,
        displayName: item.displayName,
        currentLevel: highestCurrent,
        targetLevel,
        copies: count,
        levels: copies.levels,
        timeSec: ct.time,
        cost: ct.cost,
        byResource: ct.byResource ?? {},
      });
    }
    return rows.sort((a, b) => b.timeSec - a.timeSec);
  }, [player, result]);

  // Builders pipeline for the upgrades: chain-scheduled time + per-resource costs.
  const upgradePipeline = useMemo(() => {
    if (upgradeRows.length === 0) return null;
    const ct = sumCosts(
      upgradeRows.map((r) => ({ cost: r.cost, time: r.timeSec, hasData: true, byResource: r.byResource })),
    );
    const chains = upgradeRows.flatMap((r) =>
      buildingUpgradeChainTimes(r.storeName, r.levels, r.targetLevel),
    );
    return {
      timeSec: scheduleChains(chains, builderCount),
      cost: ct.cost,
      byResource: ct.byResource ?? {},
    };
  }, [upgradeRows, builderCount]);

  const applyCount = upgradeRows.length;
  const canApply = applyCount > 0 && !!player;

  const doApply = (tag: string) => {
    if (!result || !player) return;
    const th = player.townHallLevel ?? 12;
    const perBuilding = upgradeRows.map((row) => ({
      name: row.storeName,
      levels: new Array(Math.max(row.copies, 1)).fill(row.targetLevel),
      maxLevel: getBuildingEffectiveMax(row.storeName, th),
    }));
    const levels: Record<string, number> = {};
    for (const row of upgradeRows) levels[row.storeName] = row.targetLevel;
    if (tag === player.tag) {
      setBulkLevels(levels, perBuilding);
      router.back();
      return;
    }
    const target = accounts.find((a) => a.tag === tag);
    applyLevelsToAccount(tag, levels, perBuilding);
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
                    { key: 'matched', icon: 'checkmark-done-outline' as const, label: 'Buildings to upgrade', value: String(upgradeRows.length) },
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

              {upgradePipeline ? (
                <>
                  <Text style={styles.sectionTitle}>Builders pipeline</Text>
                  <View style={[styles.pipelineCard, { backgroundColor: colors.bgCard }]}>
                    <View style={styles.pipelineHeader}>
                      <View style={styles.pipelineIcon}>
                        <Ionicons name="hammer-outline" size={16} color={Colors.textPrimary} />
                      </View>
                      <View style={styles.pipelineText}>
                        <Text style={styles.pipelineTitle}>Builders</Text>
                        <Text style={styles.pipelineDesc}>Buildings upgraded by this import</Text>
                      </View>
                      <View style={styles.pipelineBadge}>
                        <Text style={styles.pipelineBadgeText}>{formatTime(upgradePipeline.timeSec)}</Text>
                      </View>
                    </View>
                    <View style={styles.summaryCard}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Time with {builderCount} builders</Text>
                        <Text style={styles.summaryValue}>{formatTime(upgradePipeline.timeSec)}</Text>
                      </View>
                      <View style={styles.summaryDivider} />
                      {(() => {
                        const entries = (Object.entries(upgradePipeline.byResource).filter(([, v]) => v > 0) as [string, number][])
                          .filter(([r]) => r !== 'Unknown')
                          .sort((a, b) => {
                            const ia = RESOURCE_ORDER.indexOf(a[0] as BuildingCostResource);
                            const ib = RESOURCE_ORDER.indexOf(b[0] as BuildingCostResource);
                            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                          });
                        if (entries.length === 0) {
                          return (
                            <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>Cost</Text>
                              <Text style={styles.summaryValue}>{formatCost(upgradePipeline.cost)}</Text>
                            </View>
                          );
                        }
                        return entries.map(([r, v]) => (
                          <View key={r} style={styles.oreRow}>
                            <Image
                              source={PACKAGE_RESOURCE_IMAGES[r]}
                              style={styles.oreIcon}
                              resizeMode="contain"
                            />
                            <Text style={[styles.oreLabel, { color: BUILDING_RESOURCE_META[r as BuildingCostResource]?.color ?? '#94A3B8' }]}>
                              {BUILDING_RESOURCE_META[r as BuildingCostResource]?.label ?? r}
                            </Text>
                            <Text style={styles.oreValue}>{formatCost(v)}</Text>
                          </View>
                        ));
                      })()}
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>Upgrades</Text>
                  <View style={styles.upgradeList}>
                    {upgradeRows.map((u, i) => (
                      <View
                        key={u.storeName}
                        style={[
                          styles.upgradeRow,
                          { backgroundColor: colors.bgCard },
                          i === 0 && styles.upgradeRowFirst,
                          i === upgradeRows.length - 1 && styles.upgradeRowLast,
                        ]}
                      >
                        <BuildingRowIcon storeName={u.storeName} level={u.targetLevel} />
                        <View style={styles.upgradeText}>
                          <Text style={styles.rowLabel} numberOfLines={1}>{u.displayName}</Text>
                          <Text style={styles.upgradeSub}>
                            Lv {u.currentLevel} → Lv {u.targetLevel} · ×{u.copies}
                          </Text>
                        </View>
                        <View style={styles.upgradeRight}>
                          <Text style={styles.upgradeTime}>{formatTimeShort(u.timeSec)}</Text>
                          <Text style={styles.upgradeCost} numberOfLines={1}>
                            {formatCostBreakdown(u.byResource) || formatCost(u.cost)}
                          </Text>
                        </View>
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
  pipelineCard: {
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  pipelineIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineText: {
    flex: 1,
  },
  pipelineTitle: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  pipelineDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  pipelineBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineBadgeText: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  summaryCard: {
    backgroundColor: Colors.bgSubtle,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.base,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  summaryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
    fontVariant: ['tabular-nums'],
  },
  oreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  oreIcon: {
    width: 18,
    height: 18,
  },
  oreLabel: {
    ...Typography.footnote,
    flex: 1,
    fontWeight: '600',
  },
  oreValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  upgradeText: {
    flex: 1,
  },
  upgradeList: {
    gap: Spacing.xs + 2,
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.sm,
  },
  upgradeRowFirst: {
    borderTopLeftRadius: Radius.xl * 1.25,
    borderTopRightRadius: Radius.xl * 1.25,
  },
  upgradeRowLast: {
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
  },
  upgradeSub: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  upgradeRight: {
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: 130,
  },
  upgradeTime: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  upgradeCost: {
    ...Typography.caption,
    color: Colors.textSecondary,
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
