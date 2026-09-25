import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Modal,
  PanResponder,
  Pressable,
  Animated,
  useWindowDimensions,
  type LayoutChangeEvent,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PressableRipple from '../../src/components/PressableRipple';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { PACKAGE_IMAGES } from '../../src/data/packageImages';
import { useDialog } from '../../src/components/AlertDialog';
import Svg, { Line, Polygon } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const STORAGE_KEY = 'clashprime_giant_arrow';
const PATH_COLORS = [
  '#FFFFFF',
  '#FFD700',
  '#FF7F00',
  '#FF3B30',
  '#7B4BFF',
  '#00C853',
  '#00A6E8',
];
const START_COLOR = '#FF8A3D';
const ERROR_COLOR = '#FF3B30';
const END_COLOR = '#4DC9F6';
const MARKER = 20;
const DRAG = 44;
const QUEEN_ICON = PACKAGE_IMAGES['Archer Queen']?.icon;

interface Point {
  x: number;
  y: number;
}

interface SavedPlan {
  uri: string;
  start?: Point | null;
  end?: Point | null;
  pathColor?: string;
}

function clampPoint(p: Point): Point {
  return { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) };
}

function arrowHeadPoints(ex: number, ey: number, angle: number): Point[] {
  const len = 16;
  const spread = 0.45;
  const a1 = angle + Math.PI - spread;
  const a2 = angle + Math.PI + spread;
  return [
    { x: ex + len * Math.cos(a1), y: ey + len * Math.sin(a1) },
    { x: ex + len * Math.cos(a2), y: ey + len * Math.sin(a2) },
  ];
}

export default function GiantArrowScreen() {
  const { width: winW, height: winH } = useWindowDimensions();
  const { show, Dialog } = useDialog();
  const [uri, setUri] = useState<string | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState('Pick a base screenshot to plan your Giant Arrow.');
  const [pathColor, setPathColor] = useState(PATH_COLORS[0]);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      if (!raw) return;
      try {
        const plan: SavedPlan = JSON.parse(raw);
        if (plan?.uri) {
          setUri(plan.uri);
          setStart(plan.start ?? null);
          setEnd(plan.end ?? null);
          if (plan.pathColor && PATH_COLORS.includes(plan.pathColor)) setPathColor(plan.pathColor);
        }
      } catch {}
    })();
  }, []);

  const shareRef = useRef<View>(null);

  useEffect(() => {
    if (uri) Image.getSize(uri, (w, h) => setAspect(w / h), () => {});
  }, [uri]);

  useEffect(() => {
    if (uri) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ uri, start, end, pathColor } as SavedPlan)).catch(() => {});
  }, [uri, start, end, pathColor]);

  const [shareSize, setShareSize] = useState<{ width: number; height: number } | null>(null);

  const handleShare = useCallback(async () => {
    try {
      const snapSize = shareSize ? { width: shareSize.width * 3, height: shareSize.height * 3 } : {};
      const snapshot = await captureRef(shareRef, { format: 'png', quality: 1, ...snapSize });
      if (!(await Sharing.isAvailableAsync())) {
        setHint('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(snapshot, {
        mimeType: 'image/png',
        dialogTitle: 'Share Giant Arrow plan',
      });
    } catch {
      setHint('Could not share the plan right now.');
    }
  }, [shareSize]);

  const onPick = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUri(result.assets[0].uri);
    setAspect(null);
    setStart(null);
    setEnd(null);
    setFull(false);
    setHint('Tap the Queen position (start).');
  }, []);

  const clearMarkers = useCallback(() => {
    setStart(null);
    setEnd(null);
    setHint('Tap the Queen position (start).');
  }, []);

  const clearImage = useCallback(() => {
    show({
      title: 'Remove screenshot?',
      message: 'This clears the image and the arrow plan drawn on it.',
      actions: [
        { label: 'Cancel', onPress: () => {} },
        {
          label: 'Remove',
          destructive: true,
          onPress: () => {
            setUri(null);
            setAspect(null);
            setStart(null);
            setEnd(null);
            setFull(false);
            setHint('Pick a base screenshot to plan your Giant Arrow.');
          },
        },
      ],
    });
  }, [show]);

  const handlePlace = useCallback(
    (p: Point) => {
      if (!start) {
        setStart(p);
        setEnd(null);
        setHint('Tap where the arrow should end, then drag the pins to fine-tune.');
      } else if (!end) {
        setEnd(p);
        setHint('Drag either pin to adjust the path.');
      }
    },
    [start, end],
  );

  let fullW = winH;
  let fullH = fullW / (aspect ?? 1);
  if (fullH > winW) {
    fullH = winW;
    fullW = fullH * (aspect ?? 1);
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
      {uri && aspect != null ? (
        <View style={styles.editor}>
          <View style={styles.editorHeader}>
            <View style={styles.header}>
              <Text style={styles.title}>Giant Arrow</Text>
              <Text style={styles.subtitle}>Queen start → arrow target</Text>
            </View>
            <View style={styles.toolIconRow}>
              <PressableRipple
                onPress={clearMarkers}
                disabled={!start && !end}
                style={[styles.iconBtn, !start && !end && styles.iconBtnDisabled]}
                hitSlop={8}
              >
                <Ionicons name="refresh-outline" size={16} color={Colors.textPrimary} />
              </PressableRipple>
              <PressableRipple onPress={clearImage} style={[styles.iconBtn, styles.iconBtnDanger]} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={ERROR_COLOR} />
              </PressableRipple>
              <Pressable onPress={() => setFull(true)} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="expand-outline" size={16} color={Colors.textPrimary} />
              </Pressable>
            </View>
          </View>
          <Text style={styles.hintText}>{hint}</Text>
          <View style={styles.paletteCard}>
            <PressableRipple onPress={() => setPaletteOpen((v) => !v)} hitSlop={6} style={styles.paletteHeader}>
              <Text style={styles.swatchLabel}>PATH COLOR</Text>
              <View style={styles.paletteHeaderEnd}>
                <Text style={styles.swatchHex}>{pathColor.toUpperCase()}</Text>
                <Ionicons
                  name={paletteOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={Colors.textTertiary}
                />
              </View>
            </PressableRipple>
            {paletteOpen && (
              <View style={styles.palette}>
                {PATH_COLORS.map((c) => {
                  const active = pathColor === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setPathColor(c)}
                      hitSlop={5}
                      style={[styles.swatchOption, active && styles.swatchOptionActive]}
                    >
                      <View style={[styles.swatch, { backgroundColor: c }]} />
                      {active && <Ionicons name="checkmark" size={14} color={Colors.bg} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
          <View
            style={[styles.canvas, !aspect && styles.canvasPending, aspect ? { aspectRatio: aspect } : null]}
            ref={shareRef}
            onLayout={(e) => setShareSize(e.nativeEvent.layout)}
          >
            <PlanCanvas
              uri={uri}
              aspect={aspect}
              start={start}
              end={end}
              pathColor={pathColor}
              onSetStart={setStart}
              onSetEnd={setEnd}
              onPlace={handlePlace}
              onDoubleTap={() => setFull(true)}
              style={styles.canvasInner}
            />
          </View>
          <View style={styles.bottomToolbar}>
            <PressableRipple onPress={onPick} style={styles.toolBtn} hitSlop={6}>
              <Ionicons name="images-outline" size={15} color={Colors.bg} />
              <Text style={styles.toolText}>Replace</Text>
            </PressableRipple>
            <PressableRipple onPress={handleShare} style={[styles.toolBtn, styles.toolBtnGhost]} hitSlop={6}>
              <Ionicons name="share-outline" size={15} color={Colors.textPrimary} />
              <Text style={[styles.toolText, styles.toolTextGhost]}>Share</Text>
            </PressableRipple>
          </View>
          <View style={styles.noteCard}>
            <Text style={styles.tipsKicker}>GIANT ARROW TIPS</Text>
            <View style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name="return-down-forward-outline" size={16} color={Colors.warning} />
              </View>
              <View style={styles.tipInfo}>
                <Text style={styles.tipTitle}>Straight-line damage</Text>
                <Text style={styles.tipText}>
                  The arrow flies in a line between the two pins and damages everything along its
                  ~2-tile-wide path.
                </Text>
              </View>
            </View>
            <View style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name="pin-outline" size={16} color={Colors.warning} />
              </View>
              <View style={styles.tipInfo}>
                <Text style={styles.tipTitle}>Pin the Queen, aim the tip</Text>
                <Text style={styles.tipText}>
                  Place the start pin on your Queen and drag the end pin toward the buildings you
                  want to soften.
                </Text>
              </View>
            </View>
            <View style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name="flash-outline" size={16} color={Colors.warning} />
              </View>
              <View style={styles.tipInfo}>
                <Text style={styles.tipTitle}>Fewer targets, bigger hits</Text>
                <Text style={styles.tipText}>
                  Damage is split across everything the arrow passes over — a single building on the
                  line takes the full hit, a crowd splits it.
                </Text>
              </View>
            </View>
            <View style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <Ionicons name="color-palette-outline" size={16} color={Colors.warning} />
              </View>
              <View style={styles.tipInfo}>
                <Text style={styles.tipTitle}>Make it readable</Text>
                <Text style={styles.tipText}>
                  Pick a path color that stands out on the base theme, then share the finished plan
                  from the buttons below.
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.title}>Giant Arrow</Text>
            <Text style={styles.subtitle}>Plan the Archer Queen skill on a base screenshot</Text>
          </View>
          <PressableRipple onPress={onPick} style={styles.uploadZone}>
            <View style={styles.uploadIcon}>
              <Ionicons name="images-outline" size={32} color={Colors.textSecondary} />
            </View>
            <Text style={styles.uploadTitle}>Choose a base screenshot</Text>
            <Text style={styles.uploadHint}>
              Pick a screenshot from your photo library to start plotting the arrow path from the
              Queen.
            </Text>
            <View style={styles.uploadChip}>
              <Text style={styles.uploadChipText}>Open photo library</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.bg} />
            </View>
          </PressableRipple>
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>How it works</Text>
            <View style={styles.noteLine}>
              <Text style={styles.noteBullet}>•</Text>
              <Text style={styles.noteBody}>
                Tap to place the start pin where the Archer Queen stands.
              </Text>
            </View>
            <View style={styles.noteLine}>
              <Text style={styles.noteBullet}>•</Text>
              <Text style={styles.noteBody}>
                Tap again to set where the arrow ends — the path is a straight line between the
                two pins.
              </Text>
            </View>
            <View style={styles.noteLine}>
              <Text style={styles.noteBullet}>•</Text>
              <Text style={styles.noteBody}>
                Drag either pin to fine-tune. The arrow hits buildings along a ~2 tile wide line.
              </Text>
            </View>
            <View style={styles.noteLine}>
              <Text style={styles.noteBullet}>•</Text>
              <Text style={styles.noteBody}>Your plan is saved on this device automatically.</Text>
            </View>
          </View>
          <View style={{ flex: 1 }} />
          <PressableRipple onPress={onPick} style={[styles.primaryBtn, styles.bottomBtn]}>
            <Ionicons name="images-outline" size={18} color={Colors.bg} />
            <Text style={styles.primaryBtnText}>Choose screenshot</Text>
          </PressableRipple>
        </View>
      )}

      {uri && aspect != null && (
        <Modal
          animationType="fade"
          presentationStyle="fullScreen"
          visible={full}
          onRequestClose={() => setFull(false)}
          statusBarTranslucent
          navigationBarTranslucent
        >
          <GestureHandlerRootView style={styles.fullContainer}>
            <View style={styles.fullCenter}>
              <View style={{ width: fullW, height: fullH, transform: [{ rotate: '90deg' }] }}>
                <ZoomableCanvas>
                  <PlanCanvas
                    uri={uri}
                    aspect={aspect}
                    start={start}
                    end={end}
                    pathColor={pathColor}
                    rotated
                    onSetStart={setStart}
                    onSetEnd={setEnd}
                    onPlace={handlePlace}
                    style={{ flex: 1 }}
                  />
                </ZoomableCanvas>
              </View>
            </View>
            <SafeAreaView style={styles.fullBottomBar} edges={['bottom']}>
              <View style={styles.fullHintRow}>
                <Text style={styles.fullHintKicker}>HINT</Text>
                <Text style={styles.fullHint} numberOfLines={2}>
                  {hint}
                </Text>
              </View>
              <View style={styles.fullBtnRow}>
                <Pressable
                  onPress={clearMarkers}
                  disabled={!start && !end}
                  hitSlop={4}
                  style={[styles.fullControlBtn, !start && !end && styles.fullBtnDisabled]}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={16}
                    color={Colors.textPrimary}
                  />
                  <Text style={styles.fullBtnText}>Reset pins</Text>
                </Pressable>
                <Pressable onPress={() => setFull(false)} hitSlop={4} style={[styles.fullControlBtn, styles.fullControlBtnPrimary]}>
                  <Ionicons name="checkmark" size={16} color={Colors.bg} />
                  <Text style={[styles.fullBtnText, styles.fullBtnTextPrimary]}>Done</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </GestureHandlerRootView>
        </Modal>
      )}
      <Dialog />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

function ZoomableCanvas({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const pinchRef = useRef<PinchGestureHandler>(null);
  const panRef = useRef<PanGestureHandler>(null);
  const [scaleVal] = useState(() => new Animated.Value(1));
  const [txVal] = useState(() => new Animated.Value(0));
  const [tyVal] = useState(() => new Animated.Value(0));

  // Refs/mirrored state are read and mutated only inside gesture event callbacks
  // (never during render), so the react-hooks/refs render heuristic is a false positive.
  const scale = useRef(1);
  const tx = useRef(0);
  const ty = useRef(0);
  const pinchStart = useRef(1);
  const panStart = useRef({ x: 0, y: 0 });

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const onPinchBegan = useCallback(() => {
    pinchStart.current = scale.current;
  }, []);

  const onPinch = useCallback(
    (e: { nativeEvent: { scale: number; focalX: number; focalY: number } }) => {
      const newScale = clamp(pinchStart.current * e.nativeEvent.scale, 1, 4);
      const ratio = newScale / scale.current;
      const bound = (newScale - 1) * 240;
      tx.current = clamp(e.nativeEvent.focalX - (e.nativeEvent.focalX - tx.current) * ratio, -bound, bound);
      ty.current = clamp(e.nativeEvent.focalY - (e.nativeEvent.focalY - ty.current) * ratio, -bound, bound);
      scale.current = newScale;
      scaleVal.setValue(newScale);
      txVal.setValue(tx.current);
      tyVal.setValue(ty.current);
    },
    [scaleVal, txVal, tyVal],
  );

  const onPanBegan = useCallback(() => {
    panStart.current = { x: tx.current, y: ty.current };
  }, []);

  const onPan = useCallback(
    (e: { nativeEvent: { translationX: number; translationY: number } }) => {
      const bound = (scale.current - 1) * 240;
      tx.current = clamp(panStart.current.x + e.nativeEvent.translationX, -bound, bound);
      ty.current = clamp(panStart.current.y + e.nativeEvent.translationY, -bound, bound);
      txVal.setValue(tx.current);
      tyVal.setValue(ty.current);
    },
    [txVal, tyVal],
  );

  return (
    <PanGestureHandler
      ref={panRef}
      minPointers={2}
      maxPointers={2}
      simultaneousHandlers={pinchRef}
      onGestureEvent={onPan}
      onHandlerStateChange={(e) => {
        if (e.nativeEvent.state === State.BEGAN) onPanBegan();
      }}
    >
      <PinchGestureHandler
        ref={pinchRef}
        simultaneousHandlers={panRef}
        onGestureEvent={onPinch}
        onHandlerStateChange={(e) => {
          if (e.nativeEvent.state === State.BEGAN) onPinchBegan();
        }}
      >
        <Animated.View
          style={[
            { flex: 1 },
            { transform: [{ translateX: txVal }, { translateY: tyVal }, { scale: scaleVal }] },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </PinchGestureHandler>
    </PanGestureHandler>
  );
}

interface PlanCanvasProps {
  uri: string;
  aspect: number;
  start: Point | null;
  end: Point | null;
  pathColor: string;
  rotated?: boolean;
  onSetStart: Dispatch<SetStateAction<Point | null>>;
  onSetEnd: Dispatch<SetStateAction<Point | null>>;
  onPlace: (p: Point) => void;
  onDoubleTap?: () => void;
  style?: object;
}

function PlanCanvas({
  uri,
  aspect,
  start,
  end,
  pathColor,
  rotated,
  onSetStart,
  onSetEnd,
  onPlace,
  onDoubleTap,
  style,
}: PlanCanvasProps) {
  const [width, setWidth] = useState(0);
  const height = aspect > 0 && width > 0 ? width / aspect : 0;
  const lastTapAt = useRef(0);

  // Refs are read/mutated only inside PanResponder event handlers (never during render),
  // so the react-hooks/refs heuristic is a false positive here.
  /* eslint-disable react-hooks/refs */
  const lastDrag = useRef({ start: { dx: 0, dy: 0 }, end: { dx: 0, dy: 0 } });

  const startPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          lastDrag.current.start.dx = 0;
          lastDrag.current.start.dy = 0;
        },
        onPanResponderMove: (_evt, g) => {
          if (!width || !height) return;
          let dx = g.dx - lastDrag.current.start.dx;
          let dy = g.dy - lastDrag.current.start.dy;
          lastDrag.current.start.dx = g.dx;
          lastDrag.current.start.dy = g.dy;
          if (rotated) {
            const tmp = dx;
            dx = dy;
            dy = -tmp;
          }
          if (dx === 0 && dy === 0) return;
          onSetStart((p) => (p ? clampPoint({ x: p.x + dx / width, y: p.y + dy / height }) : p));
        },
      }).panHandlers,
    [width, height, onSetStart, rotated],
  );
  const endPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          lastDrag.current.end.dx = 0;
          lastDrag.current.end.dy = 0;
        },
        onPanResponderMove: (_evt, g) => {
          if (!width || !height) return;
          let dx = g.dx - lastDrag.current.end.dx;
          let dy = g.dy - lastDrag.current.end.dy;
          lastDrag.current.end.dx = g.dx;
          lastDrag.current.end.dy = g.dy;
          if (rotated) {
            const tmp = dx;
            dx = dy;
            dy = -tmp;
          }
          if (dx === 0 && dy === 0) return;
          onSetEnd((p) => (p ? clampPoint({ x: p.x + dx / width, y: p.y + dy / height }) : p));
        },
      }).panHandlers,
    [width, height, onSetEnd, rotated],
  );
/* eslint-enable react-hooks/refs */

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const onTap = useCallback(
    (evt: GestureResponderEvent) => {
      const now = Date.now();
      if (now - lastTapAt.current < 350) {
        lastTapAt.current = 0;
        onDoubleTap?.();
        return;
      }
      lastTapAt.current = now;
      if (!width || !height) return;
      const { locationX, locationY } = evt.nativeEvent;
      onPlace(clampPoint({ x: locationX / width, y: locationY / height }));
    },
    [width, height, onPlace, onDoubleTap],
  );

  if (!width || !height) {
    return <View style={style} onLayout={onLayout} collapsable={false} />;
  }

  const sx = start ? start.x * width : 0;
  const sy = start ? start.y * height : 0;
  const ex = end ? end.x * width : sx;
  const ey = end ? end.y * height : sy;
  const angle = Math.atan2(ey - sy, ex - sx);
  const lineLen = Math.hypot(ex - sx, ey - sy);
  const headEnd = end ? arrowHeadPoints(ex, ey, angle) : [];
  const px = (pp: Point) => `${pp.x.toFixed(1)},${pp.y.toFixed(1)}`;

  return (
    <View style={style} onLayout={onLayout} collapsable={false}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap}>
        <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
      </Pressable>

      {start && end && lineLen > 0 && (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height}>
          <Line
            x1={sx}
            y1={sy}
            x2={ex}
            y2={ey}
            stroke={pathColor}
            strokeWidth={15}
            strokeLinecap="round"
            opacity={0.22}
          />
          <Line
            x1={sx}
            y1={sy}
            x2={ex}
            y2={ey}
            stroke={pathColor}
            strokeWidth={2}
            strokeDasharray="3 8"
            strokeLinecap="round"
            opacity={0.95}
          />
          <Polygon points={`${ex},${ey} ${px(headEnd[0])} ${px(headEnd[1])}`} fill={pathColor} opacity={0.95} />
        </Svg>
      )}

      {start && (
        <View
          {...startPan}
          style={[styles.marker, { left: start.x * width - DRAG / 2, top: start.y * height - DRAG / 2 }]}
        >
          <View style={[styles.markerPin, styles.markerPinQueen, { borderColor: START_COLOR }]}>
            {QUEEN_ICON ? (
              <Image source={QUEEN_ICON} style={styles.markerImage} resizeMode="cover" />
            ) : (
              <Ionicons name="person" size={10} color={START_COLOR} />
            )}
          </View>
        </View>
      )}
      {end && (
        <View
          {...endPan}
          style={[
            styles.marker,
            {
              left: end.x * width - DRAG / 2 + (lineLen > 0 ? Math.cos(angle) * 10 : 0),
              top: end.y * height - DRAG / 2 + (lineLen > 0 ? Math.sin(angle) * 10 : 0),
            },
          ]}
        >
          <View style={[styles.markerPin, { borderColor: END_COLOR }]}>
            <Ionicons name="locate" size={10} color={END_COLOR} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  editor: {
    flex: 1,
    paddingHorizontal: Spacing.base,
  },
  fullContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullBottomBar: {
    backgroundColor: Colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  fullHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fullHintKicker: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingTop: 1,
  },
  fullHint: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  fullBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fullControlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
  },
  fullControlBtnPrimary: {
    backgroundColor: Colors.accent,
  },
  fullBtnText: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  fullBtnTextPrimary: {
    color: Colors.bg,
  },
  fullBtnDisabled: {
    opacity: 0.4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingBottom: 156,
  },
  header: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  toolIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  toolBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  toolBtnDisabled: {
    opacity: 0.35,
  },
  toolBtnGhost: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toolText: {
    fontSize: 14,
    color: Colors.bg,
    fontWeight: '700',
    letterSpacing: 0,
  },
  toolTextGhost: {
    color: Colors.textPrimary,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCardHover,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    opacity: 0.85,
  },
  iconBtnDanger: {
    backgroundColor: ERROR_COLOR + '20',
  },
  iconBtnDisabled: {
    opacity: 0.35,
  },
  paletteCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  paletteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paletteHeaderEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  swatchLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  swatchHex: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  swatchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swatchOptionActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  hintText: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  canvas: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  canvasPending: {
    minHeight: 320,
    backgroundColor: Colors.bgCard,
  },
  canvasInner: {
    flex: 1,
  },
  bottomToolbar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  marker: {
    position: 'absolute',
    width: DRAG,
    height: DRAG,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPin: {
    width: MARKER,
    height: MARKER,
    borderRadius: Radius.full,
    borderWidth: 2,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPinQueen: {
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,10,0.8)',
  },
  markerImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.full,
  },
  uploadZone: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.bgSubtle,
  },
  uploadIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  uploadTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  uploadHint: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  uploadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  uploadChipText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '700',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  bottomBtn: {
    alignSelf: 'center',
  },
  primaryBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '700',
  },
  noteCard: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
  },
  tipsKicker: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSubtle,
    marginTop: 1,
  },
  tipInfo: {
    flex: 1,
    gap: 2,
  },
  tipTitle: {
    ...Typography.footnote,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  tipText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  noteTitle: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  noteLine: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  noteBullet: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    lineHeight: 20,
  },
  noteBody: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});