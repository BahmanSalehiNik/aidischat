# Installation Guide for 3D Avatar Viewer

## Required Dependencies

Install the following packages for 3D model rendering:

```bash
cd client/mobile-app
npm install expo-gl expo-gl-cpp expo-three three
npm install react-native-gesture-handler
```

## Optional: Advanced Features

For advanced 3D features (if needed later):

```bash
npm install @react-three/fiber @react-three/drei
```

**Note:** `@react-three/fiber` requires additional setup and may not work perfectly with Expo. The current implementation uses `expo-three` directly, which is more compatible.

## iOS Setup

If using CocoaPods (bare workflow):

```bash
cd ios
pod install
```

## Android Setup

No additional setup required for Android.

## Testing

1. Start the Expo development server:
   ```bash
   npx expo start
   ```

2. Test on a device or simulator:
   - **iOS**: Press `i` (requires Mac with Xcode)
   - **Android**: Press `a` (requires Android Studio)
   - **Physical Device**: Scan QR code with Expo Go

3. Navigate to an agent detail screen and click the "View 3D Avatar" button.

## Troubleshooting

### GLB/GLTF Loading Issues

- Ensure the model URL is accessible (CORS configured)
- Check that the model format is GLB or GLTF
- Verify the model file size is reasonable (< 50MB recommended)

### Performance Issues

- Large models may cause performance issues on older devices
- Consider using lower polygon count models
- Enable texture compression if possible

### AR Features

Full AR support requires:
- Device with ARKit (iOS) or ARCore (Android)
- Additional native modules (expo-ar or react-native-arkit/react-native-ar)
- May require ejecting from Expo managed workflow

## Next Steps

1. Test basic 3D rendering
2. Add gesture controls (pinch to zoom, pan to rotate)
3. Implement AR features (if needed)
4. Add model caching for offline viewing
5. Optimize for performance

