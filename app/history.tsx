import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";

import { AppColors } from "../constants/ui";
import {
  deleteSavedSessionById,
  getSavedSessions,
  type SavedSessionBundle,
} from "../lib/completed-sessions";
import { formatWorkoutDisplayName } from "../lib/display-name";

function formatSessionDate(value: string | null | undefined): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string | null {
  if (!startedAt || !endedAt) {
    return null;
  }

  const startedAtMs = new Date(startedAt).getTime();
  const endedAtMs = new Date(endedAt).getTime();

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || endedAtMs < startedAtMs) {
    return null;
  }

  const totalMinutes = Math.round((endedAtMs - startedAtMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

function getFeelingLabel(feeling: SavedSessionBundle["session"]["feeling"]): string | null {
  switch (feeling) {
    case 1:
      return "Bad";
    case 2:
      return "Normal";
    case 3:
      return "Good";
    case 4:
      return "Very good";
    default:
      return null;
  }
}

function getNotesPreview(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.length > 120
    ? `${trimmedValue.slice(0, 117).trimEnd()}...`
    : trimmedValue;
}

export function HistoryScreenContent({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [sessions, setSessions] = useState<SavedSessionBundle[]>([]);
  const [pendingDeletedSession, setPendingDeletedSession] = useState<SavedSessionBundle | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finalizePendingDelete = useCallback(async () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    if (!pendingDeletedSession) {
      setShowUndo(false);
      return;
    }

    await deleteSavedSessionById(pendingDeletedSession.session.id);
    setPendingDeletedSession(null);
    setShowUndo(false);
  }, [pendingDeletedSession]);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadSessions() {
        const savedSessions = await getSavedSessions();

        if (isActive) {
          setSessions(
            [...savedSessions].sort((a, b) => {
              const aTime = new Date(a.session.endedAt ?? a.session.startedAt).getTime();
              const bTime = new Date(b.session.endedAt ?? b.session.startedAt).getTime();

              return bTime - aTime;
            }),
          );
        }
      }

      void loadSessions();

      return () => {
        isActive = false;
      };
    }, []),
  );

  function handleDeletePress(bundle: SavedSessionBundle) {
    void (async () => {
      await finalizePendingDelete();

      setSessions((current) =>
        current.filter((item) => item.session.id !== bundle.session.id),
      );
      setPendingDeletedSession(bundle);
      setShowUndo(true);

      undoTimeoutRef.current = setTimeout(() => {
        void finalizePendingDelete();
      }, 5000);
    })();
  }

  function handleUndoPress() {
    if (!pendingDeletedSession) {
      return;
    }

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    setSessions((current) =>
      [...current, pendingDeletedSession].sort((a, b) => {
        const aTime = new Date(a.session.endedAt ?? a.session.startedAt).getTime();
        const bTime = new Date(b.session.endedAt ?? b.session.startedAt).getTime();

        return bTime - aTime;
      }),
    );
    setPendingDeletedSession(null);
    setShowUndo(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        embedded && styles.contentEmbedded,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {!embedded ? <Text style={styles.title}>Completed sessions</Text> : null}

      {sessions.length === 0 ? (
        <Text style={styles.emptyText}>No completed sessions yet.</Text>
      ) : (
        <View style={styles.list}>
          {sessions.map((bundle) => {
            const duration = formatDuration(
              bundle.session.startedAt,
              bundle.session.endedAt,
            );
            const feelingLabel = getFeelingLabel(bundle.session.feeling);
            const notesPreview = getNotesPreview(bundle.session.notes);

            return (
              <Swipeable
                key={bundle.session.id}
                renderRightActions={() => (
                  <Pressable
                    style={styles.deleteAction}
                    onPress={() => handleDeletePress(bundle)}
                  >
                    <Text style={styles.deleteActionText}>Delete</Text>
                  </Pressable>
                )}
              >
                <Pressable
                  style={styles.card}
                  onPress={() => router.push(`/history/${bundle.session.id}`)}
                >
                  <Text style={styles.sessionName}>
                    {formatWorkoutDisplayName(bundle.session.name)}
                  </Text>
                  <Text style={styles.sessionDate}>
                    {formatSessionDate(bundle.session.endedAt ?? bundle.session.startedAt)}
                  </Text>
                  <View style={styles.metaRow}>
                    {duration ? <Text style={styles.metaText}>{duration}</Text> : null}
                    {feelingLabel ? <Text style={styles.metaText}>{feelingLabel}</Text> : null}
                  </View>
                  {notesPreview ? <Text style={styles.notesText}>{notesPreview}</Text> : null}
                </Pressable>
              </Swipeable>
            );
          })}
        </View>
      )}

      {showUndo ? (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>Session deleted</Text>
          <Pressable onPress={handleUndoPress}>
            <Text style={styles.snackbarAction}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

export default function HistoryScreen() {
  return <HistoryScreenContent />;
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
    fontSize: 34,
    fontWeight: "700",
    color: AppColors.text,
    marginBottom: 18,
  },
  list: {
    gap: 0,
  },
  card: {
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  deleteAction: {
    backgroundColor: AppColors.danger,
    alignItems: "center",
    justifyContent: "center",
    width: 96,
  },
  deleteActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sessionName: {
    fontSize: 19,
    fontWeight: "700",
    color: AppColors.text,
  },
  sessionDate: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaText: {
    fontSize: 13,
    color: AppColors.mutedText,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.mutedText,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 16,
    color: AppColors.mutedText,
  },
  snackbar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
    backgroundColor: AppColors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  snackbarText: {
    color: "#fff",
    fontSize: 15,
  },
  snackbarAction: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
