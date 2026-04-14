import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../constants/ui";
import { ExercisesScreenContent } from "./exercises";
import { RoutinesScreenContent } from "./routines";

type PlanTab = "routines" | "exercises";

const tabs: Array<{ key: PlanTab; label: string }> = [
  { key: "routines", label: "Routines" },
  { key: "exercises", label: "Exercises" },
];

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeTab, setActiveTab] = useState<PlanTab>("routines");

  function handleSelectTab(tab: PlanTab) {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({
      x: tab === "routines" ? 0 : width,
      animated: true,
    });
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Plan</Text>
        <View style={styles.segmentedControl}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <Pressable
                key={tab.key}
                style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                onPress={() => handleSelectTab(tab.key)}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    isActive && styles.segmentButtonTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          setActiveTab(nextIndex === 0 ? "routines" : "exercises");
        }}
      >
        <View style={{ width }}>
          <RoutinesScreenContent embedded />
        </View>
        <View style={{ width }}>
          <ExercisesScreenContent embedded />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    gap: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: AppColors.text,
  },
  segmentedControl: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: AppColors.surface,
  },
  segmentButtonActive: {
    backgroundColor: AppColors.text,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.mutedText,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  segmentButtonTextActive: {
    color: AppColors.surface,
  },
});
