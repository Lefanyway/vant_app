module.exports = ({ config }) => ({
  ...config,
  plugins: config.plugins.map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "expo-router") {
      return ["expo-router", { ...plugin[1], origin: process.env.PUBLIC_WEB_ORIGIN || plugin[1].origin }];
    }
    return plugin;
  }),
});
