import { importUpgradeSnapshot } from '../src/utils/importedUpgrades';
import { getArmyItemImage } from '../src/utils/armyData';
import PageScreen from '../src/components/PageScreen';
import HeaderButton from '../src/components/HeaderButton';
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import PressableRipple from '../src/components/PressableRipple';
import { useDialog } from '../src/components/AlertDialog';
import { usePlayer } from '../src/hooks/usePlayerContext';
import { setBulkCraftedLevels } from '../src/hooks/usePlayer';
import { useBuilderCount } from '../src/hooks/useBuilderCount';
import { useBuilderBaseCount } from '../src/hooks/useBuilderBaseCount';
import { parseCocExport, cocExportToBuildingLevels, detectBuilderHutCount, normalizeTag, CocImportResult } from '../src/utils/cocExport';
import { getBuildingEffectiveMax, getBuildingLevelImageSource , getTownHallImageSource } from '../src/utils/buildingImages';
import { getCountAtTH, getBuildingCopies, toJsonName } from '../src/utils/buildingCopies';
import { buildingUpgradeCosts, buildingUpgradeChainTimes, scheduleChains, sumCosts, formatCost, formatTime, formatTimeShort, formatCostBreakdown } from '../src/utils/upgradeCosts';
import { PACKAGE_RESOURCE_IMAGES } from '../src/data/packageImages';
import { BUILDING_RESOURCE_META, isBuilderName, type BuildingCostResource } from '../src/utils/buildingData';
import {
  getCraftedDefense,
  normalizeModuleLevels,
  effectiveLevel,
  statFor,
  nextUpgrade,
  moduleMaxLevel,
} from '../src/utils/craftedDefenses';
import { Colors, Typography, Spacing, Radius, useTheme } from '../src/theme';

const goldElixirImg = require('../assets/package-images/images/other/goldelxir.png') as number;

const RESOURCE_ORDER: BuildingCostResource[] = [
  'Gold',
  'Elixir',
  'Dark Elixir',
  'Builder Gold',
  'Builder Elixir',
  'Gold or Elixir',
  'Builder Gold or Builder Elixir',
];

/** Compound costs (walls) have no single sprite; render the bundled gold/elixir icon. */
const COMPOUND_RESOURCE_ICONS: Record<string, boolean> = {
  'Gold or Elixir': true,
  'Builder Gold or Builder Elixir': true,
};

/** Cap level that gates a building's upgrades: Builder Base buildings are gated
 * by the Builder Hall level, Home Village buildings by the Town Hall level. */
function capLevelFor(storeName: string, th: number, bh: number): number {
  return isBuilderName(storeName) ? bh : th;
}

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
  const { player, accounts, setBulkLevels, setCraftedLevels, applyLevelsToAccount, refresh } = usePlayer();
  const playerThImage = getTownHallImageSource(player?.townHallLevel);
  const { show, Dialog } = useDialog();
  const { colors } = useTheme();
  const { count: builderCount, isVerified: buildersVerified, verifyBuilderCount } = useBuilderCount();
  const { count: builderBaseCount } = useBuilderBaseCount(player?.builderHallLevel);

  const [previewNow, setPreviewNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setPreviewNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CocImportResult | null>(null);
  const [exportTag, setExportTag] = useState<string | null>(null);
  const [detectedHuts, setDetectedHuts] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pastedOk, setPastedOk] = useState(false);

  // Pulls the live profile so the preview above the paste box reflects current
  // troops, heroes, spells and equipment. Building levels keep coming from the
  // pasted export only, so this never overwrites what the import is for.
  const handleRefreshProfile = async () => {
    setRefreshing(true);
    try {
      const updated = await refresh();
      show({
        title: updated ? 'Profile refreshed' : 'Nothing to refresh',
        subtitle: updated
          ? `${updated.name} is up to date`
          : 'No active profile is signed in.',
        icon: updated ? 'checkmark-circle-outline' : 'alert-circle-outline',
        message: updated
          ? 'Troops, heroes, spells and equipment now match the Clash API. Buildings still come from the pasted export.'
          : 'Sign in to an account first.',
        actions: [{ label: 'OK', primary: true, onPress: () => { } }],
      });
    } catch (e: any) {
      show({
        title: 'Refresh failed',
        subtitle: 'Could not reach the Clash API',
        icon: 'alert-circle-outline',
        message: e?.message || 'Check your token and try again.',
        actions: [{ label: 'OK', primary: true, onPress: () => { } }],
      });
    } finally {
      setRefreshing(false);
    }
  };

  const hasPasted = text.trim().length > 0;

  // The paste target and the pasted JSON share one height, so the card does not
  // jump the moment a paste lands. Long exports scroll inside the box rather
  // than stretching it down the page.
  const PASTE_BOX_HEIGHT = 128;

  const handleParse = (raw: string) => {
    const parsed = parseCocExport(raw);
    if (!parsed.ok || !parsed.data) {
      setError(parsed.error ?? 'Failed to parse export.');
      setResult(null);
      setExportTag(null);
      setDetectedHuts(null);
      return;
    }
    setError(null);
    const parsedResult = cocExportToBuildingLevels(parsed.data);
    setResult(parsedResult);
    setExportTag(normalizeTag(parsed.data.tag) || null);

    // Every export carries its Builder Hut rows, so read the count off it here
    // and show the user what it implies. It is only written once the import is
    // actually applied (doApply), so merely pasting a preview changes nothing.
    setDetectedHuts(detectBuilderHutCount(parsedResult));
  };

  const handlePaste = async () => {
    try {
      const raw = await Clipboard.getStringAsync();
      if (!raw) {
        setError('Clipboard is empty. Copy the export JSON first, then try again.');
        return;
      }
      // Validated on the way in rather than on Parse. The export shape is known
      // here, so anything that is not a Clash export is dropped immediately
      // instead of sitting in the box waiting to fail.
      const check = parseCocExport(raw);
      if (!check.ok || !check.data) {
        setText('');
        setPastedOk(false);
        setError(check.error ?? 'That is not a Clash of Clans export. Clipboard discarded.');
        return;
      }
      setError(null);
      setText(raw);
      setPastedOk(true);
      handleParse(raw);
    } catch {
      setError('Could not read the clipboard. Try again.');
    }
  };

  // Which attached account the export's tag points at (null when the tag is
  // absent or doesn't match an attached account — falls back to the active one).
  const targetAccount = exportTag
    ? accounts.find((a) => a.tag.toUpperCase() === exportTag) ?? null
    : null;
  const targetIsActive = targetAccount !== null && exportTag !== null
    && targetAccount.tag.toUpperCase() === player?.tag?.toUpperCase();
  const tagUnattached = exportTag !== null && targetAccount === null;

  // Actual upgrades the import would perform. Each building keeps its per-copy
  // imported levels — a copy is only "upgraded" when its imported level is higher
  // than the current level of the same copy slot — so mixed-level buildings
  // (e.g. 2× Lv12 + 2× Lv13 cannons) upgrade only the lagging copies.
  const upgradeRows = useMemo(() => {
    if (!player || !result) return [];
    const th = player.townHallLevel ?? 0;
    const bh = player.builderHallLevel ?? 1;
    const rows: {
      storeName: string;
      displayName: string;
      builderBase: boolean;
      currentLevel: number;
      targetLevel: number;
      copies: number;
      currentLevels: number[];
      targetLevels: number[];
      changed: number;
      pairs: { c: number; t: number; timeSec: number; cost: number; byResource: Record<string, number> }[];
      timeSec: number;
      cost: number;
      byResource: Record<string, number>;
    }[] = [];
    for (const item of result.resolved) {
      const builderBase = isBuilderName(item.storeName);
      const cap = capLevelFor(item.storeName, th, bh);
      const effectiveMax = getBuildingEffectiveMax(item.storeName, cap);
      if (effectiveMax <= 0) continue;
      const count = getCountAtTH(item.storeName, cap);
      // Import the current completed level; timer rows are saved separately.
      const importedLevels = [...item.levels].map((l) => Math.min(l, effectiveMax)).sort((a, b) => b - a);
      const copiesInfo = getBuildingCopies(
        item.storeName,
        player.buildingLevels,
        player.buildings,
        effectiveMax,
        count,
        player.lastMaxedTH,
        builderBase ? undefined : cap,
      );
      const current = copiesInfo.levels.map((l) => (l > 0 ? Math.min(l, effectiveMax) : 1));
      const currentArr = [...current].sort((a, b) => b - a);
      const slotCount = Math.min(importedLevels.length, currentArr.length);
      const targetLevels = [...currentArr];
      const pairs: { c: number; t: number; timeSec: number; cost: number; byResource: Record<string, number> }[] = [];
      let changed = 0;
      let timeSec = 0;
      let cost = 0;
      const byResource: Record<string, number> = {};
      for (let i = 0; i < slotCount; i++) {
        const t = importedLevels[i];
        const c = currentArr[i];
        if (t > c) {
          const ct = buildingUpgradeCosts(item.storeName, [c], t);
          changed++;
          timeSec += ct.time;
          cost += ct.cost;
          for (const [res, v] of Object.entries(ct.byResource ?? {})) {
            byResource[res] = (byResource[res] ?? 0) + v;
          }
          targetLevels[i] = t;
          pairs.push({ c, t, timeSec: ct.time, cost: ct.cost, byResource: ct.byResource ?? {} });
        }
      }
      if (changed === 0) continue;
      rows.push({
        storeName: item.storeName,
        displayName: item.displayName,
        builderBase,
        currentLevel: currentArr[0] ?? 0,
        targetLevel: Math.max(...targetLevels),
        copies: count,
        currentLevels: currentArr,
        targetLevels,
        changed,
        pairs,
        timeSec,
        cost,
        byResource,
      });
    }
    return rows.sort((a, b) => b.timeSec - a.timeSec);
  }, [player, result]);

  // Builders pipeline for the upgrades. Home Village and Builder Base upgrades
  // are scheduled independently against their own builder counts — the two
  // builders pools run in parallel, so the combined wall-clock time is the
  // larger of the two schedules.
  const upgradePipeline = useMemo(() => {
    if (upgradeRows.length === 0) return null;
    const ct = sumCosts(
      upgradeRows.map((r) => ({ cost: r.cost, time: r.timeSec, hasData: true, byResource: r.byResource })),
    );
    const scheduleRows = (rows: typeof upgradeRows, builders: number): number => {
      if (rows.length === 0) return 0;
      const chains: number[] = [];
      for (const r of rows) {
        for (let i = 0; i < r.currentLevels.length; i++) {
          if (r.targetLevels[i] > r.currentLevels[i]) {
            chains.push(...buildingUpgradeChainTimes(r.storeName, [r.currentLevels[i]], r.targetLevels[i]));
          }
        }
      }
      return scheduleChains(chains, builders);
    };
    const homeTime = scheduleRows(upgradeRows.filter((r) => !r.builderBase), builderCount);
    const bbTime = scheduleRows(upgradeRows.filter((r) => r.builderBase), builderBaseCount);
    return {
      timeSec: Math.max(homeTime, bbTime),
      homeTime,
      bbTime,
      cost: ct.cost,
      byResource: ct.byResource ?? {},
    };
  }, [upgradeRows, builderCount, builderBaseCount]);

  const applyCount = upgradeRows.length;
  const totalChanged = upgradeRows.reduce((s, r) => s + r.changed, 0);

  // A result parsed before `crafted` existed (Fast Refresh keeps the old state) has
  // no such field, so read it defensively rather than trusting the shape.
  const craftedDefs = useMemo(() => result?.crafted ?? [], [result]);

  // Crafted defenses report one level per module rather than a single level, so
  // normalize them against the package's module lists. That fills in any module the
  // export omitted, clamps out-of-range values, and yields the stat each module has
  // reached — plus the effective level (the module sum) the sprites are tiered by.
  const craftedRows = useMemo(
    () =>
      craftedDefs.map((c) => {
        const raw = Object.fromEntries(c.modules.map((m) => [m.name, m.level]));
        const defense = getCraftedDefense(c.displayName);
        const levels = defense ? normalizeModuleLevels(defense, raw) : null;
        const eff = defense && levels ? effectiveLevel(defense, levels) : c.effectiveLevel;
        return {
          name: c.displayName,
          defense,
          // The export already reports every module the game knows, so the raw
          // levels are persisted even when the package does not know this defense
          // yet. Dropping them here would show "detected" and then save nothing.
          levels: levels ?? { ...raw },
          known: !!defense,
          effectiveLevel: eff,
          modules: defense && levels
            ? defense.modules.map((m) => ({
              name: m.name,
              level: levels[m.name],
              max: moduleMaxLevel(m),
              stat: statFor(m, levels[m.name]),
              next: nextUpgrade(defense, m.name, levels[m.name]),
            }))
            : c.modules.map((m) => ({ name: m.name, level: m.level, max: 0, stat: null, next: null })),
        };
      }),
    [craftedDefs],
  );

  /** defense name → module name → level, ready to persist. */
  const craftedPayload = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    for (const row of craftedRows) if (Object.keys(row.levels).length) out[row.name] = row.levels;
    return out;
  }, [craftedRows]);

  // What an apply would actually write. The section below is driven off this
  // rather than craftedDefs, so an export that mentions crafted defenses but
  // carries no levels for them shows nothing instead of an empty block.
  const craftedPayloadCount = Object.keys(craftedPayload).length;

  // Flatten each building into one row per distinct level transition so the list
  // reads cleanly when copies upgrade across different levels. Each variant keeps
  // its own count and summed cost/time.
  const variantRows = useMemo(() => {
    const rows: {
      key: string;
      storeName: string;
      displayName: string;
      c: number;
      t: number;
      count: number;
      timeSec: number;
      cost: number;
      byResource: Record<string, number>;
    }[] = [];
    for (const r of upgradeRows) {
      const group = new Map<string, { c: number; t: number; count: number; timeSec: number; cost: number; byResource: Record<string, number> }>();
      for (const p of r.pairs) {
        const key = `${p.c}->${p.t}`;
        const cur = group.get(key);
        if (cur) {
          cur.count += 1;
          cur.timeSec += p.timeSec;
          cur.cost += p.cost;
          for (const [res, v] of Object.entries(p.byResource)) {
            cur.byResource[res] = (cur.byResource[res] ?? 0) + v;
          }
        } else {
          group.set(key, { c: p.c, t: p.t, count: 1, timeSec: p.timeSec, cost: p.cost, byResource: { ...p.byResource } });
        }
      }
      for (const [key, g] of group) {
        rows.push({ key: `${r.storeName}|${key}`, storeName: r.storeName, displayName: r.displayName, ...g });
      }
    }
    return rows.sort((a, b) => b.timeSec - a.timeSec);
  }, [upgradeRows]);

  // Keep every ongoing timer separate from completed level imports.
  const upgradingRows = useMemo(() => (result?.upgrades ?? []).map(row => ({
    ...row,
    storeName: row.storeName ?? row.name,
    displayName: row.name,
    remainingSec: Math.max(0, (row.completesAt - previewNow) / 1000),
    copies: 1,
  })), [result, previewNow]);
  const hasBuildingChanges = applyCount > 0 && totalChanged > 0;
  const showCrafted = craftedPayloadCount > 0;
  const canApply = !!result && !!player;

  const doApply = async (tag: string) => {
    if (!result || !player) return;
    // The export knows the real hut count, so record it as verified against the
    // account being written to - which is not always the active one.
    if (detectedHuts) await verifyBuilderCount(detectedHuts, tag);
    const th = player.townHallLevel ?? 12;
    const bh = player.builderHallLevel ?? 1;
    const perBuilding = upgradeRows.map((row) => ({
      name: row.storeName,
      levels: [...row.targetLevels],
      maxLevel: getBuildingEffectiveMax(row.storeName, capLevelFor(row.storeName, th, bh)),
    }));
    const levels: Record<string, number> = {};
    for (const row of upgradeRows) levels[row.storeName] = Math.max(...row.targetLevels);
    if (tag.toUpperCase() === player.tag.toUpperCase()) {
      await setBulkLevels(levels, perBuilding);
      if (craftedPayloadCount > 0) await setCraftedLevels(craftedPayload);
      await importUpgradeSnapshot(tag, result);
      router.back();
      return;
    }
    const target = accounts.find((a) => a.tag.toUpperCase() === tag.toUpperCase());
    await applyLevelsToAccount(tag, levels, perBuilding);
    await importUpgradeSnapshot(tag, result);
    if (craftedPayloadCount > 0) await setBulkCraftedLevels(craftedPayload, tag);
    show({
      title: 'Levels applied',
      subtitle: `Saved to ${target?.name || tag}`,
      icon: 'checkmark-circle-outline',
      message: `Building levels were saved to ${target?.name || tag}. Switch to that account to see them.`,
      actions: [{ label: 'OK', primary: true, onPress: () => router.back() }],
    });
  };

  const handleApply = () => {
    if (!result || !player) return;
    if (tagUnattached) {
      show({
        title: 'Account not attached',
        subtitle: 'This export is for a different account',
        icon: 'alert-circle-outline',
        message: `This export is for ${exportTag}, which isn't one of your attached accounts. Levels will be applied to ${player.name} (${player.tag}) instead. Continue?`,
        actions: [
          { label: 'Cancel', onPress: () => { } },
          { label: 'Import to active', primary: true, onPress: () => doApply(player.tag) },
        ],
      });
      return;
    }
    const targetTag = targetAccount?.tag ?? player.tag;
    const forActive = targetAccount === null || targetIsActive;
    show({
      title: 'Import snapshot?',
      subtitle: forActive
        ? `Updating ${player.name}`
        : `Updating ${targetAccount!.name || targetAccount!.tag}`,
      icon: 'download-outline',
      message: forActive
        ? `Set ${totalChanged} building level${totalChanged === 1 ? '' : 's'} for ${player.name}. Existing levels you did not import are kept. Track ${upgradingRows.length} ongoing upgrade(s) separately with completion alerts.`
        : `Set ${totalChanged} building level${totalChanged === 1 ? '' : 's'} for ${targetAccount!.name || targetAccount!.tag} (${targetAccount!.tag}). Track ${upgradingRows.length} ongoing upgrade(s) for this account. Levels are saved to its cache.`,
      actions: [
        { label: 'Cancel', onPress: () => { } },
        { label: 'Apply', primary: true, onPress: () => doApply(targetTag) },
      ],
    });
  };

  // Upgrade rows grouped by village so Home Village and Builder Base upgrades
  // show up as distinct sections in the summary.
  const homeVariants = variantRows.filter((r) => !isBuilderName(r.storeName));
  const builderVariants = variantRows.filter((r) => isBuilderName(r.storeName));

  // Cost label for an upgrade row: when every resource has a bundled icon, show
  // the icons next to the combined cost; otherwise fall back to the text
  // breakdown (or a plain total when the cost is unknown).
  const renderUpgradeCost = (byResource: Record<string, number> | undefined, total: number) => {
    const entries = byResource
      ? (Object.entries(byResource).filter(([, v]) => v > 0) as [string, number][]).filter(
        ([r]) => r !== 'Unknown' && !!PACKAGE_RESOURCE_IMAGES[r],
      )
      : [];
    if (entries.length === 0) {
      return (
        <Text style={styles.upgradeCost} numberOfLines={1}>
          {formatCostBreakdown(byResource) || formatCost(total)}
        </Text>
      );
    }
    return (
      <View style={styles.upgradeResRow}>
        {entries.map(([r]) => (
          <Image key={r} source={PACKAGE_RESOURCE_IMAGES[r]} style={styles.upgradeResIcon} resizeMode="contain" />
        ))}
        <Text style={styles.upgradeCost} numberOfLines={1}>{formatCost(total)}</Text>
      </View>
    );
  };

  const renderVariantList = (rows: typeof variantRows) => (
    <View style={styles.upgradeList}>
      {rows.map((u, i) => (
        <View
          key={u.key}
          style={[
            styles.upgradeRow,
            { backgroundColor: colors.bgCard },
            i === 0 && styles.upgradeRowFirst,
            i === rows.length - 1 && styles.upgradeRowLast,
          ]}
        >
          <BuildingRowIcon storeName={u.storeName} level={u.t} />
          <View style={styles.upgradeText}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {u.displayName}
              {u.count > 1 ? <Text style={styles.rowSub}>{`  ×${u.count}`}</Text> : null}
            </Text>
            <Text style={styles.upgradeSub} numberOfLines={2}>
              Lv {u.c} › Lv {u.t}
            </Text>
          </View>
          <View style={styles.upgradeRight}>
            <Text style={styles.upgradeTime}>{formatTimeShort(u.timeSec)}</Text>
            {renderUpgradeCost(u.byResource, u.cost)}
          </View>
        </View>
      ))}
    </View>
  );

  // Rows-based pipeline breakdown: a time row per village, then a 2-column
  // grid of resource chips like the top card on the maxtime screen. Every row
  // is its own card (xs gaps, sm radius); the first header row and the last
  // resource row get extra outer rounding. Resources reuse the bundled
  // gold/elixir images; compound costs use the goldelxir sprite.
  const renderPipelineSummary = () => {
    const entries = (Object.entries(upgradePipeline!.byResource).filter(([, v]) => v > 0) as [string, number][])
      .filter(([r]) => r !== 'Unknown')
      .sort((a, b) => {
        const ia = RESOURCE_ORDER.indexOf(a[0] as BuildingCostResource);
        const ib = RESOURCE_ORDER.indexOf(b[0] as BuildingCostResource);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    type SummaryRow = {
      key: string;
      icon?: 'header' | 'home' | 'builder';
      label: string;
      desc?: string;
      value: string;
      badge?: boolean;
    };
    const renderTimeChip = (row: SummaryRow, isFirst: boolean) => (
      <View style={[styles.psumCard, isFirst && styles.psumCardFirst]}>
        <View style={[styles.psumIcon, isFirst && styles.psumIconFirst]}>
          {row.icon === 'header' || row.icon === 'builder' ? (
            <Ionicons name="hammer-outline" size={15} color={Colors.textPrimary} />
          ) : (
            <Ionicons name="home-outline" size={15} color={Colors.textPrimary} />
          )}
        </View>
        {row.desc ? (
          <View style={styles.pipelineText}>
            <Text style={styles.pipelineTitle}>{row.label}</Text>
            <Text style={styles.pipelineDesc}>{row.desc}</Text>
          </View>
        ) : (
          <Text style={styles.psumLabel} numberOfLines={1}>{row.label}</Text>
        )}
        {row.badge ? (
          <View style={styles.pipelineBadge}>
            <Text style={styles.pipelineBadgeText}>{row.value}</Text>
          </View>
        ) : (
          <Text style={styles.psumValue}>{row.value}</Text>
        )}
      </View>
    );
    const renderResourceGrid = () => {
      if (entries.length === 0) {
        return (
          <View style={[styles.psumCard, styles.psumCardLast]}>
            <View style={[styles.psumIcon, styles.psumIconLast]}>
              <Ionicons name="cube-outline" size={15} color={Colors.textPrimary} />
            </View>
            <Text style={styles.psumLabel}>Cost</Text>
            <Text style={styles.psumValue}>{formatCost(upgradePipeline!.cost)}</Text>
          </View>
        );
      }
      return (
        <View style={styles.psumGrid}>
          {entries.map(([r, v], index, arr) => {
            const meta = BUILDING_RESOURCE_META[r as BuildingCostResource];
            return (
              <View
                key={r}
                style={[
                  styles.psumCell,
                  ((index === arr.length - 2 && index % 2 === 0) || (index === arr.length - 1 && index % 2 === 0)) && { borderBottomLeftRadius: Radius.xl },
                  index === arr.length - 1 && { borderBottomRightRadius: Radius.xl },
                ]}
              >
                {COMPOUND_RESOURCE_ICONS[r] ? (
                  <Image source={goldElixirImg} style={styles.psumCellIcon} resizeMode="contain" />
                ) : PACKAGE_RESOURCE_IMAGES[r] ? (
                  <Image source={PACKAGE_RESOURCE_IMAGES[r]} style={styles.psumCellIcon} resizeMode="contain" />
                ) : (
                  <Text style={styles.psumIconText} numberOfLines={1}>{meta?.short ?? r}</Text>
                )}
                <Text style={[styles.psumCellValue, { color: meta?.color ?? Colors.textSecondary }]} numberOfLines={1}>
                  {formatCost(v)}
                </Text>
              </View>
            );
          })}
        </View>
      );
    };
    return (
      <View style={styles.psumList}>
        {renderTimeChip(
          {
            key: 'header',
            icon: 'header',
            label: 'Builders',
            desc: 'Buildings upgraded by this import',
            value: formatTime(upgradePipeline!.timeSec),
            badge: true,
          },
          true,
        )}
        {homeVariants.length > 0
          ? renderTimeChip({ key: 'home', icon: 'home', label: `Home Village · ${builderCount} builders`, value: formatTime(upgradePipeline!.homeTime) }, false)
          : null}
        {builderVariants.length > 0
          ? renderTimeChip({ key: 'builder', icon: 'builder', label: `Builder Base · ${builderBaseCount} builders`, value: formatTime(upgradePipeline!.bbTime) }, false)
          : null}
        {renderResourceGrid()}
      </View>
    );
  };

  return (
    <PageScreen title="Import Levels" subtitle="From a Clash of Clans JSON Export" tabBar={false} keyboardAvoiding actions={[<HeaderButton key="back" onPress={() => router.back()} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={24} color={Colors.textPrimary} /></HeaderButton>]}>
      <>


        <View style={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Paste the export</Text>
                <Text style={styles.cardSubtitle}>Home Village and Builder Base buildings and traps are imported</Text>
              </View>
            </View>

            {pastedOk && result ? (
              <View style={[styles.pasteDrop, { height: PASTE_BOX_HEIGHT }]}>
                <Ionicons name="checkmark-circle-outline" size={22} color={Colors.success} />
                <Text style={styles.pasteDropOkTitle}>Export pasted</Text>
                <Text style={styles.pasteDropHint}>
                  Valid JSON · {result.resolved.length} building types ·{' '}
                  {exportTag ?? 'no tag'}
                </Text>
              </View>
            ) : (
              <PressableRipple style={[styles.pasteDrop, { height: PASTE_BOX_HEIGHT }]} onPress={handlePaste}>
                <Ionicons name="clipboard-outline" size={22} color={Colors.textTertiary} />
                <Text style={styles.pasteDropTitle}>Tap to paste</Text>
                <Text style={styles.pasteDropHint}>
                  Reads the export JSON straight off your clipboard. Anything that is not a
                  Clash export is discarded.
                </Text>
              </PressableRipple>
            )}

            <View style={styles.btnRow}>
              <PressableRipple
                style={[styles.pasteActionBtn, hasPasted ? styles.pasteActionGhost : styles.pasteActionPrimary]}
                onPress={handlePaste}
              >
                <Ionicons
                  name="clipboard-outline"
                  size={16}
                  color={hasPasted ? Colors.textSecondary : Colors.bg}
                />
                <Text style={hasPasted ? styles.ghostBtnText : styles.parseBtnText}>
                  {hasPasted ? 'Paste again' : 'Paste'}
                </Text>
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
              {hasBuildingChanges ? (
                <>
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
                    { key: 'matched', icon: 'checkmark-done-outline' as const, label: 'Copies to upgrade', value: `${totalChanged} in ${upgradeRows.length} building${upgradeRows.length === 1 ? '' : 's'}` },
                    {
                      key: 'huts',
                      icon: 'hammer-outline' as const,
                      label: 'Builder huts',
                      value: detectedHuts === null
                        ? 'Not in export'
                        : detectedHuts === builderCount
                          ? buildersVerified
                            ? `${detectedHuts} (verified)`
                            : `${detectedHuts} (verifies on apply)`
                          : `${detectedHuts} — sets builders to ${detectedHuts}`,
                      warning: detectedHuts !== null && detectedHuts !== builderCount,
                    },
                    ...(showCrafted
                      ? [{
                        key: 'crafted',
                        icon: 'shield-half-outline' as const,
                        label: 'Crafted defenses',
                        // Counts what an apply would actually save, so the number here
                        // always matches the rows below it.
                        value: `${craftedPayloadCount} detected`,
                        warning: craftedPayloadCount < craftedDefs.length,
                      }]
                      : []),
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
                </>
              ) : (
                <View style={styles.upToDateCard}>
                  <Ionicons name="checkmark-circle-outline" size={22} color={Colors.textTertiary} />
                  <Text style={styles.upToDateTitle}>Already up to date</Text>
                  <Text style={styles.upToDateText}>
                    Every building in this export already matches {player?.name ?? 'this account'}, so
                    there is nothing to apply.
                  </Text>
                </View>
              )}

              {showCrafted ? (
                <>
                  <Text style={styles.sectionTitle}>Crafted defenses in export</Text>
                  <View style={styles.rows}>
                    {craftedRows.map((row, ri) => (
                      <View
                        key={row.name}
                        style={[
                          styles.row,
                          ri === 0 && styles.rowFirst,
                          ri === craftedRows.length - 1 && styles.rowLast,
                          ri < craftedRows.length - 1 && styles.rowBorder,
                        ]}
                      >
                        <Ionicons name="shield-half-outline" size={15} color={Colors.textSecondary} />
                        <Text style={styles.rowLabel} numberOfLines={1}>
                          {row.name}
                          <Text style={styles.rowSub}>{`  ·  Lv ${row.effectiveLevel}`}</Text>
                        </Text>
                        <Text
                          style={[styles.rowAfter, !row.known && { color: Colors.textMuted }]}
                          numberOfLines={1}
                        >
                          {row.known
                            ? row.modules
                                .map((m) => (m.max ? `${m.level}/${m.max}` : String(m.level)))
                                .join('  ·  ')
                            : 'unknown data'}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.sectionHint}>
                    Each module is upgraded on its own; the level shown is their sum, which is what the
                    game displays.
                  </Text>
                </>
              ) : null}

              <View style={styles.actionRow}>
                {hasBuildingChanges ? (
                  <PressableRipple
                    style={[styles.refreshBtn, refreshing && styles.refreshBtnDisabled]}
                    onPress={handleRefreshProfile}
                    disabled={refreshing}
                  >
                    <Ionicons
                      name={refreshing ? 'sync-outline' : 'cloud-download-outline'}
                      size={16}
                      color={Colors.textSecondary}
                    />
                    <Text style={styles.refreshBtnText} numberOfLines={1}>
                      {refreshing ? 'Refreshing' : 'Refresh'}
                    </Text>
                  </PressableRipple>
                ) : null}
                <PressableRipple
                  style={[styles.applyBtn, styles.applyBtnFlex, !canApply && styles.applyBtnDisabled]}
                  onPress={handleApply}
                  disabled={!canApply}
                >
                  <Text style={styles.applyBtnText} numberOfLines={1}>
                    {!player ? 'Waiting for account…' : 'Import snapshot'}
                  </Text>
                </PressableRipple>
              </View>

              {upgradingRows.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Upgrading now</Text>
                  <View style={styles.upgradeList}>
                    {upgradingRows.map((u, i) => (
                      <View
                        key={u.id}
                        style={[
                          styles.upgradeRow,
                          { backgroundColor: colors.bgCard },
                          i === 0 && styles.upgradeRowFirst,
                        ]}
                      >
                        {u.kind === 'buildings' ? <BuildingRowIcon storeName={u.storeName} level={u.level} /> : <Image source={getArmyItemImage(u.name, null) ?? undefined} style={styles.levelIcon} resizeMode="contain" />}
                        <View style={styles.upgradeText}>
                          <Text style={styles.rowLabel} numberOfLines={1}>
                            {u.displayName}
                            {u.copies > 1 ? <Text style={styles.rowSub}>{`  ×${u.copies}`}</Text> : null}
                          </Text>
                          <Text style={styles.upgradeSub} numberOfLines={2}>
                            Lv {u.level} › Lv {u.level + 1} · {u.remainingSec > 0 ? `${formatTimeShort(u.remainingSec)} left` : 'Ready to confirm'}
                          </Text>
                        </View>
                        <View style={styles.upgradeRight}>
                          <Text style={[styles.upgradeTime, { color: Colors.warning }]}>{u.remainingSec > 0 ? 'in progress' : 'completed'}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.rowSub}>Ongoing upgrades keep their current level and appear below Backlog with completion alerts.</Text>
                </>
              ) : null}

              {upgradePipeline ? (
                <>
                  <Text style={styles.sectionTitle}>Builders pipeline</Text>
                  {renderPipelineSummary()}
                  <Text style={styles.sectionTitle}>Upgrades</Text>
                  {homeVariants.length > 0 ? (
                    <>
                      <Text style={styles.sectionSubtitle}>Home Village</Text>
                      {renderVariantList(homeVariants)}
                    </>
                  ) : null}
                  {builderVariants.length > 0 ? (
                    <>
                      <Text style={styles.sectionSubtitle}>Builder Base</Text>
                      {renderVariantList(builderVariants)}
                    </>
                  ) : null}
                </>
              ) : null}

              {result.unresolved.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Unknown building IDs</Text>
                  <Text style={styles.sectionHint}>
                    These IDs are not in the app{"'"}s data package and will be ignored.
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

              {result.skipped.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Not tracked by the app</Text>
                  <Text style={styles.sectionHint}>
                    Town Hall and similar entities are skipped because the app reads those from the API.
                  </Text>
                  <View style={styles.upgradeList}>
                    {result.skipped.map((item, i) => (
                      <View
                        key={item.storeName}
                        style={[
                          styles.upgradeRow,
                          { backgroundColor: colors.bgCard },
                          i === 0 && styles.upgradeRowFirst,
                          i === result.skipped.length - 1 && styles.upgradeRowLast,
                        ]}
                      >
                        {item.storeName === 'Town Hall' && player
                          ? (playerThImage ? (
                            <Image source={playerThImage} style={styles.levelIcon} resizeMode="contain" />
                          ) : (
                            <View style={styles.levelIconBox}>
                              <Ionicons name="business-outline" size={16} color={Colors.textTertiary} />
                            </View>
                          ))
                          : <BuildingRowIcon storeName={item.storeName} level={item.level} />}
                        <View style={styles.upgradeText}>
                          <Text style={styles.rowLabel} numberOfLines={1}>{item.displayName}</Text>
                          <Text style={styles.upgradeSub}>Lv {item.level} · ×{item.copies}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </>
      <Dialog />
    </PageScreen>
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
      // Without this the title's tight lineHeight leaves the subtitle crowding
      // up against it.
      marginTop: Spacing.xs,
    },
  pasteDrop: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  pasteDropTitle: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  pasteDropHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
  pasteDropOkTitle: {
    ...Typography.subhead,
    color: Colors.success,
    fontWeight: '700',
  },
  // One layout for both paste/parse states so swapping primary only repaints
  // them. Sharing ghostBtn/parseBtn directly reshaped the buttons, since those
  // differ in flex and horizontal padding as well as colour.
  pasteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 0.75,
  },
  pasteActionPrimary: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  pasteActionGhost: {
    backgroundColor: 'transparent',
    borderColor: Colors.border,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
// Refresh sits beside Apply rather than up by the paste box: both act on the
    // parsed preview, so they belong together at the point of applying.
    actionRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.base,
      borderRadius: Radius.md,
      borderWidth: 0.75,
      borderColor: Colors.border,
    },
    refreshBtnDisabled: {
      opacity: 0.5,
    },
    refreshBtnText: {
      ...Typography.subhead,
      color: Colors.textSecondary,
      fontWeight: '500',
    },
    ghostBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
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
  // Dashed frame reads as "nothing here" rather than another populated card.
  // Same 1px dashed rule the header buttons and troop grids use: 0.75 packs the
  // dashes so tightly it looks solid, and Android drops them below 1.
  upToDateCard: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  upToDateTitle: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  upToDateText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
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
  sectionSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
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
  rowSub: {
    ...Typography.subhead,
    color: Colors.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
  psumList: {
    gap: Spacing.xs,
  },
  psumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  psumCardFirst: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  psumCardLast: {
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  psumIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  psumIconFirst: {
    borderTopLeftRadius: Radius.lg,
  },
  psumIconLast: {
    borderBottomLeftRadius: Radius.lg,
  },
  psumResImg: {
    width: 22,
    height: 22,
  },
  psumIconText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textTertiary,
    paddingHorizontal: 2,
  },
  psumLabel: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  psumValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  psumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'space-between',
  },
  psumCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    minWidth: '48%',
    flex: 1,
  },
  psumCellIcon: {
    width: 22,
    height: 22,
    marginRight: Spacing.md,
  },
  psumCellValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
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
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.sm,
    marginTop: -2,
  },
  doneCheck: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    flex: 1,
    ...Typography.subhead,
    color: Colors.textPrimary,
  },
  upgradeTime: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  upgradeResRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  upgradeResIcon: {
    width: 12,
    height: 12,
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
      justifyContent: 'center',
      paddingVertical: Spacing.md,
      marginTop: Spacing.xs,
      borderRadius: Radius.md,
      backgroundColor: Colors.textPrimary,
    },
    // Row variant: marginTop comes from actionRow's gap, so it drops out here.
    applyBtnFlex: {
      flex: 1,
      marginTop: 0,
      paddingHorizontal: Spacing.sm,
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