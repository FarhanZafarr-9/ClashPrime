import type { ClashArmyUnit, UnitDef } from '../types/armies';

export function buildCopyArmyLink(units: ClashArmyUnit[], unitsById: Map<number, UnitDef>): string {
  const campTroops = units.filter((u) => u.home === 'armyCamp' && unitsById.get(u.unitId)?.type !== 'Spell');
  const campSpells = units.filter((u) => u.home === 'armyCamp' && unitsById.get(u.unitId)?.type === 'Spell');
  const ccTroops = units.filter((u) => u.home === 'clanCastle' && unitsById.get(u.unitId)?.type !== 'Spell');
  const ccSpells = units.filter((u) => u.home === 'clanCastle' && unitsById.get(u.unitId)?.type === 'Spell');
  const toStr = (list: ClashArmyUnit[]) => list.map((u) => {
    const def = unitsById.get(u.unitId);
    return def ? `${u.amount}x${def.clashId}` : null;
  }).filter(Boolean).join('-');
  let link = 'https://link.clashofclans.com/en?action=CopyArmy&army=';
  if (ccTroops.length) link += `i${toStr(ccTroops)}`;
  if (ccSpells.length) link += `d${toStr(ccSpells)}`;
  link += `u${toStr(campTroops)}`;
  link += `s${toStr(campSpells)}`;
  return link;
}
