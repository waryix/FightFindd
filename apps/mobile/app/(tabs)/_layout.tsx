import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT, tabBarTranslateY } from "../../src/store/tabBar";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarPosition: "top",
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopColor: "transparent",
          borderBottomColor: "#1a1a1a",
          height: TAB_BAR_HEIGHT + insets.top,
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          transform: [{ translateY: tabBarTranslateY }],
        },
        tabBarActiveTintColor: "#e63946",
        tabBarInactiveTintColor: "#555555",
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: { fontSize: 14, fontWeight: "700" },
        tabBarItemStyle: { flex: 1 },
        tabBarIcon: () => null,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarLabel: "Discover" }} />
      <Tabs.Screen name="gyms" options={{ title: "Gyms", tabBarLabel: "Gyms" }} />
      <Tabs.Screen name="matches" options={{ title: "Matches", tabBarLabel: "Matches" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }} />
      <Tabs.Screen name="request/[receiverId]" options={{ title: "Request Sparring", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="edit-profile" options={{ title: "Edit Profile", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="fighter/[fighterId]" options={{ title: "Fighter Profile", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="chat/[matchId]" options={{ title: "Chat", tabBarButton: () => null, headerShown: true }} />
    </Tabs>
  );
}
