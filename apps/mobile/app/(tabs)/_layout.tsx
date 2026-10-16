import { Tabs } from "expo-router";
import { Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT, tabBarTranslateY } from "../../src/store/tabBar";

function tabButton(text: string) {
  function TabButton(props: any) {
    const selected = Boolean(props.accessibilityState?.selected);
    return (
      <Pressable
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        testID={props.testID}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 6,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ color: selected ? "#e63946" : "#ffffff", fontSize: 14, fontWeight: "700" }}
        >
          {text}
        </Text>
      </Pressable>
    );
  }
  return TabButton;
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
          paddingTop: insets.top,
          paddingBottom: 0,
          transform: [{ translateY: tabBarTranslateY }],
        },
        tabBarShowLabel: false,
        tabBarIcon: () => null,
        tabBarItemStyle: { flex: 1 },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarButton: tabButton("Discover") }} />
      <Tabs.Screen name="gyms" options={{ title: "Gyms", tabBarButton: tabButton("Gyms") }} />
      <Tabs.Screen name="matches" options={{ title: "Matches", tabBarButton: tabButton("Matches") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarButton: tabButton("Profile") }} />
      <Tabs.Screen name="request/[receiverId]" options={{ title: "Request Sparring", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="edit-profile" options={{ title: "Edit Profile", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="fighter/[fighterId]" options={{ title: "Fighter Profile", tabBarButton: () => null, headerShown: true }} />
      <Tabs.Screen name="chat/[matchId]" options={{ title: "Chat", tabBarButton: () => null, headerShown: true }} />
    </Tabs>
  );
}
