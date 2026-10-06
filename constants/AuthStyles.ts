/**
 * AuthStyles.ts
 * Shared design tokens & style factories for all (auth) screens.
 * Import what you need — no screen should define its own bg, arc, or pattern styles.
 */

import { StyleSheet } from 'react-native';

// ─── Brand Tokens ────────────────────────────────────────────────────────────
export const T = {
  // Backgrounds
  bgDeep:   '#1A0505',
  bgMid:    '#3D0E0E',
  bgTop:    '#7A1212',

  // Reds
  red:      '#8B1A1A',
  redFaint: '#FFF0F0',
  redBorder:'rgba(139,26,26,0.2)',

  // Gold
  gold:        '#C9A84C',
  goldFaint:   'rgba(201,168,76,0.13)',
  goldBorder:  'rgba(201,168,76,0.14)',
  goldText:    'rgba(201,168,76,0.85)',
  goldTextDim: 'rgba(201,168,76,0.4)',

  // Surface
  cream:    '#FAF7F2',
  white:    '#fff',

  // Text
  textDark:    '#2A1005',
  textMid:     '#4A3829',
  textMuted:   '#9B8265',
  textLight:   '#FAF3E8',
  textFaint:   'rgba(250,243,232,0.55)',

  // Borders & inputs
  border:     '#E0D5C7',
  inputBg:    '#fff',
  inputText:  '#2A1005',

  // Radius
  rCard: 18,
  rPanel: 32,
  rBtn: 14,
  rInput: 12,
  rChip: 22,

  // Spacing
  panelPH: 28,
  panelPT: 32,
  panelPB: 44,
};

// ─── Shared full-screen background ──────────────────────────────────────────
export const bgStyles = StyleSheet.create({
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: T.bgDeep },
  bgMid: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
    backgroundColor: T.bgMid, opacity: 0.75,
    borderTopLeftRadius: 300, borderTopRightRadius: 100,
  },
  bgTop: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
    backgroundColor: T.bgTop, opacity: 0.5, borderTopLeftRadius: 200,
  },
  arcOuter: {
    position: 'absolute', top: -90, right: -90, width: 260, height: 260,
    borderRadius: 130, borderWidth: 1.5, borderColor: T.goldBorder,
  },
  arcInner: {
    position: 'absolute', top: -52, right: -52, width: 175, height: 175,
    borderRadius: 88, borderWidth: 1, borderColor: 'rgba(201,168,76,0.10)',
  },
  bottomBand: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: 'rgba(201,168,76,0.55)',
  },
});

// ─── Textile pattern diamond tile ────────────────────────────────────────────
export const patternDiamond = StyleSheet.create({
  diamond: {
    position: 'absolute', width: 36, height: 36,
    borderWidth: 1.5, borderColor: T.goldFaint,
    transform: [{ rotate: '45deg' }],
  },
});

// ─── Shared panel (white card that slides up from the bottom) ────────────────
export const panelStyle = StyleSheet.create({
  panel: {
    backgroundColor: T.cream,
    borderTopLeftRadius: T.rPanel,
    borderTopRightRadius: T.rPanel,
    paddingHorizontal: T.panelPH,
    paddingTop: T.panelPT,
    paddingBottom: T.panelPB,
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
});

// ─── Common form elements ─────────────────────────────────────────────────────
export const formStyles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: T.textMid },
  hint:  { fontSize: 12, color: T.textMuted, fontStyle: 'italic', marginTop: 4 },
  input: {
    backgroundColor: T.inputBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: T.rInput,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: T.border,
    color: T.inputText,
  },
  // Chip row (gender / art interests)
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: T.rChip,
    borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.white,
  },
  chipOn:      { backgroundColor: T.red, borderColor: T.red },
  chipText:    { fontSize: 12, fontWeight: '600', color: '#6B5946' },
  chipTextOn:  { color: T.white },
  chipIcon:    { fontSize: 13 },
  chipCheck:   { fontSize: 10, color: T.white, fontWeight: '800' },
});

// ─── Shared button styles ─────────────────────────────────────────────────────
export const btnStyles = StyleSheet.create({
  // Gold CTA
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.gold,
    borderRadius: T.rBtn,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: T.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  primaryBtnText: { color: T.bgDeep, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // White / outlined Google button
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.white,
    borderRadius: T.rBtn,
    paddingVertical: 15,
    gap: 12,
    borderWidth: 1.5, borderColor: T.border,
    elevation: 2,
  },
  googleIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: T.red,
    justifyContent: 'center', alignItems: 'center',
  },
  googleIconText: { color: T.white, fontSize: 13, fontWeight: '800', lineHeight: 16 },
  googleBtnText:  { fontSize: 15, fontWeight: '600', color: T.textDark },

  // Red outlined Sign-In button
  outlineBtn: {
    borderWidth: 2, borderColor: T.red,
    paddingVertical: 14, borderRadius: T.rBtn, alignItems: 'center',
  },
  outlineBtnText: { color: T.red, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  // Disabled state
  disabled: { opacity: 0.5 },

  // Divider row
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: T.border },
  dividerLabel: { fontSize: 12, color: T.textMuted, fontWeight: '500' },

  // Ghost back link
  backBtn: {
    paddingTop: 52, paddingHorizontal: 24, paddingBottom: 4, alignSelf: 'flex-start',
  },
  backBtnText: { color: 'rgba(201,168,76,0.85)', fontSize: 14, fontWeight: '600' },

  // Inline text link footer
  footerRow: { alignItems: 'center', paddingVertical: 4 },
  footerText: { fontSize: 13, color: '#8B7355', fontWeight: '500' },
  footerLink: { color: T.red, fontWeight: '700' },
});

// ─── Icon circle (used in set-name & verify-email) ───────────────────────────
export const iconStyles = StyleSheet.create({
  iconOuter: {
    position: 'relative', marginBottom: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: T.redFaint,
    justifyContent: 'center', alignItems: 'center', zIndex: 2,
  },
  ring: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 1.5, borderColor: T.redBorder, zIndex: 1,
  },
});

// ─── Hero text (dark screen top section) ─────────────────────────────────────
export const heroStyles = StyleSheet.create({
  taglineRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  taglineLine: { width: 32, height: 1, backgroundColor: T.goldTextDim },
  taglineText: { color: T.goldText, fontSize: 10, fontWeight: '600', letterSpacing: 3 },
  heroTitle:   { fontSize: 30, fontWeight: '800', color: T.textLight, letterSpacing: -0.5, lineHeight: 38 },
  heroSub:     { fontSize: 14, color: T.textFaint, letterSpacing: 0.2 },
});
