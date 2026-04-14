import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppColors } from "../constants/ui";
import {
  getUserSettings,
  saveUserSettings,
} from "../lib/user-settings";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [bodyweightValue, setBodyweightValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadSettings() {
      const settings = await getUserSettings();

      if (!isActive) {
        return;
      }

      setBodyweightValue(
        settings.bodyweightKg == null ? "" : String(settings.bodyweightKg),
      );
    }

    void loadSettings();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleSave() {
    setIsSaving(true);
    setSavedMessage("");

    const trimmedValue = bodyweightValue.trim();
    const parsedValue = Number(trimmedValue);
    const bodyweightKg =
      trimmedValue.length === 0 || Number.isNaN(parsedValue) ? null : parsedValue;

    await saveUserSettings({
      bodyweightKg,
    });

    setBodyweightValue(bodyweightKg == null ? "" : String(bodyweightKg));
    setSavedMessage("Saved");
    setIsSaving(false);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profile</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bodyweight (kg)</Text>
          <TextInput
            style={styles.input}
            value={bodyweightValue}
            onChangeText={setBodyweightValue}
            placeholder="Enter bodyweight"
            placeholderTextColor={AppColors.mutedText}
            keyboardType="decimal-pad"
          />
          <Text style={styles.helperText}>
            Used for bodyweight exercises like pull-ups and dips
          </Text>

          <Pressable
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>

          {savedMessage ? <Text style={styles.savedText}>{savedMessage}</Text> : null}
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
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: AppColors.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  section: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: AppColors.text,
    backgroundColor: AppColors.surface,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.mutedText,
  },
  saveButton: {
    marginTop: 8,
    backgroundColor: AppColors.accent,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: AppColors.accentText,
    fontSize: 18,
    fontWeight: "600",
  },
  savedText: {
    fontSize: 14,
    color: AppColors.mutedText,
  },
});
