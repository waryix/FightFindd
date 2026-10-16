import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopColor: "#1a1a1a",
          height: 56 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        tabBarActiveTintColor: "#e63946",
        tabBarInactiveTintColor: "#555555",
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        tabBarItemStyle: { flex: 1 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="chevron-down" color={color} size={size} />
        ),
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#ffffff",
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarLabel: "Discover", headerShown: false }} />
      <Tabs.Screen name="gyms" options={{ title: "Gyms", tabBarLabel: "Gyms", headerShown: false }} />
      <Tabs.Screen name="matches" options={{ title: "Matches", tabBarLabel: "Matches", headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }} />
      <Tabs.Screen name="request/[receiverId]" options={{ title: "Request Sparring", tabBarButton: () => null }} />
      <Tabs.Screen name="edit-profile" options={{ title: "Edit Profile", tabBarButton: () => null }} />
      <Tabs.Screen name="fighter/[fighterId]" options={{ title: "Fighter Profile", tabBarButton: () => null }} />
      <Tabs.Screen name="chat/[matchId]" options={{ title: "Chat", tabBarButton: () => null }} />
    </Tabs>
  );
}
