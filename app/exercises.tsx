import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { AppColors } from "../constants/ui";
import { exercises } from "../data/exercises";
import { getExerciseDisplayName } from "../lib/display-name";

type ExerciseGroup = "push" | "pull" | "legs";

const groupLabels: Record<ExerciseGroup, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
};

const exerciseGroups: Record<string, ExerciseGroup> = {
  ex_fondos: "push",
  ex_flexiones: "push",
  ex_flexiones_cerradas: "push",
  ex_press_hombro_mancuerna: "push",
  ex_elevaciones_laterales: "push",
  ex_plancha: "push",
  ex_isometrico_lateral: "push",
  ex_dominadas: "pull",
  ex_remo_mancuerna: "pull",
  ex_chin_ups: "pull",
  ex_curl_mancuerna: "pull",
  ex_dead_hang: "pull",
  ex_pajaros: "pull",
  ex_shrugs: "pull",
  ex_goblet_squat: "legs",
  ex_bulgaras: "legs",
  ex_rumano: "legs",
  ex_puente_gluteo: "legs",
  ex_leg_raises: "legs",
};

function getExerciseIconName(group: ExerciseGroup): keyof typeof Feather.glyphMap {
  switch (group) {
    case "push":
      return "arrow-up-right";
    case "legs":
      return "triangle";
    default:
      return "arrow-down-left";
  }
}

export function ExercisesScreenContent({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [activeGroup, setActiveGroup] = useState<ExerciseGroup>("push");
  const scrollRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(width - 40, 0);
  const groups = Object.keys(groupLabels) as ExerciseGroup[];

  const filteredExercises = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return groups.reduce<Record<ExerciseGroup, typeof exercises>>(
      (result, group) => {
        result[group] = exercises.filter((exercise) => {
          const matchesGroup = (exerciseGroups[exercise.id] ?? "pull") === group;
          const displayName = getExerciseDisplayName(exercise.id).toLowerCase();
          const matchesSearch =
            normalizedQuery.length === 0 || displayName.includes(normalizedQuery);

          return matchesGroup && matchesSearch;
        });

        return result;
      },
      { push: [], pull: [], legs: [] },
    );
  }, [groups, searchValue]);

  function handleSelectGroup(group: ExerciseGroup) {
    setActiveGroup(group);

    scrollRef.current?.scrollTo({
      x: groups.indexOf(group) * pageWidth,
      animated: true,
    });
  }

  function handleOpenExercise(exerciseId: string) {
    router.push({
      pathname: "/exercise/[exerciseId]",
      params: { exerciseId },
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, embedded && styles.contentEmbedded]}
      showsVerticalScrollIndicator={false}
    >
      {!embedded ? <Text style={styles.title}>Exercises</Text> : null}
      <TextInput
        style={styles.searchInput}
        value={searchValue}
        onChangeText={setSearchValue}
        placeholder="Search exercises"
        placeholderTextColor={AppColors.mutedText}
      />

      <View style={styles.tabs}>
        {groups.map((group) => {
          const isActive = activeGroup === group;

          return (
            <Pressable
              key={group}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => handleSelectGroup(group)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {groupLabels[group]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
          setActiveGroup(groups[nextIndex] ?? "push");
        }}
      >
        {groups.map((group) => (
          <View key={group} style={[styles.panel, { width: pageWidth }]}>
            <View style={styles.list}>
              {filteredExercises[group].map((exercise) => (
                <Pressable
                  key={exercise.id}
                  style={styles.row}
                  onPress={() => handleOpenExercise(exercise.id)}
                >
                  <View style={styles.rowIcon}>
                    <Feather
                      name={getExerciseIconName(group)}
                      size={16}
                      color={AppColors.text}
                    />
                  </View>
                  <Text style={styles.rowText}>{getExerciseDisplayName(exercise.id)}</Text>
                  <Feather name="chevron-right" size={16} color={AppColors.mutedText} />
                </Pressable>
              ))}
            </View>
            {filteredExercises[group].length === 0 ? (
              <Text style={styles.emptyText}>No exercises found.</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

export default function ExercisesScreen() {
  return <ExercisesScreenContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  contentEmbedded: {
    paddingTop: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: AppColors.text,
    marginBottom: 24,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 16,
  },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: AppColors.border,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: AppColors.surface,
  },
  tabButtonActive: {
    backgroundColor: AppColors.text,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  tabLabelActive: {
    color: AppColors.surface,
  },
  panel: {
    paddingBottom: 8,
  },
  list: {
    borderTopWidth: 1,
    borderColor: AppColors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  rowIcon: {
    width: 28,
    alignItems: "center",
  },
  rowText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "500",
    color: AppColors.text,
  },
  emptyText: {
    paddingTop: 16,
    fontSize: 14,
    color: AppColors.mutedText,
  },
});
