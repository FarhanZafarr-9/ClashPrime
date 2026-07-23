import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import type { ScopeDiscount } from '../hooks/useDiscounts';

interface DiscountModalProps {
  visible: boolean;
  onClose: () => void;
  scope: 'buildings' | 'army';
  buildings: ScopeDiscount;
  army: ScopeDiscount;
  onBuildingCostChange: (pct: number) => void;
  onBuildingTimeChange: (pct: number) => void;
  onArmyCostChange: (pct: number) => void;
  onArmyTimeChange: (pct: number) => void;
  onReset: () => void;
}

const PRESETS = [0, 10, 20, 30, 40, 50];

function DiscountSlider({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  onChange: (pct: number) => void;
}) {
  const [customText, setCustomText] = useState('');
  const multiplier = value && !isNaN(value) ? ((100 - value) / 100).toFixed(2) : '1.00';
  const active = value > 0;

  const handleCustom = () => {
    const parsed = parseInt(customText, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      onChange(parsed);
    }
    setCustomText('');
  };

  return (
    <View style={styles.sliderSection}>
      <View style={styles.sliderHeader}>
        <View style={styles.sliderLabelRow}>
          <Ionicons name={icon as any} size={16} color={Colors.textSecondary} />
          <Text style={styles.sliderLabel}>{label}</Text>
        </View>
        <Text style={[styles.sliderValue, active && styles.sliderValueActive]}>{!value || isNaN(value) ? 'Off' : `${value}%`}</Text>
      </View>

      <View style={styles.pillRow}>
        {PRESETS.map((p) => {
          const isActive = value === p;
          return (
            <Pressable
              key={p}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onChange(p)}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {p === 0 ? 'Off' : `-${p}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          placeholder="Custom %"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          value={customText}
          onChangeText={setCustomText}
          onSubmitEditing={handleCustom}
          returnKeyType="done"
          maxLength={3}
        />
        <Pressable style={styles.customApply} onPress={handleCustom}>
          <Ionicons name="arrow-forward" size={14} color={Colors.bg} />
        </Pressable>
      </View>

      {value > 0 && (
        <View style={styles.multiplierRow}>
          <View style={styles.multiplierBadge}>
            <Text style={styles.multiplierText}>×{multiplier}</Text>
          </View>
          <Text style={styles.multiplierHint}>multiplier ×{multiplier}</Text>
        </View>
      )}
    </View>
  );
}

export default function DiscountModal({
  visible,
  onClose,
  scope,
  buildings,
  army,
  onBuildingCostChange,
  onBuildingTimeChange,
  onArmyCostChange,
  onArmyTimeChange,
  onReset,
}: DiscountModalProps) {
  const scopeDiscount = scope === 'buildings' ? buildings : army;
  const anyActive = scopeDiscount.costPercent > 0 || scopeDiscount.timePercent > 0;

  function pctLabel(v: number) { return v === 0 ? 'Off' : `-${v}%`; }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardIcon}>
                <Ionicons name="pricetag-outline" size={18} color={Colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.cardTitle}>Discounts</Text>
                <Text style={styles.cardSubtitle}>
                  {scope === 'buildings' ? 'Building upgrades' : 'Army research'}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={Colors.textTertiary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            <Text style={styles.scopeLabel}>{scope === 'buildings' ? 'Buildings' : 'Army'}</Text>
            <DiscountSlider
              label="Cost Reduction"
              icon="cash-outline"
              value={scopeDiscount.costPercent}
              onChange={scope === 'buildings' ? onBuildingCostChange : onArmyCostChange}
            />
            <View style={styles.divider} />
            <DiscountSlider
              label="Time Reduction"
              icon="time-outline"
              value={scopeDiscount.timePercent}
              onChange={scope === 'buildings' ? onBuildingTimeChange : onArmyTimeChange}
            />

            {anyActive && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>Cost</Text>
                  <Text style={styles.summaryValue}>{pctLabel(scopeDiscount.costPercent)}</Text>
                </View>
                <Ionicons name="close-outline" size={14} color={Colors.textMuted} />
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>Time</Text>
                  <Text style={styles.summaryValue}>{pctLabel(scopeDiscount.timePercent)}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <Pressable style={styles.resetBtn} onPress={onReset}>
            <Ionicons name="refresh-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.resetText}>Reset to defaults</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  card: {
    width: '88%',
    maxHeight: '80%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardIcon: {
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
  },
  cardSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  scopeLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },
  sliderSection: {
    gap: Spacing.sm,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sliderLabel: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  sliderValue: {
    ...Typography.title2,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  sliderValueActive: {
    color: Colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontSize: 11,
  },
  pillTextActive: {
    color: Colors.bg,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  customInput: {
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    width: 96,
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  customApply: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  multiplierBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  multiplierText: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  multiplierHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.lg,
    flexWrap: 'wrap',
  },
  summaryBlock: {
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '500',
    fontSize: 10,
  },
  summaryValue: {
    ...Typography.title3,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontSize: 16,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resetText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});