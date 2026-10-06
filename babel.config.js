module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Do NOT manually add react-native-reanimated/plugin or react-native-worklets/plugin here.
    // babel-preset-expo automatically adds react-native-worklets/plugin when
    // react-native-worklets is installed (Expo SDK 54 + Reanimated 4.x setup).
    // Adding it again causes a double-transform that breaks Metro's dependency collector.
  };
};
