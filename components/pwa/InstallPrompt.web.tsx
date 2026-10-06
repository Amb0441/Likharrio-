import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import COLORS from "../../constants/Colors";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  const install = async () => {
    await deferred.prompt();
    setDeferred(null);
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.label}>Install Likharrio on this device</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => setDeferred(null)} style={styles.dismiss}>
          <Text style={styles.dismissText}>Not now</Text>
        </Pressable>
        <Pressable onPress={install} style={styles.install}>
          <Text style={styles.installText}>Install</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 50,
    backgroundColor: COLORS.background.dark,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    flex: 1,
    color: COLORS.text.light,
    fontSize: 14,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dismiss: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dismissText: {
    color: "#C4AFA5",
    fontSize: 13,
    fontWeight: "600",
  },
  install: {
    backgroundColor: COLORS.secondary.goldenYellow,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  installText: {
    color: COLORS.background.dark,
    fontSize: 13,
    fontWeight: "700",
  },
});
