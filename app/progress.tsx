import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../constants/ui";
import { HistoryScreenContent } from "./history";
import { StatsScreenContent } from "./stats";

type ProgressTab = "stats" | "history";

const tabs: { key: ProgressTab; label: string }[] = [
  { key: "history", label: "History" },
  { key: "stats", label: "Stats" },
];

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ProgressTab>("history");

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Progress</Text>
      </View>

      <View style={styles.content}>
        {activeTab === "history" ? <HistoryScreenContent /> : <StatsScreenContent embedded />}
      </View>

      <View style={styles.bottomTabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              style={[styles.bottomTabButton, isActive && styles.bottomTabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.bottomTabButtonText,
                  isActive && styles.bottomTabButtonTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: AppColors.text,
  },
  content: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  bottomTabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: AppColors.surface,
  },
  bottomTabButtonActive: {
    backgroundColor: AppColors.text,
  },
  bottomTabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: AppColors.mutedText,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bottomTabButtonTextActive: {
    color: AppColors.surface,
  },
});
