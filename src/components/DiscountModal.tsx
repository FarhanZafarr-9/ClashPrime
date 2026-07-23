import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { Discounts } from '../hooks/useDiscounts';

interface DiscountModalProps {
  visible: boolean;
  onClose: () => void;
  discounts: Discounts;
  onCostChange: (pct: number) => void;
  onTimeChange: (pct: number) => void;
  onReset: () => void;
}

const PRESETS = [0, 10, 20, 30, 40, 50];

function DiscountSlider({
  label,
  icon,
  value,
  onChange,
  color,
}: {
  label: string;
  icon: string;
  value: number;
  onChange: (pct: number) => void;
  color: string;
}) {
  const multiplier = ((100 - value) / 100).toFixed(2);
  return (
    <View style={styles.sliderSection}>
      <View style={styles.sliderHeader}>
        <View style={styles.sliderLabelRow}>
          <Ionicons name={icon as any} size={16} color={color} />
          <Text style={styles.sliderLabel}>{label}</Text>
        </View>
        <Text style={[styles.sliderValue, { color }]}>{value}%</Text>
      </View>

      <View style={styles.pillRow}>
        {PRESETS.map((p) => {
          const isActive = value === p;
          return (
            <Pressable
              key={p}
              style={[styles.pill, isActive && { backgroundColor: color, borderColor: color }]}
              onPress={() => onChange(p)}
            >
              <Text style={[styles.pillText, isActive && { color: Colors.bg }]}>
                {p === 0 ? 'Off' : `-${p}%`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value > 0 && (
        <View style={styles.multiplierRow}>
          <View style={[styles.multiplierBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.multiplierText, { color }]}>×{multiplier}</Text>
          </View>
          <Text style={styles.multiplierHint}>
            {icon === 'cash-outline' ? 'Building & research costs' : 'Build & upgrade times'} ×{multiplier}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function DiscountModal({
  visible,
  onClose,
  discounts,
  onCostChange,
  onTimeChange,
  onReset,
}: DiscountModalProps) {
  const anyActive = discounts.costPercent > 0 || discounts.timePercent > 0;

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
                  Apply reductions to costs & upgrade times
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={Colors.textTertiary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            <View style={styles.scopeNote}>
              <Ionicons name="information-circle-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.scopeNoteText}>
                Applies to all building upgrades and troop/hero research costs & times
              </Text>
            </View>

            <DiscountSlider
              label="Cost Reduction"
              icon="cash-outline"
              value={discounts.costPercent}
              onChange={onCostChange}
              color={Colors.warning}
            />

            <View style={styles.divider} />

            <DiscountSlider
              label="Time Reduction"
              icon="time-outline"
              value={discounts.timePercent}
              onChange={onTimeChange}
              color="#6EB8FF"
            />

            {anyActive && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>Cost</Text>
                  <Text style={[styles.summaryValue, { color: Colors.warning }]}>
                    -{discounts.costPercent}%
                  </Text>
                </View>
                <Ionicons name="close-outline" size={14} color={Colors.textMuted} />
                <View style={styles.summaryBlock}>
                  <Text style={styles.summaryLabel}>Time</Text>
                  <Text style={[styles.summaryValue, { color: '#6EB8FF' }]}>
                    -{discounts.timePercent}%
                  </Text>
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
  scopeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.sm,
  },
  scopeNoteText: {
    ...Typography.caption,
    color: Colors.textMuted,
    flex: 1,
    fontSize: 10,
  },
  sliderSection: {
    gap: Spacing.md,
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
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.textSecondary,
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
  },
  multiplierText: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  multiplierHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.lg,
  },
  summaryBlock: {
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  summaryValue: {
    ...Typography.title3,
    fontWeight: '700',
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
