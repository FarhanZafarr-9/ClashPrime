import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
        name="army"
        options={{
          title: 'Army',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrapper, focused && { backgroundColor: colors.accentSubtle }]}>
              <MaterialCommunityIcons name="sword-cross" size={18} color={color} />
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
              <MaterialCommunityIcons name="castle" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          href: null,
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
        name="armies"
        options={{
          title: 'Armies',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.tabIconWrapper, focused && { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="shield-half-outline" size={18} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          href: null,
        }}
      />
      <Tabs.Screen
        name="achievements"
        options={{
          title: 'Awards',
          href: null,
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
    </Tabs>
  );
}
