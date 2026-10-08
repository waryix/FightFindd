import { Tabs } from "expo-router";
import { theme } from "@fightfind/config";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.surfaceRaised },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.textPrimary,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover", headerShown: false }} />
      <Tabs.Screen name="gyms" options={{ title: "Gyms", headerShown: false }} />
      <Tabs.Screen name="matches" options={{ title: "Matches", headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", headerShown: false }} />
      <Tabs.Screen name="fighter/[fighterId]" options={{ href: null, title: "Fighter" }} />
      <Tabs.Screen name="request/[receiverId]" options={{ href: null, title: "Request Sparring" }} />
      <Tabs.Screen name="gym/[gymId]" options={{ href: null, title: "Gym" }} />
      <Tabs.Screen name="checkout/[gymId]" options={{ href: null, title: "Membership" }} />
      <Tabs.Screen name="chat/[matchId]" options={{ href: null, title: "Chat" }} />
      <Tabs.Screen name="edit-profile" options={{ href: null, title: "Edit Profile" }} />
      <Tabs.Screen name="premium" options={{ href: null, title: "FightFind Pro" }} />
      <Tabs.Screen name="memberships" options={{ href: null, title: "Memberships" }} />
      <Tabs.Screen name="notifications" options={{ href: null, title: "Notifications" }} />
    </Tabs>
  );
}
