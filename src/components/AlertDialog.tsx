import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, type ImageSourcePropType } from 'react-native';
import PressableRipple from './PressableRipple';
import BottomSheet from './BottomSheet';
import type { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface DialogAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  primary?: boolean;
}

interface DialogConfig {
  title: string;
  subtitle?: string;
  /** Optional header glyph. Dialogs rendered without one read as bare text. */
  icon?: keyof typeof Ionicons.glyphMap;
  iconSource?: ImageSourcePropType;
  message?: React.ReactNode;
  actions: DialogAction[];
}

export function useDialog() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<DialogConfig>({
    title: '',
    actions: [],
  });

  const show = useCallback((cfg: DialogConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const Dialog = useCallback(() => (
    <AlertDialog
      visible={visible}
      config={config}
      onDismiss={hide}
    />
  ), [visible, config, hide]);

  return { show, hide, Dialog };
}

interface AlertDialogProps {
  visible: boolean;
  config: DialogConfig;
  onDismiss: () => void;
}

function AlertDialog({ visible, config, onDismiss }: AlertDialogProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onDismiss}
      title={config.title}
      subtitle={config.subtitle}
      icon={config.icon}
      iconSource={config.iconSource}
    >
      {config.message ? (
        typeof config.message === 'string'
          ? <Text style={styles.message}>{config.message}</Text>
          : <View style={styles.messageContainer}>{config.message}</View>
      ) : null}
      <View style={styles.actions}>
        {config.actions.map((action, i) => (
          <PressableRipple
            key={`${action.label}-${i}`}
            style={[
              styles.btn,
              action.primary && styles.btnPrimary,
              action.destructive && styles.btnDestructive,
              !action.primary && !action.destructive && styles.btnGhost,
            ]}
            onPress={() => {
              action.onPress();
              onDismiss();
            }}
          >
            <Text
              style={[
                styles.btnText,
                action.primary && styles.btnTextPrimary,
                action.destructive && styles.btnTextDestructive,
                !action.primary && !action.destructive && styles.btnTextGhost,
              ]}
            >
              {action.label}
            </Text>
          </PressableRipple>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  message: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  messageContainer: {
    marginBottom: Spacing.sm,
  },
  actions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  // Shared height contract with the settings sheets and the Add Account button:
  // full width, Spacing.md of vertical padding, and a 0.75 border on every
  // variant. Filled variants tint the border to match their own fill so the
  // border is invisible but still occupies the same 1.5px - otherwise a ghost
  // button sits 1.5px taller than a primary one and the stack looks ragged.
  btn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  btnPrimary: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  btnDestructive: {
    backgroundColor: Colors.destructive,
    borderColor: Colors.destructive,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnText: {
    ...Typography.subhead,
    fontWeight: '600',
  },
  btnTextPrimary: {
    color: Colors.bg,
  },
  btnTextDestructive: {
    color: Colors.bg,
  },
  btnTextGhost: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});