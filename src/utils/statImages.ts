// Spell stat icons, keyed by the stat they label. These are the real game glyphs
// for the columns, which read better at 11px than generic Ionicons, so the pill
// row prefers them and falls back to an icon only for stats with no asset
// (spell type, donation cost).

export const SPELL_STAT_ICONS = {
  damageType: require('../../images/spells/Damagetype.webp'),
  damageRadius: require('../../images/spells/DamageRadius.webp'),
  duration: require('../../images/spells/Duration.webp'),
  housingSpace: require('../../images/spells/HousingSpace.webp'),
  target: require('../../images/spells/Target.webp'),
} as const;

export type SpellStatIconName = keyof typeof SPELL_STAT_ICONS;
