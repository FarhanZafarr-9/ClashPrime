import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClashArmy, ClashArmyUnit, ClashArmyEquipment, ClashArmyPet, ClashArmyGuide, UnitDef, EquipmentDef, PetDef } from '../types/armies';

const LIST_URL = 'https://clasharmies.com/armies/popular/__data.json';
const CACHE_PREFIX = 'clasharmies_v1_';
const CACHE_TTL_MS = 30 * 60 * 1000;
const DEFS_CACHE_KEY = 'clasharmies_defs';

function resolve(data: any[], idx: number): any {
  const v = data[idx];
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((e) => (typeof e === 'number' && e < data.length ? resolve(data, e) : e));
  const obj: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) {
    obj[k] = typeof val === 'number' && val < data.length ? resolve(data, val) : val;
  }
  return obj;
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ClashPrime/1.0', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`ClashArmies fetch failed: ${res.status}`);
  return await res.json();
}

function parseDefinitions(data: any[]): { unitsById: Map<number, UnitDef>; equipmentById: Map<number, EquipmentDef>; petsById: Map<number, PetDef> } {
  const unitsById = new Map<number, UnitDef>();
  const equipmentById = new Map<number, EquipmentDef>();
  const petsById = new Map<number, PetDef>();

  const header = data[0];
  if (!header || typeof header !== 'object') return { unitsById, equipmentById, petsById };

  const unitsIdx: number = (header as any).units ?? -1;
  const equipmentIdx: number = (header as any).equipment ?? -1;
  const petsIdx: number = (header as any).pets ?? -1;

  if (unitsIdx > 0) {
    const unitIndices: number[] = data[unitsIdx];
    if (Array.isArray(unitIndices)) {
      for (const idx of unitIndices) {
        const raw = resolve(data, idx);
        if (!raw || !raw.name) break;
        unitsById.set(raw.id, {
          id: raw.id,
          clashId: raw.clashId ?? raw.id,
          type: raw.type === 'Siege' ? 'Siege' : raw.type === 'Spell' ? 'Spell' : 'Troop',
          name: raw.name,
          housingSpace: raw.housingSpace ?? 0,
          productionBuilding: raw.productionBuilding ?? '',
          isSuper: !!raw.isSuper,
          isFlying: !!raw.isFlying,
        });
      }
    }
  }

  if (equipmentIdx > 0) {
    const equipIndices: number[] = data[equipmentIdx];
    if (Array.isArray(equipIndices)) {
      for (const idx of equipIndices) {
        const raw = resolve(data, idx);
        if (!raw || !raw.name) break;
        equipmentById.set(raw.id, {
          id: raw.id,
          hero: raw.hero,
          name: raw.name,
          epic: !!raw.epic,
        });
      }
    }
  }

  if (petsIdx > 0) {
    const petIndices: number[] = data[petsIdx];
    if (Array.isArray(petIndices)) {
      for (const idx of petIndices) {
        const raw = resolve(data, idx);
        if (!raw || !raw.name) break;
        petsById.set(raw.id, {
          id: raw.id,
          name: raw.name,
        });
      }
    }
  }

  return { unitsById, equipmentById, petsById };
}

function resolveArmy(data: any[], armyIdx: number): ClashArmy {
  const raw = resolve(data, armyIdx);
  const units: ClashArmyUnit[] = (raw.units || []).map((u: any) => ({
    home: u.home === 'clanCastle' ? 'clanCastle' : 'armyCamp',
    unitId: u.unitId,
    amount: u.amount || 0,
  }));
  const equipment: ClashArmyEquipment[] = (raw.equipment || []).map((e: any) => ({
    equipmentId: e.equipmentId,
  }));
  const pets: ClashArmyPet[] = (raw.pets || []).map((p: any) => ({
    hero: p.hero || '',
    petId: p.petId,
  }));
  let guide: ClashArmyGuide | null = null;
  if (raw.guide) {
    guide = {
      textContent: raw.guide.textContent || '',
      youtubeUrl: raw.guide.youtubeUrl || null,
    };
  }
  return {
    id: raw.id ?? 0,
    name: raw.name ?? 'Unknown',
    townHall: raw.townHall ?? 16,
    banner: raw.banner ?? '',
    createdBy: raw.createdBy ?? '',
    username: raw.username ?? '',
    score: raw.score ?? 0,
    votes: raw.votes ?? 0,
    pageViews: raw.pageViews ?? 0,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    units,
    equipment,
    pets,
    guide,
    shareLink: raw.shareLink || raw.copyLink || null,
    createdTime: raw.createdTime ?? '',
    updatedTime: raw.updatedTime ?? '',
  };
}

export async function getPopularArmies(bypassCache?: boolean): Promise<{ armies: ClashArmy[]; unitsById: Map<number, UnitDef> }> {
  const cacheKey = `${CACHE_PREFIX}list`;
  if (!bypassCache) {
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      const defsRaw = await AsyncStorage.getItem(DEFS_CACHE_KEY);
      if (raw && defsRaw) {
        const entry = JSON.parse(raw);
        if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
          const cachedDefs = await getCachedDefs();
          if (cachedDefs.unitsById.size > 0) {
            return { armies: entry.armies, unitsById: cachedDefs.unitsById };
          }
        }
      }
    } catch {}
  }

  const json = await fetchJson(LIST_URL);
  const nodes: any[] = json.nodes || [];

  const defsNode = nodes.find((n: any) => n?.type === 'data' && Array.isArray(n.data) && n.data[0]?.units !== undefined);
  const armiesNode = nodes.find((n: any) => n?.type === 'data' && Array.isArray(n.data) && n.data[0]?.armies !== undefined);

  if (!defsNode || !armiesNode) throw new Error('ClashArmies: unexpected response structure');

  const defsData = defsNode.data;
  const armiesData = armiesNode.data;

  const defs = parseDefinitions(defsData);
  try {
    await AsyncStorage.setItem(DEFS_CACHE_KEY, JSON.stringify({
      unitsById: [...defs.unitsById.entries()],
      equipmentById: [...defs.equipmentById.entries()],
      petsById: [...defs.petsById.entries()],
    }));
  } catch {}

  const header = armiesData[0];
  const armiesArrIdx: number = (header as any).armies ?? -1;
  if (armiesArrIdx < 0) return { armies: [], unitsById: defs.unitsById };

  const armyIndices: number[] = armiesData[armiesArrIdx];
  if (!Array.isArray(armyIndices)) return { armies: [], unitsById: defs.unitsById };

  const armies: ClashArmy[] = [];
  for (const idx of armyIndices) {
    const raw = resolve(armiesData, idx);
    if (!raw || !raw.name) continue;
    armies.push(resolveArmy(armiesData, idx));
  }

  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ armies, timestamp: Date.now() }));
  } catch {}

  return { armies, unitsById: defs.unitsById };
}

export async function getCachedDefs(): Promise<{ unitsById: Map<number, UnitDef>; equipmentById: Map<number, EquipmentDef>; petsById: Map<number, PetDef> }> {
  const raw = await AsyncStorage.getItem(DEFS_CACHE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    return {
      unitsById: new Map(parsed.unitsById),
      equipmentById: new Map(parsed.equipmentById),
      petsById: new Map(parsed.petsById),
    };
  }
  return { unitsById: new Map(), equipmentById: new Map(), petsById: new Map() };
}
