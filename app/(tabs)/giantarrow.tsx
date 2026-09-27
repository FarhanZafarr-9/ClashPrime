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
  useWindowDimensions,
  type LayoutChangeEvent,
  type GestureResponderEvent,
  type ImageSourcePropType,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PressableRipple from '../../src/components/PressableRipple';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { PACKAGE_IMAGES } from '../../src/data/packageImages';
import { useDialog } from '../../src/components/AlertDialog';
import Svg, { Line, Polygon } from 'react-native-svg';
import { useShareImage } from '../../src/hooks/useShareImage';

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
const PIVOT_COLOR = '#FFB300';
const MARKER = 20;
const DRAG = 44;
const QUEEN_ICON = PACKAGE_IMAGES['Archer Queen']?.icon;
const DUKE_ICON = PACKAGE_IMAGES['Dragon Duke']?.icon;
const GA_EQUIP_ICON = PACKAGE_IMAGES['Giant Arrow']?.icon;
const RB_EQUIP_ICON = PACKAGE_IMAGES['Rocket Backpack']?.icon;

type PlanMode = 'giant-arrow' | 'rocket-backpack';
type IoniconName = keyof typeof Ionicons.glyphMap;

const MODE_KEYS: PlanMode[] = ['giant-arrow', 'rocket-backpack'];

interface ModeConfig {
  title: string;
  subtitle: string;
  emptySubtitle: string;
  shareTitle: string;
  heroIcon?: ImageSourcePropType;
  equipIcon?: ImageSourcePropType;
  emptyHint: string;
  firstPinHint: string;
  secondPinHint: string;
  dragHint: string;
  kicker: string;
  tips: { icon: IoniconName; title: string; text: string }[];
  howItWorks: string[];
}

const PLAN_MODES: Record<PlanMode, ModeConfig> = {
  'giant-arrow': {
    title: 'Giant Arrow',
    subtitle: 'Queen start → arrow target',
    emptySubtitle: 'Plan the Archer Queen skill on a base screenshot',
    shareTitle: 'Share Giant Arrow plan',
    heroIcon: QUEEN_ICON,
    equipIcon: GA_EQUIP_ICON,
    emptyHint: 'Pick a base screenshot to plan your Giant Arrow.',
    firstPinHint: 'Tap the Queen position (start).',
    secondPinHint: 'Tap where the arrow should end, then drag the pins to fine-tune.',
    dragHint: 'Drag either pin to adjust the path.',
    kicker: 'GIANT ARROW TIPS',
    tips: [
      {
        icon: 'return-down-forward-outline',
        title: 'Straight-line damage',
        text: 'The arrow flies in a line between the two pins and damages everything along its ~2-tile-wide path.',
      },
      {
        icon: 'pin-outline',
        title: 'Pin the Queen, aim the tip',
        text: 'Place the start pin on your Queen and drag the end pin toward the buildings you want to soften.',
      },
      {
        icon: 'flash-outline',
        title: 'Fewer targets, bigger hits',
        text: 'Damage is split across everything the arrow passes over — a single building on the line takes the full hit, a crowd splits it.',
      },
    ],
    howItWorks: [
      'Tap to place the start pin where the Archer Queen stands.',
      'Tap again to set where the arrow ends — the path is a straight line between the two pins.',
      'Drag either pin to fine-tune. The arrow hits buildings along a ~2 tile wide line.',
      'Your plan is saved on this device automatically.',
    ],
  },
  'rocket-backpack': {
    title: 'Rocket Backpack',
    subtitle: "Dragon Duke's dash — through the base center",
    emptySubtitle: 'Plan Dragon Duke\u2019s Rocket Backpack dash on a base screenshot',
    shareTitle: 'Share Rocket Backpack plan',
    heroIcon: DUKE_ICON,
    equipIcon: RB_EQUIP_ICON,
    emptyHint: 'Pick a base screenshot to plan a Rocket Backpack dash.',
    firstPinHint: 'Tap where Dragon Duke enters (start).',
    secondPinHint: 'Tap the base center (pivot) — the exit is placed automatically.',
    dragHint: 'Drag the Duke to aim — the line stays through the center.',
    kicker: 'ROCKET BACKPACK TIPS',
    tips: [
      {
        icon: 'rocket-outline',
        title: 'Straight-line dash',
        text: 'Dragon Duke rockets in a straight line between the two pins, scorching buildings along the path.',
      },
      {
        icon: 'locate-outline',
        title: 'Aim through the base',
        text: 'Pick the entry pin so the dash rakes across the defenses you want to burn — the line is what matters.',
      },
      {
        icon: 'flame-outline',
        title: 'Focus the fire',
        text: 'Keep the dash line narrow to concentrate the fire breath on a handful of buildings instead of splitting it.',
      },
    ],
    howItWorks: [
      'Tap to place the pivot on the base center — the dash always runs through it.',
      'Tap again to place Dragon Duke where he enters; the dash exits on the far side, mirroring across the pivot.',
      'Drag the Duke to re-aim the line, or drag the pivot to slide it while keeping its direction.',
      'Your plan is saved on this device automatically.',
    ],
  },
};

interface Point {
  x: number;
  y: number;
}

interface SavedPlan {
  uri: string;
  mode?: PlanMode;
  center?: Point | null;
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

function ModeSwitch({ mode, onSwitch }: { mode: PlanMode; onSwitch: (m: PlanMode) => void }) {
  return (
    <View style={styles.modeSwitch}>
      {MODE_KEYS.map((k) => {
        const active = mode === k;
        const cfg = PLAN_MODES[k];
        return (
          <PressableRipple
            key={k}
            onPress={() => onSwitch(k)}
            style={[styles.modeOption, active && styles.modeOptionActive]}
            accessibilityRole="button"
            accessibilityLabel={cfg.title}
          >
            <View style={styles.modeOptionIconWrap}>
              {cfg.heroIcon && <Image source={cfg.heroIcon} style={styles.modeOptionIcon} resizeMode="cover" />}
              {cfg.equipIcon && <Image source={cfg.equipIcon} style={styles.modeOptionBadge} resizeMode="cover" />}
            </View>
            <Text
              style={[styles.modeOptionText, !active && styles.modeOptionTextInactive]}
              numberOfLines={1}
            >
              {cfg.title}
            </Text>
          </PressableRipple>
        );
      })}
    </View>
  );
}

export default function GiantArrowScreen() {
  const { width: winW, height: winH } = useWindowDimensions();
  const { show, Dialog } = useDialog();
  const [uri, setUri] = useState<string | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [center, setCenter] = useState<Point | null>(null);
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState(PLAN_MODES['giant-arrow'].emptyHint);
  const [pathColor, setPathColor] = useState(PATH_COLORS[0]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mode, setMode] = useState<PlanMode>('giant-arrow');

  // Rocket Backpack: the dash is a line through the base center, so the exit is
  // the Duke's position mirrored across the pivot — derived here, never user-set.
  const derivedEnd =
    mode === 'rocket-backpack' && center && start
      ? { x: 2 * center.x - start.x, y: 2 * center.y - start.y }
      : null;
  const visualEnd = mode === 'rocket-backpack' ? derivedEnd : end;
  const hasPins = mode === 'rocket-backpack' ? Boolean(center && start) : Boolean(start && end);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
      if (!raw) return;
      try {
        const plan: SavedPlan = JSON.parse(raw);
        if (plan?.uri) {
          setUri(plan.uri);
          const restoredMode = plan.mode === 'giant-arrow' || plan.mode === 'rocket-backpack' ? plan.mode : 'giant-arrow';
          if (restoredMode !== 'giant-arrow') setMode(restoredMode);
          const hasStart = restoredMode === 'rocket-backpack'
            ? Boolean(plan.center) && Boolean(plan.start)
            : Boolean(plan.start) && Boolean(plan.end);
          setHint(hasStart ? PLAN_MODES[restoredMode].dragHint : PLAN_MODES[restoredMode].firstPinHint);
          setCenter(plan.center ?? null);
          setStart(plan.start ?? null);
          setEnd(plan.end ?? null);
          if (plan.pathColor && PATH_COLORS.includes(plan.pathColor)) setPathColor(plan.pathColor);
        }
      } catch { }
    })();
  }, []);

  const shareRef = useRef<View>(null);

  useEffect(() => {
    if (uri) Image.getSize(uri, (w, h) => setAspect(w / h), () => { });
  }, [uri]);

  useEffect(() => {
    if (uri) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ uri, mode, center, start, end: visualEnd, pathColor } as SavedPlan)).catch(() => { });
  }, [uri, mode, center, start, visualEnd, pathColor]);

  const [shareSize, setShareSize] = useState<{ width: number; height: number } | null>(null);

  const { share } = useShareImage(shareRef);

  const handleShare = useCallback(async () => {
    const err = await share({
      dialogTitle: PLAN_MODES[mode].shareTitle,
      width: shareSize?.width,
      height: shareSize?.height,
      errorMessage: 'Could not share the plan right now.',
    });
    if (err) setHint(err);
  }, [share, shareSize, mode]);

  const onPick = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUri(result.assets[0].uri);
    setAspect(null);
    setCenter(null);
    setStart(null);
    setEnd(null);
    setFull(false);
    setHint(PLAN_MODES[mode].firstPinHint);
  }, [mode]);

  const clearMarkers = useCallback(() => {
    setCenter(null);
    setStart(null);
    setEnd(null);
    setHint(PLAN_MODES[mode].firstPinHint);
  }, [mode]);

  const clearImage = useCallback(() => {
    show({
      title: 'Remove screenshot?',
      message: 'This clears the image and the arrow plan drawn on it.',
      actions: [
        { label: 'Cancel', onPress: () => { } },
        {
          label: 'Remove',
          destructive: true,
          onPress: () => {
            AsyncStorage.removeItem(STORAGE_KEY).catch(() => { });
            setUri(null);
            setAspect(null);
            setCenter(null);
            setStart(null);
            setEnd(null);
            setFull(false);
            setHint(PLAN_MODES[mode].emptyHint);
          },
        },
      ],
    });
  }, [show, mode]);

  const handlePlace = useCallback(
    (p: Point) => {
      if (mode === 'rocket-backpack') {
        if (!start) {
          setStart(p);
          setCenter(null);
          setEnd(null);
          setHint(PLAN_MODES[mode].secondPinHint);
        } else if (!center) {
          setCenter(p);
          setHint(PLAN_MODES[mode].dragHint);
        } else {
          // Both placed: tap again to reset and place fresh.
          setCenter(null);
          setStart(null);
          setEnd(null);
          setHint(PLAN_MODES[mode].firstPinHint);
        }
        return;
      }
      if (!start) {
        setStart(p);
        setEnd(null);
        setHint(PLAN_MODES[mode].secondPinHint);
      } else if (!end) {
        setEnd(p);
        setHint(PLAN_MODES[mode].dragHint);
      }
    },
    [start, end, center, mode],
  );

  const handleResetPivot = useCallback(() => {
    setCenter(null);
    setEnd(null);
    setHint(PLAN_MODES[mode].secondPinHint);
  }, [mode]);

  const switchMode = (next: PlanMode) => {
    if (next === mode) return;
    setMode(next);
    setCenter(null);
    setStart(null);
    setEnd(null);
    setHint(uri ? PLAN_MODES[next].firstPinHint : PLAN_MODES[next].emptyHint);
  };

  let fullW = winH;
  let fullH = fullW / (aspect ?? 1);
  if (fullH > winW) {
    fullH = winW;
    fullW = fullH * (aspect ?? 1);
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} >
        {uri && aspect != null ? (
          <View style={styles.editor}>
            <View style={styles.editorHeader}>
              <View style={styles.header}>
                <Text style={styles.title}>{PLAN_MODES[mode].title}</Text>
                <Text style={styles.subtitle}>{PLAN_MODES[mode].subtitle}</Text>
              </View>
              <View style={styles.toolIconRow}>
                <PressableRipple
                  onPress={clearMarkers}
                  disabled={!hasPins}
                  style={[styles.iconBtn, !hasPins && styles.iconBtnDisabled]}
                  hitSlop={8}
                >
                  <Ionicons name="refresh-outline" size={16} color={Colors.textPrimary} />
                </PressableRipple>
                <PressableRipple onPress={clearImage} style={[styles.iconBtn, styles.iconBtnDanger]} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={17} color={ERROR_COLOR} />
                </PressableRipple>
                <Pressable onPress={() => setFull(true)} hitSlop={8} style={styles.iconBtn}>
                  <Ionicons name="expand-outline" size={16} color={Colors.textPrimary} />
                </Pressable>
              </View>
            </View>
            <ModeSwitch mode={mode} onSwitch={switchMode} />
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
                center={mode === 'rocket-backpack' ? center : null}
                centered={mode === 'rocket-backpack'}
                start={start}
                end={visualEnd}
                pathColor={pathColor}
                startIcon={PLAN_MODES[mode].heroIcon}
                onResetCenter={handleResetPivot}
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
              <Text style={styles.tipsKicker}>{PLAN_MODES[mode].kicker}</Text>
              {PLAN_MODES[mode].tips.map((tip) => (
                <View key={tip.title} style={styles.tipRow}>
                  <View style={styles.tipIcon}>
                    <Ionicons name={tip.icon} size={16} color={Colors.warning} />
                  </View>
                  <View style={styles.tipInfo}>
                    <Text style={styles.tipTitle}>{tip.title}</Text>
                    <Text style={styles.tipText}>{tip.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.scroll}>
            <View style={styles.header}>
              <Text style={styles.title}>{PLAN_MODES[mode].title}</Text>
              <Text style={styles.subtitle}>{PLAN_MODES[mode].emptySubtitle}</Text>
            </View>
            <ModeSwitch mode={mode} onSwitch={switchMode} />
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
              {PLAN_MODES[mode].howItWorks.map((line) => (
                <View key={line} style={styles.noteLine}>
                  <Text style={styles.noteBullet}>•</Text>
                  <Text style={styles.noteBody}>{line}</Text>
                </View>
              ))}
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
                  <PlanCanvas
                    uri={uri}
                    aspect={aspect}
                    center={mode === 'rocket-backpack' ? center : null}
                    centered={mode === 'rocket-backpack'}
                    start={start}
                    end={visualEnd}
                    pathColor={pathColor}
                    startIcon={PLAN_MODES[mode].heroIcon}
                    rotated
                    onResetCenter={handleResetPivot}
                    onSetStart={setStart}
                    onSetEnd={setEnd}
                    onPlace={handlePlace}
                    style={{ flex: 1 }}
                  />
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
                    disabled={!hasPins}
                    hitSlop={4}
                    style={[styles.fullControlBtn, !hasPins && styles.fullBtnDisabled]}
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

interface PlanCanvasProps {
  uri: string;
  aspect: number;
  center?: Point | null;
  centered?: boolean;
  start: Point | null;
  end: Point | null;
  pathColor: string;
  startIcon?: ImageSourcePropType;
  rotated?: boolean;
  onResetCenter: () => void;
  onSetStart: Dispatch<SetStateAction<Point | null>>;
  onSetEnd: Dispatch<SetStateAction<Point | null>>;
  onPlace: (p: Point) => void;
  onDoubleTap?: () => void;
  style?: object;
}

function PlanCanvas({
  uri,
  aspect,
  center,
  centered,
  start,
  end,
  pathColor,
  startIcon,
  rotated,
  onResetCenter,
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
  // The pivot is not draggable (keep it simple): touching it once clears it so it
  // can be placed again. No translation — that was the source of the jerkiness.
  const pivotPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => {
          onResetCenter();
        },
        onPanResponderTerminate: () => {
          onResetCenter();
        },
      }).panHandlers,
    [onResetCenter],
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

      {centered && center && (
        <View
          {...pivotPan}
          style={[styles.marker, { left: center.x * width - DRAG / 2, top: center.y * height - DRAG / 2 }]}
        >
          <View style={[styles.pivotPin, { borderColor: PIVOT_COLOR }]}>
            <View style={[styles.pivotDot, { backgroundColor: PIVOT_COLOR }]} />
          </View>
        </View>
      )}
      {start && (
        <View
          {...startPan}
          style={[styles.marker, { left: start.x * width - DRAG / 2, top: start.y * height - DRAG / 2 }]}
        >
          <View style={[styles.markerPin, styles.markerPinStart, { borderColor: START_COLOR }]}>
            {startIcon ? (
              <Image source={startIcon} style={styles.markerImage} resizeMode="cover" />
            ) : (
              <Ionicons name="person" size={10} color={START_COLOR} />
            )}
          </View>
        </View>
      )}
      {end && (
        <View
          {...(centered ? {} : endPan)}
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
  modeSwitch: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: '50%'
  },
  modeOptionActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  modeOptionIconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionIcon: {
    width: 22,
    height: 22,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(10,10,10,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  modeOptionBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(10,10,10,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  modeOptionText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '700',
    flexShrink: 1,
  },
  modeOptionTextInactive: {
    color: Colors.textSecondary,
    fontWeight: '600',
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
    borderColor: ERROR_COLOR + '80',
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
  markerPinStart: {
    overflow: 'hidden',
    backgroundColor: 'rgba(10,10,10,0.8)',
  },
  pivotPin: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    borderWidth: 2,
    backgroundColor: 'rgba(10,10,10,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pivotDot: {
    width: 9,
    height: 9,
    borderRadius: Radius.full,
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