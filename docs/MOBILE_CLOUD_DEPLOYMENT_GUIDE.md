# Mobile App Cloud Deployment & Testing Guide

## Overview

This guide covers setting up cloud-based builds, CI/CD pipelines, and device distribution for testing ViroReact/ARKit apps on iOS and Android devices.

---

## Architecture Overview

```
┌─────────────────┐
│   Git Repo      │
│  (GitHub/GitLab)│
└────────┬────────┘
         │
         │ Push/PR
         ▼
┌─────────────────┐
│  CI/CD Pipeline │
│ (GitHub Actions)│
└────────┬────────┘
         │
         ├─► Build iOS (EAS Build)
         │
         └─► Build Android (EAS Build)
              │
              ▼
    ┌─────────────────┐
    │  Distribution    │
    │  - TestFlight    │
    │  - Firebase      │
    │  - EAS Submit    │
    └─────────────────┘
              │
              ▼
    ┌─────────────────┐
    │  Test Devices   │
    │  - iOS          │
    │  - Android      │
    └─────────────────┘
```

---

## Prerequisites

### Required Accounts

1. **Expo Account** (free tier available)
   - Sign up at: https://expo.dev
   - Required for EAS Build

2. **Apple Developer Account** ($99/year)
   - Required for iOS builds and TestFlight
   - Sign up at: https://developer.apple.com

3. **Google Play Console** ($25 one-time)
   - Required for Android builds
   - Sign up at: https://play.google.com/console

4. **Firebase Account** (free tier available)
   - Optional: For Firebase App Distribution
   - Sign up at: https://firebase.google.com

### Required Tools

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Install Expo CLI (if not already installed)
npm install -g expo-cli

# Verify installations
eas --version
expo --version
```

---

## Step 1: Project Setup

### 1.1 Initialize EAS in Your Project

```bash
cd client/mobile-app

# Login to Expo
eas login

# Initialize EAS
eas build:configure
```

This creates `eas.json` configuration file.

### 1.2 Install ViroReact (if not already installed)

```bash
npm install @reactvision/react-viro
```

**Note**: ViroReact requires native modules, so you'll need development builds (not Expo Go).

---

## Step 2: Environment Configuration

### 2.1 Create Environment Files

Create separate environment files for each environment:

```bash
# Development
touch .env.development

# Staging
touch .env.staging

# Production
touch .env.production
```

### 2.2 Configure Environment Variables

**.env.development**:
```env
# API Configuration
API_BASE_URL=https://dev-api.yourdomain.com
WS_URL=wss://dev-api.yourdomain.com/api/realtime

# Environment
ENV=development
APP_ENV=dev

# Feature Flags
ENABLE_AR=true
ENABLE_VIRO=true

# Debug
DEBUG=true
```

**.env.staging**:
```env
# API Configuration
API_BASE_URL=https://staging-api.yourdomain.com
WS_URL=wss://staging-api.yourdomain.com/api/realtime

# Environment
ENV=staging
APP_ENV=staging

# Feature Flags
ENABLE_AR=true
ENABLE_VIRO=true

# Debug
DEBUG=false
```

**.env.production**:
```env
# API Configuration
API_BASE_URL=https://api.yourdomain.com
WS_URL=wss://api.yourdomain.com/api/realtime

# Environment
ENV=production
APP_ENV=production

# Feature Flags
ENABLE_AR=true
ENABLE_VIRO=true

# Debug
DEBUG=false
```

### 2.3 Update app.json/app.config.js

Create or update `app.config.js` to support multiple environments:

```javascript
// app.config.js
import 'dotenv/config';

const IS_DEV = process.env.APP_ENV === 'development';

export default {
  expo: {
    name: IS_DEV ? 'AI Chat Dev' : 'AI Chat',
    slug: 'ai-chat-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    assetBundlePatterns: [
      '**/*'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV 
        ? 'com.yourcompany.aichat.dev' 
        : 'com.yourcompany.aichat',
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription: 'This app needs camera access for AR features',
        NSMicrophoneUsageDescription: 'This app needs microphone access for voice features',
        NSLocationWhenInUseUsageDescription: 'This app needs location for AR features'
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      package: IS_DEV 
        ? 'com.yourcompany.aichat.dev' 
        : 'com.yourcompany.aichat',
      versionCode: 1,
      permissions: [
        'CAMERA',
        'RECORD_AUDIO',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION'
      ]
    },
    plugins: [
      'expo-camera',
      'expo-av',
      '@reactvision/react-viro',
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '13.0'
          },
          android: {
            compileSdkVersion: 33,
            targetSdkVersion: 33,
            minSdkVersion: 24
          }
        }
      ]
    ],
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
      wsUrl: process.env.WS_URL,
      env: process.env.APP_ENV,
      enableAR: process.env.ENABLE_AR === 'true',
      enableViro: process.env.ENABLE_VIRO === 'true',
      debug: process.env.DEBUG === 'true'
    }
  }
};
```

### 2.4 Install Environment Dependencies

```bash
npm install --save-dev dotenv
npm install expo-build-properties
```

---

## Step 3: EAS Build Configuration

### 3.1 Create eas.json

Create `eas.json` in `client/mobile-app/`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Debug"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      },
      "env": {
        "APP_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "APP_ENV": "staging"
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "aab"
      },
      "env": {
        "APP_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-email@example.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "your-team-id"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### 3.2 Configure Build Secrets

Set environment variables in EAS:

```bash
# Development
eas secret:create --scope project --name API_BASE_URL --value https://dev-api.yourdomain.com --type string
eas secret:create --scope project --name WS_URL --value wss://dev-api.yourdomain.com/api/realtime --type string

# Staging
eas secret:create --scope project --name API_BASE_URL_STAGING --value https://staging-api.yourdomain.com --type string

# Production
eas secret:create --scope project --name API_BASE_URL_PROD --value https://api.yourdomain.com --type string
```

---

## Step 4: Apple Developer Setup (iOS)

### 4.1 Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - Platform: iOS
   - Name: AI Chat
   - Primary Language: English
   - Bundle ID: `com.yourcompany.aichat` (must match app.json)
   - SKU: `aichat-ios-001`

### 4.2 Configure Certificates and Profiles

EAS Build can automatically manage certificates, but you can also do it manually:

```bash
# Let EAS handle it automatically (recommended)
eas credentials

# Or manually configure
eas credentials --platform ios
```

### 4.3 Enable TestFlight

1. In App Store Connect, go to your app
2. Navigate to "TestFlight" tab
3. Add internal testers (up to 100)
4. Add external testers (requires App Review for first build)

---

## Step 5: Google Play Console Setup (Android)

### 5.1 Create App in Play Console

1. Go to https://play.google.com/console
2. Click "Create app"
3. Fill in:
   - App name: AI Chat
   - Default language: English
   - App or game: App
   - Free or paid: Free

### 5.2 Create Service Account

1. Go to Play Console → Setup → API access
2. Click "Create new service account"
3. Follow instructions to create service account
4. Download JSON key file → save as `google-service-account.json`
5. Grant access to your app in Play Console

### 5.3 Set Up Internal Testing Track

1. Go to Play Console → Testing → Internal testing
2. Create internal testing track
3. Add testers (email addresses)

---

## Step 6: CI/CD Pipeline Setup (GitHub Actions)

### 6.1 Create GitHub Actions Workflow

Create `.github/workflows/mobile-build.yml`:

```yaml
name: Mobile App Build & Deploy

on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'client/mobile-app/**'
  pull_request:
    branches:
      - main
      - develop
    paths:
      - 'client/mobile-app/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to build'
        required: true
        default: 'development'
        type: choice
        options:
          - development
          - preview
          - production
      platform:
        description: 'Platform to build'
        required: true
        default: 'all'
        type: choice
        options:
          - all
          - ios
          - android

env:
  EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
  APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      mobile-app: ${{ steps.filter.outputs.mobile-app }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            mobile-app:
              - 'client/mobile-app/**'

  build-ios-dev:
    needs: detect-changes
    if: needs.detect-changes.outputs.mobile-app == 'true'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: client/mobile-app/package-lock.json
      
      - name: Install EAS CLI
        run: npm install -g eas-cli
      
      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Install dependencies
        working-directory: client/mobile-app
        run: npm ci
      
      - name: Load environment variables
        working-directory: client/mobile-app
        run: |
          echo "APP_ENV=development" >> .env
          echo "API_BASE_URL=${{ secrets.API_BASE_URL_DEV }}" >> .env
          echo "WS_URL=${{ secrets.WS_URL_DEV }}" >> .env
      
      - name: Build iOS (Development)
        working-directory: client/mobile-app
        run: eas build --platform ios --profile development --non-interactive
      
      - name: Download build artifact
        uses: actions/download-artifact@v3
        if: always()
      
      - name: Upload to TestFlight (optional)
        if: github.ref == 'refs/heads/develop'
        working-directory: client/mobile-app
        run: eas submit --platform ios --latest --non-interactive

  build-android-dev:
    needs: detect-changes
    if: needs.detect-changes.outputs.mobile-app == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: client/mobile-app/package-lock.json
      
      - name: Install EAS CLI
        run: npm install -g eas-cli
      
      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Install dependencies
        working-directory: client/mobile-app
        run: npm ci
      
      - name: Load environment variables
        working-directory: client/mobile-app
        run: |
          echo "APP_ENV=development" >> .env
          echo "API_BASE_URL=${{ secrets.API_BASE_URL_DEV }}" >> .env
          echo "WS_URL=${{ secrets.WS_URL_DEV }}" >> .env
      
      - name: Build Android (Development)
        working-directory: client/mobile-app
        run: eas build --platform android --profile development --non-interactive
      
      - name: Upload to Firebase App Distribution
        if: github.ref == 'refs/heads/develop'
        uses: wzieba/Firebase-Distribution-Github-Action@v1
        with:
          appId: ${{ secrets.FIREBASE_ANDROID_APP_ID }}
          token: ${{ secrets.FIREBASE_TOKEN }}
          groups: testers
          file: app-release.apk

  build-production:
    needs: detect-changes
    if: |
      needs.detect-changes.outputs.mobile-app == 'true' &&
      (github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    strategy:
      matrix:
        platform: [ios, android]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: client/mobile-app/package-lock.json
      
      - name: Install EAS CLI
        run: npm install -g eas-cli
      
      - name: Setup Expo
        uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Install dependencies
        working-directory: client/mobile-app
        run: npm ci
      
      - name: Load environment variables
        working-directory: client/mobile-app
        run: |
          echo "APP_ENV=production" >> .env
          echo "API_BASE_URL=${{ secrets.API_BASE_URL_PROD }}" >> .env
          echo "WS_URL=${{ secrets.WS_URL_PROD }}" >> .env
      
      - name: Build for ${{ matrix.platform }}
        working-directory: client/mobile-app
        run: eas build --platform ${{ matrix.platform }} --profile production --non-interactive
      
      - name: Submit to stores
        if: github.ref == 'refs/heads/main'
        working-directory: client/mobile-app
        run: eas submit --platform ${{ matrix.platform }} --latest --non-interactive
```

### 6.2 Configure GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions, and add:

**Required Secrets**:
- `EXPO_TOKEN` - Get from https://expo.dev/accounts/[account]/settings/access-tokens
- `APPLE_ID` - Your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` - Generate at https://appleid.apple.com
- `APPLE_TEAM_ID` - Your Apple Developer Team ID
- `API_BASE_URL_DEV` - Development API URL
- `WS_URL_DEV` - Development WebSocket URL
- `API_BASE_URL_PROD` - Production API URL
- `WS_URL_PROD` - Production WebSocket URL

**Optional Secrets** (for Firebase):
- `FIREBASE_TOKEN` - Firebase CI token
- `FIREBASE_ANDROID_APP_ID` - Firebase Android app ID

---

## Step 7: Firebase App Distribution (Android)

### 7.1 Set Up Firebase Project

1. Go to https://console.firebase.google.com
2. Create new project or use existing
3. Add Android app:
   - Package name: `com.yourcompany.aichat.dev`
   - Download `google-services.json`

### 7.2 Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login:ci
```

### 7.3 Configure Firebase Distribution

Add to your workflow (see Step 6.1 for full example):

```yaml
- name: Upload to Firebase App Distribution
  uses: wzieba/Firebase-Distribution-Github-Action@v1
  with:
    appId: ${{ secrets.FIREBASE_ANDROID_APP_ID }}
    token: ${{ secrets.FIREBASE_TOKEN }}
    groups: testers
    file: app-release.apk
```

---

## Step 8: Manual Build & Test Workflow

### 8.1 Build Development Version Locally

```bash
cd client/mobile-app

# iOS
eas build --platform ios --profile development --local

# Android
eas build --platform android --profile development --local
```

### 8.2 Build in Cloud

```bash
# iOS
eas build --platform ios --profile development

# Android
eas build --platform android --profile development
```

### 8.3 Install on Device

**iOS**:
1. Build completes → Get download link from EAS
2. Open link on iOS device
3. Install via TestFlight or direct download

**Android**:
1. Build completes → Get download link from EAS
2. Download APK on Android device
3. Enable "Install from unknown sources"
4. Install APK

### 8.4 Submit to TestFlight/Play Console

```bash
# iOS - Submit to TestFlight
eas submit --platform ios --latest

# Android - Submit to Play Console
eas submit --platform android --latest
```

---

## Step 9: Testing Workflow

### 9.1 Development Testing

1. **Push to `develop` branch** → Triggers development build
2. **Build completes** → Get download link
3. **Install on device** → Test AR features
4. **Report issues** → Create GitHub issue

### 9.2 Staging Testing

1. **Merge to `main` branch** → Triggers preview build
2. **Build completes** → Uploaded to TestFlight/Firebase
3. **Testers notified** → Install and test
4. **Collect feedback** → Via TestFlight/Firebase

### 9.3 Production Release

1. **Tag release** → `git tag v1.0.0 && git push --tags`
2. **Build production** → Manual trigger or auto
3. **Submit to stores** → TestFlight (iOS) / Internal Testing (Android)
4. **Beta testing** → External testers
5. **Release** → Submit for review

---

## Step 10: Monitoring & Debugging

### 10.1 EAS Build Status

Monitor builds at: https://expo.dev/accounts/[account]/projects/[project]/builds

### 10.2 TestFlight Analytics

- Go to App Store Connect → TestFlight
- View crash reports, feedback, analytics

### 10.3 Firebase Crashlytics

Add to your app:

```bash
npm install @react-native-firebase/crashlytics
```

Configure in `app.config.js`:

```javascript
plugins: [
  '@react-native-firebase/crashlytics'
]
```

---

## Troubleshooting

### Common Issues

1. **Build fails with "No credentials"**
   ```bash
   eas credentials
   ```

2. **ViroReact not working**
   - Ensure you're using development build (not Expo Go)
   - Check native modules are properly linked

3. **Environment variables not loading**
   - Check `.env` file exists
   - Verify `app.config.js` loads dotenv
   - Check EAS secrets are set

4. **TestFlight upload fails**
   - Verify Apple credentials
   - Check app is created in App Store Connect
   - Ensure bundle ID matches

---

## Cost Estimation

### Free Tier (Development)

- **EAS Build**: 30 builds/month free
- **TestFlight**: Free (up to 10,000 testers)
- **Firebase App Distribution**: Free
- **GitHub Actions**: 2,000 minutes/month free

### Paid (Production)

- **EAS Build**: $29/month (unlimited builds)
- **Apple Developer**: $99/year
- **Google Play**: $25 one-time
- **GitHub Actions**: $0.008/minute after free tier

---

## Next Steps

1. ✅ Set up EAS account and configure project
2. ✅ Configure environments (dev, staging, prod)
3. ✅ Set up GitHub Actions workflow
4. ✅ Configure Apple Developer account
5. ✅ Configure Google Play Console
6. ✅ Create first development build
7. ✅ Test on physical devices
8. ✅ Set up distribution channels
9. ✅ Automate with CI/CD

---

## References

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [GitHub Actions for Expo](https://docs.expo.dev/build/building-on-ci/)
- [ViroReact Setup](https://docs.viromedia.com/docs/getting-started)
- [TestFlight Guide](https://developer.apple.com/testflight/)
- [Firebase App Distribution](https://firebase.google.com/docs/app-distribution)
