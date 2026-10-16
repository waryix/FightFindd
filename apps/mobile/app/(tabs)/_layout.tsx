import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT, tabBarTranslateY } from "../../src/store/tabBar";

function tabLabel(text: string) {
  function TabLabel({ focused }: { focused: boolean }) {
    return (
      <Text
        style={{
          color: focused ? "#e63946" : "#ffffff",
          fontSize: 14,
          fontWeight: "700",
        }}
      >
        {text}
      </Text>
    );
  }
  return TabLabel;
}

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
        tabBarInactiveTintColor: "#ffffff",
        tabBarShowLabel: true,
        tabBarLabelPosition: "below-icon",
        tabBarItemStyle: { flex: 1 },
        tabBarIcon: () => null,
        headerShown: false,
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarLabel: tabLabel("Discover") }} />
      <Tabs.Screen name="gyms" options={{ title: "Gyms", tabBarLabel: tabLabel("Gyms") }} />
      <Tabs.Screen name="matches" options={{ title: "Matches", tabBarLabel: tabLabel("Matches") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: tabLabel("Profile") }} />
      <Tabs.Screen name="request/[receiverId]" options={{ title: "Request Sparring", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="edit-profile" options={{ title: "Edit Profile", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="fighter/[fighterId]" options={{ title: "Fighter Profile", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="chat/[matchId]" options={{ title: "Chat", tabBarButton: () => null, headerShown: true }} />
    </Tabs>
  );
}
