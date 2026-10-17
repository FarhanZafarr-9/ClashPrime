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
      {/*
        Order matters: it is the navigation order, so it drives the horizontal
        swipe between pages. Keep it flattened from FloatingTabBar's TAB_GROUPS
        so swiping matches what the tab bar's arrows do. Every one of these is a
        real page with an entry in the bar, so none are hidden with `href: null`
        - that only hid them from the bar, while still letting the swipe walk
        through them in the dark.
      */}
      <Tabs.Screen name="index" />
      <Tabs.Screen name="buildings" />
      <Tabs.Screen name="army" />
      <Tabs.Screen name="maxtime" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="hero-journey" />
      <Tabs.Screen name="bases" />
      <Tabs.Screen name="armies" />
      <Tabs.Screen name="war" />
      <Tabs.Screen name="player" />
      <Tabs.Screen name="zapquaker" />
      <Tabs.Screen name="bob" />
      <Tabs.Screen name="giantarrow" />
      <Tabs.Screen name="achievements" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
