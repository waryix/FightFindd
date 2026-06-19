import { Tabs } from "expo-router";


export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#0a0a0a", borderTopColor: "#1a1a1a" },
        tabBarActiveTintColor: "#e63946",
        tabBarInactiveTintColor: "#555555",
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#ffffff",
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarLabel: "Discover" }} />
      <Tabs.Screen name="gyms" options={{ title: "Gyms", tabBarLabel: "Gyms" }} />
      <Tabs.Screen name="matches" options={{ title: "Matches", tabBarLabel: "Matches" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }} />
      <Tabs.Screen
        name="request/[receiverId]"
        options={{
          title: "Request Sparring",
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}
