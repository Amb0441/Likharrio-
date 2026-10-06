// responsive.ts - Place this file in your project root or utils folder
import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 11 Pro)
const baseWidth = 375;
const baseHeight = 812;

/**
 * Scale size based on screen width
 */
const scaleWidth = (size: number): number => {
  return (SCREEN_WIDTH / baseWidth) * size;
};

/**
 * Scale size based on screen height
 */
const scaleHeight = (size: number): number => {
  return (SCREEN_HEIGHT / baseHeight) * size;
};

/**
 * Moderate scale - less aggressive scaling
 */
const moderateScale = (size: number, factor: number = 0.5): number => {
  return size + (scaleWidth(size) - size) * factor;
};

/**
 * Scale font size
 */
const scaleFontSize = (size: number): number => {
  const scale = SCREEN_WIDTH / baseWidth;
  const newSize = size * scale;
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
  }
  return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
};

/**
 * Get responsive padding
 */
const getResponsivePadding = (): number => {
  if (SCREEN_WIDTH < 360) {
    return 16; // Small phones
  } else if (SCREEN_WIDTH < 400) {
    return 20; // Medium phones
  } else if (SCREEN_WIDTH < 768) {
    return 24; // Large phones
  } else {
    return 32; // Tablets
  }
};

/**
 * Check if device is tablet
 */
const isTablet = (): boolean => {
  const aspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
  return SCREEN_WIDTH >= 768 || (aspectRatio < 1.6 && SCREEN_WIDTH >= 600);
};

/**
 * Check if device is small phone
 */
const isSmallDevice = (): boolean => {
  return SCREEN_WIDTH < 375;
};

/**
 * Get number of columns for grid layout
 */
const getGridColumns = (): number => {
  if (SCREEN_WIDTH < 360) {
    return 1;
  } else if (SCREEN_WIDTH < 768) {
    return 2;
  } else if (SCREEN_WIDTH < 1024) {
    return 3;
  } else {
    return 4;
  }
};

/**
 * Get responsive dimensions
 */
const responsiveDimensions = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  padding: getResponsivePadding(),
  isTablet: isTablet(),
  isSmall: isSmallDevice(),
};

/**
 * Create responsive stylesheet helper
 */
const createResponsiveStyle = <T extends Record<string, any>>(
  styles: T,
  tabletStyles?: Partial<T>,
  smallStyles?: Partial<T>
): T => {
  if (isSmallDevice() && smallStyles) {
    return { ...styles, ...smallStyles };
  }
  if (isTablet() && tabletStyles) {
    return { ...styles, ...tabletStyles };
  }
  return styles;
};

export {
    createResponsiveStyle, getGridColumns, getResponsivePadding, isSmallDevice, isTablet, moderateScale, responsiveDimensions, scaleFontSize, scaleHeight, scaleWidth, SCREEN_HEIGHT, SCREEN_WIDTH
};
