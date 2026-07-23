import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { ArmyCard } from '../../src/components/ArmyCard';
import { getPopularArmies } from '../../src/api/clashArmies';
import {
  getSavedBases,
  getFavorites,
  removeBase,
  toggleFavorite as toggleBaseFavorite,
} from '../../src/hooks/usePlayer';
import type { SavedBase } from '../../src/hooks/usePlayer';
import type { ClashArmy, UnitDef, EquipmentDef, PetDef } from '../../src/types/armies';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_ARMIES_KEY = 'clashprime_saved_armies';
const ARMY_FAVORITES_KEY = 'clashprime_army_favorites';

interface SavedArmy {
  id: string;
  name: string;
  townHallLevel: number;
  username: string;
  score: number;
  copiedAt: string;
}

async function getSavedArmies(): Promise<SavedArmy[]> {
  const raw = await AsyncStorage.getItem(SAVED_ARMIES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function removeSavedArmy(id: string): Promise<void> {
  const list = await getSavedArmies();
  await AsyncStorage.setItem(SAVED_ARMIES_KEY, JSON.stringify(list.filter((b) => b.id !== id)));
}

async function getArmyFavorites(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(ARMY_FAVORITES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function toggleArmyFavorite(id: string): Promise<boolean> {
  const favs = await getArmyFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) { favs.splice(idx, 1); await AsyncStorage.setItem(ARMY_FAVORITES_KEY, JSON.stringify(favs)); return false; }
  else { favs.push(id); await AsyncStorage.setItem(ARMY_FAVORITES_KEY, JSON.stringify(favs)); return true; }
}

async function saveArmy(army: { id: string; name: string; townHallLevel: number; username: string; score: number }): Promise<void> {
  const list = await getSavedArmies();
  const existing = list.findIndex((b) => b.id === army.id);
  if (existing >= 0) list[existing] = { ...army, copiedAt: new Date().toISOString() };
  else list.unshift({ ...army, copiedAt: new Date().toISOString() });
  await AsyncStorage.setItem(SAVED_ARMIES_KEY, JSON.stringify(list));
}

type Section = {
  title: string;
  type: 'base' | 'army';
  data: any[];
};

export default function SavedScreen() {
  const [savedBases, setSavedBases] = useState<SavedBase[]>([]);
  const [baseFavorites, setBaseFavorites] = useState<Set<string>>(new Set());
  const [savedArmies, setSavedArmies] = useState<SavedArmy[]>([]);
  const [armyFavorites, setArmyFavorites] = useState<Set<string>>(new Set());
  const [armies, setArmies] = useState<ClashArmy[]>([]);
  const [unitsById, setUnitsById] = useState<Map<number, UnitDef>>(new Map());
  const [equipmentById, setEquipmentById] = useState<Map<number, EquipmentDef>>(new Map());
  const [petsById, setPetsById] = useState<Map<number, PetDef>>(new Map());

  const loadData = useCallback(async () => {
    const [saved, favs, sArmies, aFavs] = await Promise.all([
      getSavedBases(),
      getFavorites(),
      getSavedArmies(),
      getArmyFavorites(),
    ]);
    setSavedBases(saved);
    setBaseFavorites(new Set(favs));
    setSavedArmies(sArmies);
    setArmyFavorites(new Set(aFavs));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    (async () => {
      try {
        const { armies: list, unitsById: defs, equipmentById: eqDefs, petsById: pDefs } = await getPopularArmies();
        setArmies(list);
        if (defs.size > 0) setUnitsById(defs);
        if (eqDefs.size > 0) setEquipmentById(eqDefs);
        if (pDefs.size > 0) setPetsById(pDefs);
      } catch {}
    })();
  }, []);

  const favoriteBases = Array.from(baseFavorites);

  const sections: Section[] = [];

  if (savedBases.length > 0) {
    sections.push({
      title: `Saved Bases (${savedBases.length})`,
      type: 'base',
      data: savedBases,
    });
  }

  if (favoriteBases.length > 0) {
    const favBaseData = favoriteBases
      .map((id) => savedBases.find((b) => b.id === id))
      .filter(Boolean) as SavedBase[];
    if (favBaseData.length > 0) {
      sections.push({
        title: `Favorite Bases (${favBaseData.length})`,
        type: 'base',
        data: favBaseData,
      });
    }
  }

  if (savedArmies.length > 0) {
    sections.push({
      title: `Saved Armies (${savedArmies.length})`,
      type: 'army',
      data: savedArmies,
    });
  }

  if (armyFavorites.size > 0) {
    const favArmies = armies.filter((a) => armyFavorites.has(String(a.id)));
    if (favArmies.length > 0) {
      sections.push({
        title: `Favorite Armies (${favArmies.length})`,
        type: 'army',
        data: favArmies,
      });
    }
  }

  const handleRemoveBase = async (id: string) => {
    await removeBase(id);
    loadData();
  };

  const handleToggleBaseFav = async (id: string) => {
    await toggleBaseFavorite(id);
    loadData();
  };

  const handleRemoveSavedArmy = async (id: string) => {
    await removeSavedArmy(id);
    loadData();
  };

  const handleToggleArmyFav = async (id: number) => {
    await toggleArmyFavorite(String(id));
    loadData();
  };

  const handleCopyArmy = (army: ClashArmy) => {
    const campTroops = army.units.filter((u) => u.home === 'armyCamp' && unitsById.get(u.unitId)?.type !== 'Spell');
    const campSpells = army.units.filter((u) => u.home === 'armyCamp' && unitsById.get(u.unitId)?.type === 'Spell');
    const ccTroops = army.units.filter((u) => u.home === 'clanCastle' && unitsById.get(u.unitId)?.type !== 'Spell');
    const ccSpells = army.units.filter((u) => u.home === 'clanCastle' && unitsById.get(u.unitId)?.type === 'Spell');
    const toStr = (list: typeof army.units) => list.map((u) => {
      const def = unitsById.get(u.unitId);
      return def ? `${u.amount}x${def.clashId}` : null;
    }).filter(Boolean).join('-');
    let link = 'https://link.clashofclans.com/en?action=CopyArmy&army=';
    if (ccTroops.length) link += `i${toStr(ccTroops)}`;
    if (ccSpells.length) link += `d${toStr(ccSpells)}`;
    link += `u${toStr(campTroops)}`;
    link += `s${toStr(campSpells)}`;
    Linking.openURL(link);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved & Favorites</Text>
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyDesc}>Save bases and armies to find them here quickly.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.data.map((item: any) => {
                if (section.type === 'base') {
                  const base = item as SavedBase;
                  return (
                    <View key={base.id} style={styles.savedItem}>
                      <View style={styles.itemIcon}>
                        <Text style={styles.itemIconText}>TH{base.townHallLevel}</Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>{base.name}</Text>
                        <Text style={styles.itemMeta}>
                          {base.category} · {base.rating}★
                        </Text>
                      </View>
                      <View style={styles.itemActions}>
                        <Pressable onPress={() => handleToggleBaseFav(base.id)} hitSlop={10} style={styles.actionBtn}>
                          <Ionicons
                            name={baseFavorites.has(base.id) ? 'heart' : 'heart-outline'}
                            size={16}
                            color={baseFavorites.has(base.id) ? Colors.textPrimary : Colors.textTertiary}
                          />
                        </Pressable>
                        <Pressable onPress={() => handleRemoveBase(base.id)} hitSlop={10} style={styles.actionBtn}>
                          <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
                        </Pressable>
                      </View>
                    </View>
                  );
                }
                if ('townHall' in item) {
                  const army = item as ClashArmy;
                  const isFav = armyFavorites.has(String(army.id));
                  const isSaved = savedArmies.some((s) => s.id === String(army.id));
                  return (
                    <ArmyCard
                      key={army.id}
                      army={army}
                      unitsById={unitsById}
                      equipmentById={equipmentById}
                      petsById={petsById}
                      isFavorite={isFav}
                      isSaved={isSaved}
                      onFavorite={() => handleToggleArmyFav(army.id)}
                      onSave={() => {
                        if (isSaved) handleRemoveSavedArmy(String(army.id));
                        else saveArmy({ id: String(army.id), name: army.name, townHallLevel: army.townHall, username: army.username, score: army.score }).then(loadData);
                      }}
                      onCopy={() => handleCopyArmy(army)}
                    />
                  );
                }
                const savedArmy = item as SavedArmy;
                const isFav = armyFavorites.has(savedArmy.id);
                return (
                  <View key={savedArmy.id} style={styles.savedItem}>
                    <View style={styles.itemIcon}>
                      <Ionicons name="shield-half-outline" size={18} color={Colors.textSecondary} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>{savedArmy.name}</Text>
                      <Text style={styles.itemMeta}>
                        TH{savedArmy.townHallLevel} · by {savedArmy.username} · {savedArmy.score} pts
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
                      <Pressable onPress={() => handleToggleArmyFav(Number(savedArmy.id))} hitSlop={10} style={styles.actionBtn}>
                        <Ionicons
                          name={isFav ? 'heart' : 'heart-outline'}
                          size={16}
                          color={isFav ? Colors.textPrimary : Colors.textTertiary}
                        />
                      </Pressable>
                      <Pressable onPress={() => handleRemoveSavedArmy(savedArmy.id)} hitSlop={10} style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingBottom: 80,
  },
  emptyTitle: {
    ...Typography.title2,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyDesc: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 260,
  },
  list: {
    paddingHorizontal: Spacing.base,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  itemIconText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  itemMeta: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  actionBtn: {
    padding: 4,
  },
});
