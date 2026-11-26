// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*'],
  },
  {
    // RN <Text> ichida ' xavfsiz (HTML emas); o'zbekcha matnda apostrof juda ko'p
    rules: { 'react/no-unescaped-entities': 'off' },
  },
]);
