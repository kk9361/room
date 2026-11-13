const {
  withAndroidManifest,
  withDangerousMod,
  withGradleProperties,
} = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

module.exports = (config, { allowHttp = false } = {}) => {
  config = withGradleProperties(config, result => {
    if (process.platform === 'win32') {
      // Use Expo's supported option so its root plugin does not override CMake's
      // Windows-compatible object-path hashing limit with the 1024 default.
      result.modResults = result.modResults.filter(item => !(item.type === 'property' && item.key === 'expo.android.cmakeObjectPathMax'));
      result.modResults.push({ type: 'property', key: 'expo.android.cmakeObjectPathMax', value: '250' });
    }
    return result;
  });
  config = withDangerousMod(config, [
    "android",
    async (result) => {
      const directory = path.join(
        result.modRequest.platformProjectRoot,
        "app/src/main/res/drawable",
      );
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(
        path.join(directory, "ledger_launcher.xml"),
        '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#0D9488" android:pathData="M0,0h108v108h-108z"/><path android:fillColor="#00000000" android:strokeColor="#FFFFFF" android:strokeWidth="4" android:strokeLineJoin="round" android:pathData="M31,50L54,30L77,50L77,78L31,78zM47,78L47,57L61,57L61,78"/></vector>',
      );
      return result;
    },
  ]);
  return withAndroidManifest(config, (result) => {
    const app = result.modResults.manifest.application?.[0];
    if (app) {
      app.$["android:usesCleartextTraffic"] = String(allowHttp);
      app.$["android:icon"] = "@drawable/ledger_launcher";
      app.$["android:roundIcon"] = "@drawable/ledger_launcher";
    }
    return result;
  });
};

