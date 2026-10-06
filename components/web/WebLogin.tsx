import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import LikharrioLogo from "../ui/LikharrioLogo";

type Props = {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: () => void;
  onForgot: () => void;
  onSignUp: () => void;
  onBack: () => void;
};

export default function WebLogin(props: Props) {
  const busy = props.loading;

  return (
    <View style={styles.page}>
      <View style={styles.nav}>
        <Pressable onPress={props.onBack} style={styles.brand}>
          <LikharrioLogo size={28} variant="light" showWordmark={false} showTagline={false} />
          <Text style={styles.brandName}>Likharrio</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.sub}>Use the email on your Likharrio account.</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={props.email}
            onChangeText={props.onChangeEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#B8A99A"
            editable={!busy}
          />

          <View style={styles.labelRow}>
            <Text style={styles.label}>Password</Text>
            <Pressable onPress={props.onForgot} disabled={busy}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>
          </View>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              value={props.password}
              onChangeText={props.onChangePassword}
              secureTextEntry={!props.showPassword}
              placeholder="Your password"
              placeholderTextColor="#B8A99A"
              autoCapitalize="none"
              editable={!busy}
            />
            <Pressable onPress={props.onTogglePassword} style={styles.eye}>
              <Ionicons
                name={props.showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#9B8265"
              />
            </Pressable>
          </View>

          <Pressable onPress={props.onSubmit} disabled={busy} style={styles.submit}>
            {props.loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Sign in</Text>
            )}
          </Pressable>

          <Pressable onPress={props.onSignUp} disabled={busy}>
            <Text style={styles.footer}>
              New here? <Text style={styles.footerLink}>Create an account</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  nav: {
    height: 72,
    paddingHorizontal: 40,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2A1005",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    padding: 28,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2A1005",
  },
  sub: {
    color: "#6B5946",
    marginBottom: 8,
  },
  google: {
    borderWidth: 1,
    borderColor: "#E4D5C4",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  googleText: {
    fontWeight: "700",
    color: "#2A1005",
  },
  or: {
    textAlign: "center",
    color: "#9B8265",
    marginVertical: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4A3829",
    marginTop: 4,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgot: {
    color: "#8B1A1A",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E4D5C4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#2A1005",
    backgroundColor: "#FFFcf8",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E4D5C4",
    borderRadius: 12,
    backgroundColor: "#FFFcf8",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#2A1005",
  },
  eye: {
    paddingHorizontal: 12,
  },
  submit: {
    marginTop: 8,
    backgroundColor: "#8B1A1A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  footer: {
    textAlign: "center",
    marginTop: 8,
    color: "#6B5946",
  },
  footerLink: {
    color: "#8B1A1A",
    fontWeight: "800",
  },
});
