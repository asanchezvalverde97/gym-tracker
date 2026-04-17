import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="start-workout" options={{ title: "Start workout" }} />
        <Stack.Screen
          name="start-workout-confirm"
          options={{ title: "Build workout" }}
        />
        <Stack.Screen name="progress" options={{ headerShown: false }} />
        <Stack.Screen name="plan" options={{ headerShown: false }} />
        <Stack.Screen name="exercises" options={{ title: "Exercises" }} />
        <Stack.Screen name="routines" options={{ title: "Routines" }} />
        <Stack.Screen name="weekly-schedule" options={{ title: "Weekly schedule" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="stats" options={{ title: "Stats" }} />
        <Stack.Screen name="history" options={{ title: "Completed sessions" }} />
        <Stack.Screen name="add-past-session" options={{ title: "Add past session" }} />
        <Stack.Screen name="history/[sessionId]" options={{ title: "Session details" }} />
        <Stack.Screen name="exercise/[exerciseId]" options={{ title: "Exercise" }} />
        <Stack.Screen name="session" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
