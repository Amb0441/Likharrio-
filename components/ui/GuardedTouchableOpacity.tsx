import { useRef } from "react";
import { TouchableOpacity, type TouchableOpacityProps } from "react-native";

const TAP_DEBOUNCE_MS = 800;

interface GuardedTouchableOpacityProps extends TouchableOpacityProps {
  guardDelay?: number;
}

export default function GuardedTouchableOpacity({
  onPress,
  guardDelay = TAP_DEBOUNCE_MS,
  ...props
}: GuardedTouchableOpacityProps) {
  const guardRef = useRef(false);

  const handlePress = (e: any) => {
    if (guardRef.current) return;
    guardRef.current = true;
    onPress?.(e);
    setTimeout(() => {
      guardRef.current = false;
    }, guardDelay);
  };

  return <TouchableOpacity onPress={handlePress} {...props} />;
}
