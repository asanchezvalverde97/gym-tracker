import { useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

import { AppColors } from "../constants/ui";

const wheelRowHeight = 42;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getNearestIndex(options: number[], value: number): number {
  let closestIndex = 0;

  for (let index = 1; index < options.length; index += 1) {
    if (
      Math.abs(options[index] - value) <
      Math.abs(options[closestIndex] - value)
    ) {
      closestIndex = index;
    }
  }

  return closestIndex;
}

export function MiniWheelControl({
  label,
  value,
  options,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}) {
  const currentIndex = getNearestIndex(options, value);
  const [dragOffset, setDragOffset] = useState(0);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const displayValue = formatValue ?? ((item: number) => String(item));
  const previousValue = options[currentIndex - 1];
  const selectedValue = options[currentIndex];
  const nextValue = options[currentIndex + 1];

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 3,
      onPanResponderMove: (_, gestureState) => {
        setDragOffset(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const stepDelta = Math.round(-gestureState.dy / wheelRowHeight);
        const nextIndex = clamp(
          currentIndexRef.current + stepDelta,
          0,
          options.length - 1,
        );

        setDragOffset(0);
        onChange(options[nextIndex]);
      },
      onPanResponderTerminate: () => {
        setDragOffset(0);
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.viewport} {...panResponder.panHandlers}>
        <View
          style={[
            styles.track,
            { transform: [{ translateY: clamp(dragOffset, -wheelRowHeight, wheelRowHeight) }] },
          ]}
        >
          <Text style={styles.sideValue}>
            {previousValue == null ? "" : displayValue(previousValue)}
          </Text>
          <Text style={styles.centerValue}>{displayValue(selectedValue)}</Text>
          <Text style={styles.sideValue}>
            {nextValue == null ? "" : displayValue(nextValue)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: AppColors.mutedText,
  },
  viewport: {
    height: wheelRowHeight * 3,
    overflow: "hidden",
    justifyContent: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: AppColors.border,
  },
  track: {
    alignItems: "center",
  },
  sideValue: {
    height: wheelRowHeight,
    fontSize: 14,
    lineHeight: wheelRowHeight,
    color: AppColors.mutedText,
  },
  centerValue: {
    height: wheelRowHeight,
    fontSize: 22,
    lineHeight: wheelRowHeight,
    fontWeight: "700",
    color: AppColors.text,
  },
});
