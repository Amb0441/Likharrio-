import { useCallback, useState } from "react";
import { LayoutChangeEvent, useWindowDimensions } from "react-native";

/**
 * Phones stay in the mobile layout, including large phones and landscape.
 * iPad, tablet, and monitor sizes use the website layout.
 * A short landscape phone fails the height check, so it does not flip into the site.
 */
export function useLayoutMode() {
  const { width, height } = useWindowDimensions();
  const isWebsite = width >= 720 && height >= 600;
  return { isWebsite, width, height, contentWidth: width };
}

/** Width of the view this is attached to, so grids follow the page instead of the window. */
export function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  }, []);
  return { width, onLayout };
}
