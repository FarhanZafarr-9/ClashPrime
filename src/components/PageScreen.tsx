import React, { type ReactNode, type Ref } from 'react';
import { ScrollView, View, Text, StyleSheet, KeyboardAvoidingView, Platform, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Screen from './Screen';
import { Spacing, useTheme, Typography } from '../theme';

export interface PageScreenProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Header controls, in display order. Use HeaderButton for action buttons. */
  actions?: readonly ReactNode[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  scrollProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>;
  scrollRef?: Ref<ScrollView>;
  /** Floating tab bar clearance; disable for stack screens. */
  tabBar?: boolean;
  keyboardAvoiding?: boolean;
  children?: ReactNode;
  /** Sheets and dialogs render outside the scrolling body. */
  overlays?: ReactNode;
}

/** One fixed header and one vertical scroll owner per page. */
export default function PageScreen({
  title,
  subtitle,
  actions = [],
  style,
  contentContainerStyle,
  scrollProps,
  scrollRef,
  tabBar = true,
  keyboardAvoiding = false,
  children,
  overlays,
}: PageScreenProps) {
  const { colors } = useTheme();
  return (
    <Screen style={[styles.root, { backgroundColor: colors.bg }, style]}>
      <KeyboardAvoidingView style={styles.body} behavior={keyboardAvoiding && Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            {subtitle != null && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
          </View>
          <View style={styles.actions}>
            {actions.map((action, index) => <React.Fragment key={React.isValidElement(action) ? action.key ?? index : index}>{action}</React.Fragment>)}
          </View>
        </View>
        <ScrollView
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
          ref={scrollRef}
          style={[styles.body, scrollProps?.style]}
          contentContainerStyle={[styles.content, contentContainerStyle, { paddingBottom: tabBar ? 110 : Spacing.xl }]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
      {overlays}
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: Spacing.base },
  heading: { flex: 1, minWidth: 0 },
  title: { ...Typography.largeTitle },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  body: { flex: 1 },
  content: { flexGrow: 1 },
});
