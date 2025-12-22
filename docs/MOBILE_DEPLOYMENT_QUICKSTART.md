# Mobile Deployment Quick Start Checklist

## 🚀 Setup Checklist

### Phase 1: Initial Setup (30 minutes)

- [ ] **Create Expo Account**
  ```bash
  # Sign up at https://expo.dev
  # Then login
  eas login
  ```

- [ ] **Install Tools**
  ```bash
  npm install -g eas-cli expo-cli
  ```

- [ ] **Initialize EAS in Project**
  ```bash
  cd client/mobile-app
  eas build:configure
  ```

- [ ] **Verify eas.json Created**
  - Check that `client/mobile-app/eas.json` exists

### Phase 2: Environment Configuration (20 minutes)

- [ ] **Create Environment Files**
  ```bash
  cd client/mobile-app
  touch .env.development .env.staging .env.production
  ```

- [ ] **Configure .env.development**
  - Add API URLs
  - Add feature flags
  - See guide for template

- [ ] **Update app.config.js**
  - Add environment variable loading
  - Configure bundle IDs per environment
  - Add ViroReact plugin

- [ ] **Install Dependencies**
  ```bash
  npm install --save-dev dotenv
  npm install expo-build-properties
  ```

### Phase 3: Apple Developer Setup (iOS) (1 hour)

- [ ] **Create Apple Developer Account**
  - Sign up at https://developer.apple.com ($99/year)

- [ ] **Create App in App Store Connect**
  - Go to https://appstoreconnect.apple.com
  - Create new app
  - Note Bundle ID (must match app.json)

- [ ] **Configure EAS Credentials**
  ```bash
  eas credentials --platform ios
  # Let EAS handle certificates automatically
  ```

- [ ] **Enable TestFlight**
  - In App Store Connect → TestFlight tab
  - Add internal testers

### Phase 4: Google Play Setup (Android) (30 minutes)

- [ ] **Create Google Play Console Account**
  - Sign up at https://play.google.com/console ($25 one-time)

- [ ] **Create App in Play Console**
  - Create new app
  - Note package name (must match app.json)

- [ ] **Create Service Account**
  - Play Console → Setup → API access
  - Create service account
  - Download JSON key → save as `google-service-account.json`

- [ ] **Set Up Internal Testing**
  - Play Console → Testing → Internal testing
  - Add testers

### Phase 5: CI/CD Setup (30 minutes)

- [ ] **Create GitHub Actions Workflow**
  - File created: `.github/workflows/mobile-build.yml`
  - Verify it exists

- [ ] **Configure GitHub Secrets**
  Go to: Repo → Settings → Secrets and variables → Actions
  
  Add these secrets:
  - [ ] `EXPO_TOKEN` - Get from https://expo.dev/accounts/[account]/settings/access-tokens
  - [ ] `APPLE_ID` - Your Apple ID email
  - [ ] `APPLE_APP_SPECIFIC_PASSWORD` - Generate at https://appleid.apple.com
  - [ ] `APPLE_TEAM_ID` - Your Apple Developer Team ID
  - [ ] `API_BASE_URL_DEV` - Development API URL
  - [ ] `WS_URL_DEV` - Development WebSocket URL
  - [ ] `API_BASE_URL_PROD` - Production API URL (optional for now)
  - [ ] `WS_URL_PROD` - Production WebSocket URL (optional for now)

### Phase 6: First Build & Test (30 minutes)

- [ ] **Test Local Build (Optional)**
  ```bash
  cd client/mobile-app
  eas build --platform ios --profile development --local
  ```

- [ ] **Create Cloud Build**
  ```bash
  # iOS
  eas build --platform ios --profile development
  
  # Android
  eas build --platform android --profile development
  ```

- [ ] **Wait for Build to Complete**
  - Monitor at: https://expo.dev/accounts/[account]/projects/[project]/builds
  - Usually takes 10-20 minutes

- [ ] **Download & Install on Device**
  - iOS: Get link from EAS, install via TestFlight or direct download
  - Android: Download APK, enable "Install from unknown sources", install

- [ ] **Test AR Features**
  - Verify ViroReact works
  - Test AR camera
  - Test animations

### Phase 7: Automated Testing (15 minutes)

- [ ] **Push to Develop Branch**
  ```bash
  git checkout -b develop
  git push origin develop
  ```

- [ ] **Verify CI/CD Triggers**
  - Check GitHub Actions tab
  - Verify build starts automatically

- [ ] **Check Build Status**
  - Monitor EAS builds
  - Check for errors

- [ ] **Verify Distribution**
  - iOS: Check TestFlight
  - Android: Check Firebase (if configured)

## 🎯 Daily Workflow

### Development

1. **Make Changes**
   ```bash
   git checkout -b feature/my-feature
   # Make changes
   git commit -m "Add feature"
   git push
   ```

2. **Create PR to Develop**
   - PR triggers preview build
   - Review build artifacts

3. **Merge to Develop**
   - Triggers development build
   - Auto-deploys to testers

### Testing

1. **Get Build Link**
   - From EAS dashboard
   - Or from GitHub Actions artifacts

2. **Install on Device**
   - iOS: TestFlight or direct link
   - Android: APK download

3. **Test & Report**
   - Test AR features
   - Report bugs via GitHub issues

### Release

1. **Merge to Main**
   ```bash
   git checkout main
   git merge develop
   git push
   ```

2. **Production Build**
   - Auto-triggers on main branch
   - Or manually via workflow_dispatch

3. **Submit to Stores**
   - Auto-submits to TestFlight/Play Console
   - Or manually: `eas submit --platform ios --latest`

## 🔧 Troubleshooting

### Build Fails

```bash
# Check build logs
eas build:list

# View specific build
eas build:view [build-id]

# Retry build
eas build --platform ios --profile development
```

### Credentials Issues

```bash
# Reset credentials
eas credentials --platform ios

# Let EAS manage automatically (recommended)
```

### Environment Variables Not Loading

1. Check `.env` file exists
2. Verify `app.config.js` loads dotenv
3. Check EAS secrets are set
4. Rebuild after changes

### ViroReact Not Working

1. Ensure using development build (not Expo Go)
2. Check native modules are linked
3. Verify plugin in `app.config.js`
4. Rebuild after adding plugin

## 📊 Monitoring

### Build Status

- **EAS Dashboard**: https://expo.dev/accounts/[account]/projects/[project]/builds
- **GitHub Actions**: Repo → Actions tab

### TestFlight Analytics

- **App Store Connect**: https://appstoreconnect.apple.com
- View crash reports, feedback, analytics

### Firebase Analytics (if configured)

- **Firebase Console**: https://console.firebase.google.com
- View distribution, crash reports

## 💰 Cost Tracking

### Free Tier Limits

- EAS Build: 30 builds/month
- GitHub Actions: 2,000 minutes/month
- TestFlight: Free (up to 10,000 testers)

### When to Upgrade

- **EAS Build**: If > 30 builds/month → $29/month
- **GitHub Actions**: If > 2,000 minutes/month → $0.008/minute

## ✅ Success Criteria

You're ready when:

- [x] Can build iOS app in cloud
- [x] Can build Android app in cloud
- [x] Can install on physical devices
- [x] AR features work on devices
- [x] CI/CD automatically builds on push
- [x] Can distribute to testers
- [x] Can submit to stores

## 🆘 Getting Help

- **EAS Docs**: https://docs.expo.dev/build/introduction/
- **Expo Discord**: https://chat.expo.dev
- **GitHub Issues**: Create issue in your repo
- **EAS Support**: support@expo.dev

## 📝 Next Steps After Setup

1. **Add More Environments**
   - Staging environment
   - Production environment

2. **Set Up Crash Reporting**
   - Firebase Crashlytics
   - Sentry

3. **Add Analytics**
   - Firebase Analytics
   - Mixpanel
   - Amplitude

4. **Automate Testing**
   - Unit tests
   - Integration tests
   - E2E tests

5. **Set Up Notifications**
   - Build completion notifications
   - TestFlight release notifications
