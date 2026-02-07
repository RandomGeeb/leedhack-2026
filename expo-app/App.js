import { useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import * as FileSystem from 'expo-file-system';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Flow: 'back' → 'front' → 'preview'
const STEP_BACK = 'back';
const STEP_FRONT = 'front';
const STEP_PREVIEW = 'preview';

export default function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const backDevice = useCameraDevice('back');
  const frontDevice = useCameraDevice('front');
  const cameraRef = useRef(null);

  const [step, setStep] = useState(STEP_BACK);
  const [backPhotoPath, setBackPhotoPath] = useState(null);
  const [frontPhotoPath, setFrontPhotoPath] = useState(null);
  const [backBase64, setBackBase64] = useState(null);
  const [frontBase64, setFrontBase64] = useState(null);
  const [sending, setSending] = useState(false);
  const pendingFront = useRef(false);

  // Auto-snap selfie once the front camera initialises
  const onInitialized = useCallback(async () => {
    if (!pendingFront.current || !cameraRef.current) return;
    pendingFront.current = false;
    try {
      await new Promise((r) => setTimeout(r, 400));
      const photo = await cameraRef.current.takePhoto();
      setFrontPhotoPath(photo.path);
      setStep(STEP_PREVIEW);
    } catch {
      // If auto-snap fails, let user retry
      setStep(STEP_BACK);
      setBackPhotoPath(null);
    }
  }, []);

  // Permission screen
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need camera access to continue.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant permission</Text>
        </TouchableOpacity>
        <StatusBar style="light" />
      </View>
    );
  }

  const device = step === STEP_FRONT ? frontDevice : backDevice;

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>No camera device found.</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  async function readAsBase64(path) {
    try {
      const uri = path.startsWith('file://') ? path : `file://${path}`;
      return await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      // Fallback: try reading via fetch + blob
      const resp = await fetch(path.startsWith('file://') ? path : `file://${path}`);
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          // strip "data:...;base64," prefix
          resolve(result.split(',')[1] || result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  }

  async function handleCapture() {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePhoto();
      const photoPath = photo.path;

      if (step === STEP_BACK) {
        setBackPhotoPath(photoPath);
        // Switch to front camera — onInitialized will auto-snap
        pendingFront.current = true;
        setStep(STEP_FRONT);
      }
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not take photo');
    }
  }

  function handleRetake() {
    setBackPhotoPath(null);
    setFrontPhotoPath(null);
    setBackBase64(null);
    setFrontBase64(null);
    setStep(STEP_BACK);
  }

  async function handleSend() {
    if (!backPhotoPath || !frontPhotoPath) return;
    setSending(true);
    try {
      // Convert to base64 at send time
      const [back64, front64] = await Promise.all([
        readAsBase64(backPhotoPath),
        readAsBase64(frontPhotoPath),
      ]);

      setBackBase64(back64);
      setFrontBase64(front64);

      const payload = {
        backImage: back64,
        frontImage: front64,
        timestamp: new Date().toISOString(),
      };

      // TODO: Replace with your actual backend URL
      // await fetch('https://your-backend.com/api/upload', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });

      console.log(
        'Payload ready — backImage length:',
        payload.backImage.length,
        'frontImage length:',
        payload.frontImage.length,
      );
      Alert.alert('Ready!', 'Both images encoded as base64 and ready to send.');
    } catch (e) {
      Alert.alert('Send failed', e?.message ?? 'Unknown error');
    } finally {
      setSending(false);
    }
  }

  // ──── Preview screen ────
  if (step === STEP_PREVIEW && backPhotoPath && frontPhotoPath) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />

        {/* Back photo full screen */}
        <Image source={{ uri: `file://${backPhotoPath}` }} style={styles.previewMain} />

        {/* Front photo PIP */}
        <View style={styles.previewPip}>
          <Image source={{ uri: `file://${frontPhotoPath}` }} style={styles.previewPipImage} />
        </View>

        {/* Bottom actions */}
        <View style={styles.previewBottomBar}>
          <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
            <Text style={styles.retakeButtonText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ──── Camera screen (back or front) ────
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {step === STEP_FRONT && backPhotoPath ? (
        <>
          {/* Show frozen back photo while selfie is being captured */}
          <Image source={{ uri: `file://${backPhotoPath}` }} style={styles.camera} />
          <View style={styles.capturingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.capturingText}>Loading...</Text>
          </View>
          {/* Hidden camera for auto-snap */}
          <Camera
            ref={cameraRef}
            style={styles.hiddenCamera}
            device={device}
            isActive={true}
            photo={true}
            onInitialized={onInitialized}
          />
        </>
      ) : (
        <>
          {/* Step indicator */}
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>Take a photo</Text>
          </View>

          <Camera
            ref={cameraRef}
            style={styles.camera}
            device={device}
            isActive={step === STEP_BACK}
            photo={true}
          />

          {/* Shutter */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  message: {
    flex: 1,
    color: '#fff',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: 24,
    fontSize: 16,
    marginTop: '50%',
  },
  permissionButton: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: '50%',
  },
  permissionButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Camera screen ──
  stepIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 36,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  stepText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  hiddenCamera: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  miniPip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 86,
    right: 16,
    width: SCREEN_WIDTH * 0.25,
    height: SCREEN_WIDTH * 0.25 * 1.33,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  miniPipImage: {
    flex: 1,
    width: '100%',
  },
  capturingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  capturingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },

  // ── Preview screen ──
  previewMain: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  previewPip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 36,
    right: 16,
    width: SCREEN_WIDTH * 0.3,
    height: SCREEN_WIDTH * 0.3 * 1.33,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#111',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  previewPipImage: {
    flex: 1,
    width: '100%',
  },
  previewBottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 32,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  retakeButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  retakeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  sendButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 24,
    backgroundColor: '#5B21B6',
    minWidth: 100,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
