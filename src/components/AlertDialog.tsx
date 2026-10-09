import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PressableRipple from './PressableRipple';
import BottomSheet from './BottomSheet';
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
    <BottomSheet visible={visible} onClose={onDismiss} title={config.title} subtitle={config.subtitle}>
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
  btn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  btnPrimary: {
    backgroundColor: Colors.textPrimary,
  },
  btnDestructive: {
    backgroundColor: Colors.destructive,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 0.75,
    borderColor: Colors.border,
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