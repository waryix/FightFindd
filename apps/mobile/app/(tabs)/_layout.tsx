import { Tabs } from "expo-router";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT, tabBarTranslateY } from "../../src/store/tabBar";

function tabButton(text: string) {
  function TabButton(props: any) {
    const selected = Boolean(props["aria-selected"]);
    return (
      <Pressable
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        testID={props.testID}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          marginHorizontal: 3,
          marginBottom: selected ? -1 : 0,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          borderWidth: selected ? 1 : 0,
          borderBottomWidth: 0,
          borderColor: "#2a2a2a",
          backgroundColor: selected ? "#0a0a0a" : "transparent",
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

function profileTabButton() {
  function ProfileButton(props: any) {
    const selected = Boolean(props["aria-selected"]);
    return (
      <Pressable
        onPress={props.onPress}
        onLongPress={props.onLongPress}
        testID={props.testID}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons
          name={selected ? "person-circle" : "person-circle-outline"}
          size={28}
          color={selected ? "#e63946" : "#ffffff"}
        />
      </Pressable>
    );
  }
  return ProfileButton;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarPosition: "top",
        tabBarStyle: {
          backgroundColor: "#050505",
          borderTopColor: "transparent",
          borderBottomColor: "#1a1a1a",
          borderBottomWidth: 1,
          height: TAB_BAR_HEIGHT + insets.top,
          paddingTop: insets.top,
          paddingBottom: 0,
          transform: [{ translateY: tabBarTranslateY }],
        },
        tabBarShowLabel: false,
        tabBarIcon: () => null,
        tabBarItemStyle: { flex: 1 },
        headerShown: false,
        headerStyle: { backgroundColor: "#0a0a0a" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "bold" },
        sceneStyle: { backgroundColor: "#0a0a0a" },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: "Discover", tabBarButton: tabButton("Discover") }} />
      <Tabs.Screen name="gyms" options={{ title: "Gyms", tabBarButton: tabButton("Gyms") }} />
      <Tabs.Screen name="matches" options={{ title: "Matches", tabBarButton: tabButton("Matches") }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarButton: profileTabButton(),
          tabBarItemStyle: { flex: 0, width: 60 },
        }}
      />
      <Tabs.Screen name="request/[receiverId]" options={{ title: "Request Sparring", href: null, headerShown: true }} />
      <Tabs.Screen name="edit-profile" options={{ title: "Edit Profile", href: null, headerShown: false }} />
      <Tabs.Screen name="fighter/[fighterId]" options={{ title: "Fighter Profile", href: null, headerShown: false }} />
      <Tabs.Screen name="gym/[gymId]" options={{ title: "Gym", href: null, headerShown: false }} />
      <Tabs.Screen name="chat/[matchId]" options={{ title: "Chat", href: null, headerShown: true }} />
    </Tabs>
  );
}
