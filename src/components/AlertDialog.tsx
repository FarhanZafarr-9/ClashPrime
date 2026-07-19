import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface DialogAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  primary?: boolean;
}

interface DialogConfig {
  title: string;
  message?: string;
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
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={styles.content}>
          <Text style={styles.title}>{config.title}</Text>
          {config.message ? (
            <Text style={styles.message}>{config.message}</Text>
          ) : null}
          <View style={styles.actions}>
            {config.actions.map((action, i) => (
              <Pressable
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
              </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  content: {
    width: '82%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
    zIndex: 1,
  },
  title: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  message: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
  },
  btn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
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
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
