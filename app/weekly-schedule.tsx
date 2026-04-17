import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../constants/ui";
import { formatRoutineDisplayName } from "../lib/display-name";
import {
  getRoutineBundles,
  type RoutineBundle,
} from "../lib/routines-storage";
import {
  getWeeklySchedule,
  saveWeeklySchedule,
  WEEKDAY_KEYS,
  WEEKDAY_LABELS,
  type WeekdayKey,
  type WeeklySchedule,
} from "../lib/weekly-schedule";

function getAssignmentLabel(
  schedule: WeeklySchedule,
  day: WeekdayKey,
  routineBundles: RoutineBundle[],
): string {
  const assignment = schedule[day];

  if (assignment === "rest") {
    return "Rest";
  }

  const routine = routineBundles.find((bundle) => bundle.routine.id === assignment);

  return routine
    ? formatRoutineDisplayName(routine.routine.name)
    : "Missing routine";
}

export default function WeeklyScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [routineBundles, setRoutineBundles] = useState<RoutineBundle[]>([]);
  const [expandedDay, setExpandedDay] = useState<WeekdayKey | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadData() {
        const [savedSchedule, savedRoutineBundles] = await Promise.all([
          getWeeklySchedule(),
          getRoutineBundles(),
        ]);

        if (isActive) {
          setSchedule(savedSchedule);
          setRoutineBundles(savedRoutineBundles);
        }
      }

      void loadData();

      return () => {
        isActive = false;
      };
    }, []),
  );

  function handleToggleDay(day: WeekdayKey) {
    setExpandedDay((current) => (current === day ? null : day));
  }

  function handleSelectAssignment(day: WeekdayKey, assignment: string | "rest") {
    if (!schedule) {
      return;
    }

    const nextSchedule: WeeklySchedule = {
      ...schedule,
      [day]: assignment,
    };

    setSchedule(nextSchedule);
    setExpandedDay(null);
    void saveWeeklySchedule(nextSchedule);
  }

  if (!schedule) {
    return <View style={styles.container} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Weekly schedule</Text>
      <Text style={styles.subtitle}>Assign one routine or rest to each day.</Text>

      <View style={styles.dayList}>
        {WEEKDAY_KEYS.map((day) => {
          const isExpanded = expandedDay === day;

          return (
            <View key={day} style={styles.dayCard}>
              <Pressable style={styles.dayRow} onPress={() => handleToggleDay(day)}>
                <Text style={styles.dayLabel}>{WEEKDAY_LABELS[day]}</Text>
                <Text style={styles.dayValue}>
                  {getAssignmentLabel(schedule, day, routineBundles)}
                </Text>
              </Pressable>

              {isExpanded ? (
                <View style={styles.optionList}>
                  <Pressable
                    style={[
                      styles.optionRow,
                      schedule[day] === "rest" && styles.optionRowSelected,
                    ]}
                    onPress={() => handleSelectAssignment(day, "rest")}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        schedule[day] === "rest" && styles.optionTextSelected,
                      ]}
                    >
                      Rest
                    </Text>
                  </Pressable>

                  {routineBundles.map((bundle) => {
                    const isSelected = schedule[day] === bundle.routine.id;

                    return (
                      <Pressable
                        key={bundle.routine.id}
                        style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                        onPress={() => handleSelectAssignment(day, bundle.routine.id)}
                      >
                        <Text
                          style={[styles.optionText, isSelected && styles.optionTextSelected]}
                        >
                          {formatRoutineDisplayName(bundle.routine.name)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: AppColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: AppColors.mutedText,
    marginBottom: 20,
  },
  dayList: {
    gap: 12,
  },
  dayCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  dayRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dayLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: AppColors.text,
  },
  dayValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    color: AppColors.mutedText,
  },
  optionList: {
    borderTopWidth: 1,
    borderColor: AppColors.border,
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  optionRowSelected: {
    backgroundColor: AppColors.accentSoft,
  },
  optionText: {
    fontSize: 15,
    color: AppColors.text,
  },
  optionTextSelected: {
    fontWeight: "700",
    color: AppColors.accent,
  },
});
