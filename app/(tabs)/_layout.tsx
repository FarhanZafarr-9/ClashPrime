import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../../src/theme';

const styles = StyleSheet.create({
  tabIconWrapper: {
    width: 56,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
});

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarButton: (props: any) => (
          <Pressable
            {...props}
            android_ripple={null}
            style={({ pressed }) => [
              props.style,
              pressed && { opacity: 0.85 },
            ]}
          />
        ),
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrapper, focused && { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="home" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="bases"
        options={{
          title: 'Bases',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrapper, focused && { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="grid" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrapper, focused && { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="person" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrapper, focused && { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="calendar" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="buildings"
        options={{
          title: 'Buildings',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrapper, focused && { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="business" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrapper, focused && { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="settings-sharp" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
