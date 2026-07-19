import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Colors, Typography } from '../theme';

interface Props {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0 to 1
  label?: string;
  sublabel?: string;
  color?: string;
}

export function ProgressRing({
  size = 64,
  strokeWidth = 5,
  progress,
  label,
  sublabel,
  color = Colors.textPrimary,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference * (1 - clamped);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        {label && <Text style={[styles.label, { fontSize: size * 0.2 }]}>{label}</Text>}
        {sublabel && <Text style={[styles.sublabel, { fontSize: size * 0.12 }]}>{sublabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  sublabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
});
