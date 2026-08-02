import { Tabs } from 'expo-router';
import FloatingTabBar from '../../src/components/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="army" />
      <Tabs.Screen name="buildings" />
      <Tabs.Screen name="war" options={{ href: null }} />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="bases" />
      <Tabs.Screen name="armies" />
      <Tabs.Screen name="saved" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="achievements" />
    </Tabs>
  );
}
