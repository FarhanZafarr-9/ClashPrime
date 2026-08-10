import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import PressableRipple from './PressableRipple';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface DialogAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  primary?: boolean;
}

interface DialogConfig {
  title: string;
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <PressableRipple style={styles.backdrop} onPress={onDismiss} />
        <View style={styles.content}>
          <View style={styles.accent} />
          <Text style={styles.title}>{config.title}</Text>
          {config.message ? (
            typeof config.message === 'string'
              ? <Text style={styles.message}>{config.message}</Text>
              : config.message
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
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  content: {
    width: '84%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  accent: {
    height: 3,
    width: 32,
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  message: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
  },
  btn: {
    minWidth: 72,
    alignItems: 'center',
    paddingHorizontal: Spacing.base + 4,
    paddingVertical: Spacing.sm,
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
    color: Colors.textPrimary,
  },
  btnTextGhost: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
