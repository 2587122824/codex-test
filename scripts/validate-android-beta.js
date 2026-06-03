const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireText(file, text, reason) {
  const content = read(file);
  if (!content.includes(text)) {
    errors.push(`${file} missing ${JSON.stringify(text)} (${reason})`);
  }
}

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

const appConfig = JSON.parse(read('app.json'));
const expo = appConfig.expo || {};

if (expo.name !== '古德眠') {
  errors.push(`app.json expo.name should be 古德眠, found ${expo.name}`);
}

if (expo.slug !== 'gudemian') {
  errors.push(`app.json expo.slug should be gudemian, found ${expo.slug}`);
}

if (expo.scheme !== 'gudemian') {
  errors.push(`app.json expo.scheme should be gudemian, found ${expo.scheme}`);
}

if (expo.orientation !== 'portrait') {
  errors.push(`app.json expo.orientation should be portrait, found ${expo.orientation}`);
}

if (expo.userInterfaceStyle !== 'automatic') {
  errors.push('app.json userInterfaceStyle should stay automatic for theme testing.');
}

if (expo.android?.package !== 'com.gudemian.app') {
  errors.push(`Android package should be com.gudemian.app, found ${expo.android?.package}`);
}

if (expo.android?.versionCode !== 1) {
  errors.push(`Internal beta versionCode should be 1 until the first APK candidate is cut, found ${expo.android?.versionCode}`);
}

const description = expo.description || '';
for (const stalePhrase of ['睡眠记录', 'sleep log', 'sleep record']) {
  if (description.toLowerCase().includes(stalePhrase.toLowerCase())) {
    errors.push(`app.json description contains stale removed feature wording: ${stalePhrase}`);
  }
}

for (const expectedPhrase of ['本地优先', 'AI 助眠推荐', '定时关闭', '可选账号同步']) {
  if (!description.includes(expectedPhrase)) {
    errors.push(`app.json description should mention current beta scope phrase: ${expectedPhrase}`);
  }
}

const appPermissions = expo.android?.permissions || [];
if (appPermissions.length !== 1 || appPermissions[0] !== 'WAKE_LOCK') {
  errors.push(`app.json android.permissions should only declare WAKE_LOCK, found ${JSON.stringify(appPermissions)}`);
}

for (const assetPath of [
  expo.icon,
  expo.android?.adaptiveIcon?.foregroundImage,
  expo.android?.adaptiveIcon?.backgroundImage,
  expo.android?.adaptiveIcon?.monochromeImage,
  expo.web?.favicon,
].filter(Boolean)) {
  requireFile(assetPath.replace(/^\.\//, ''));
}

requireText('android/app/build.gradle', "namespace 'com.gudemian.app'", 'native namespace must match Expo package');
requireText('android/app/build.gradle', "applicationId 'com.gudemian.app'", 'native applicationId must match Expo package');
requireText('android/app/build.gradle', 'versionCode 1', 'native versionCode should match app.json');
requireText('android/app/build.gradle', 'versionName "1.0.0"', 'native versionName should match app.json');
requireText('android/app/build.gradle', 'signingConfig signingConfigs.debug', 'internal beta release currently uses temporary debug signing');
requireText('android/app/src/main/AndroidManifest.xml', 'android:screenOrientation="portrait"', 'Android beta should stay portrait-only');
requireText('android/app/src/main/AndroidManifest.xml', 'android.permission.WAKE_LOCK', 'sleep timer/audio playback needs wake lock permission');
requireText('android/app/src/main/res/values/strings.xml', '<string name="app_name">古德眠</string>', 'launcher label should match product name');

for (const requiredPath of [
  'android/gradlew.bat',
  'android/gradle/wrapper/gradle-wrapper.jar',
  'android/app/src/main/java/com/gudemian/app/MainActivity.kt',
  'android/app/src/main/java/com/gudemian/app/MainApplication.kt',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_background.webp',
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_monochrome.webp',
]) {
  requireFile(requiredPath);
}

if (errors.length > 0) {
  console.error('Android beta validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Android beta validation passed: app metadata, package config, icon resources, and internal signing state are ready for APK smoke.');
