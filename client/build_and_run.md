# 1. Build Unity APK (IMPORTANT: Save to LOCAL PC directory, NOT device storage)
# Unity Editor → Build Settings → Build
# Choose LOCAL folder: ~/Downloads/UnityAR.apk (or any local PC folder)
# ⚠️ DO NOT select Android device storage (MTP mount) - this causes build errors

# 2. Install APK on device
adb install ~/Downloads/UnityAR.apk
# OR transfer first, then install:
adb push ~/Downloads/UnityAR.apk /sdcard/Download/
# Then install from device using file manager

# 3. Build React Native
cd client/mobile-app
npm run android  # Installs automatically

# Troubleshooting:
# If you get "ERROR_NOT_SUPPORTED" or MTP path errors:
# - Disconnect/unmount Android device from file manager
# - Build to local PC directory only
# - Install APK separately using adb