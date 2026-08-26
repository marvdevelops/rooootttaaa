// Converted from app.json to app.config.js so the Google Sign-In iOS URL
// scheme (a native build-time value, not an EXPO_PUBLIC_ runtime var) can be
// read from the environment during `eas build` / `expo prebuild`.
const fs = require('fs');
const path = require('path');

// Only present once Firebase (Android push/FCM) is set up — omitted until
// then so the build doesn't fail looking for a file that doesn't exist yet.
const hasGoogleServicesFile = fs.existsSync(path.join(__dirname, 'google-services.json'));

module.exports = {
  expo: {
    name: 'Rootah',
    slug: 'RunMap',
    scheme: 'rootah',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'app.rootah.waypoint',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Rootah uses your location to center the map on your current position. Location access is optional — you can still build and browse routes without it.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Rootah tracks your location during a run or ride, even when the screen is off.',
        NSLocationAlwaysUsageDescription:
          'Rootah tracks your location during a run or ride, even when the screen is off.',
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['remote-notification', 'location'],
      },
    },
    android: {
      package: 'app.rootah.waypoint',
      adaptiveIcon: {
        backgroundColor: '#F39120',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      ...(hasGoogleServicesFile ? { googleServicesFile: './google-services.json' } : {}),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-sharing',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Rootah tracks your location during a run or ride, even when the screen is off.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      'expo-sqlite',
      'expo-task-manager',
      'expo-font',
      'expo-document-picker',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 220,
          resizeMode: 'contain',
          backgroundColor: '#1A1614',
        },
      ],
      '@rnmapbox/maps',
      [
        'expo-image-picker',
        {
          photosPermission: 'Rootah needs access to your photos to set a profile picture.',
        },
      ],
      '@react-native-community/datetimepicker',
      'expo-apple-authentication',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#EC4624',
        },
      ],
      [
        'expo-calendar',
        {
          calendarPermission: 'Rootah uses your calendar to add events you RSVP to.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission: 'Rootah needs access to your photos to save flyby videos to your camera roll.',
          savePhotosPermission: 'Rootah needs access to your photos to save flyby videos to your camera roll.',
        },
      ],
      // GOOGLE_IOS_URL_SCHEME is the *reversed* iOS OAuth client ID from Google
      // Cloud Console (e.g. "com.googleusercontent.apps.1234-abc"), set as an
      // EAS build-time env var. The plugin errors on an empty string, so it's
      // omitted entirely until set — Google Sign-In still autolinks and works
      // on Android in the meantime, just not iOS.
      process.env.GOOGLE_IOS_URL_SCHEME
        ? ['@react-native-google-signin/google-signin', { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME }]
        : '@react-native-google-signin/google-signin',
    ],
    extra: {
      eas: {
        projectId: '55a758ec-61f7-47e4-a502-f606f0278765',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/55a758ec-61f7-47e4-a502-f606f0278765',
    },
  },
};
