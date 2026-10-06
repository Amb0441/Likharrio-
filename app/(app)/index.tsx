import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function AppIndex() {
  useEffect(() => {
    router.replace("/(auth)/welcome");
  }, []);

  return <View />;
}
