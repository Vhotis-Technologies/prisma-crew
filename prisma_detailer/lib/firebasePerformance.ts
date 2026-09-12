import { NativeModules, Platform } from "react-native";

type PerfTrace = {
  stop: () => Promise<void>;
  putAttribute: (attribute: string, value: string) => void;
  putMetric: (metricName: string, value: number) => void;
};

type PerfModule = {
  (): {
    dataCollectionEnabled: boolean;
    startTrace: (name: string) => Promise<PerfTrace>;
  };
};

let initialized = false;

/** Lazily load RNFB perf only when the native app module is present. */
function getPerf(): PerfModule | null {
  if (!NativeModules.RNFBAppModule) return null;
  try {
    // Native package throws at require-time when RNFBAppModule is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-firebase/perf").default as PerfModule;
  } catch {
    return null;
  }
}

/**
 * Enable Firebase Performance Monitoring on Android (dev and release).
 * No-ops when the native Firebase module is not linked (e.g. Expo Go / stale build).
 */
export async function initFirebasePerformance(): Promise<void> {
  if (Platform.OS !== "android" || initialized) return;

  const perf = getPerf();
  if (!perf) {
    if (__DEV__) {
      console.warn(
        "[Firebase Performance] native module not available; skipping init",
      );
    }
    return;
  }

  initialized = true;
  try {
    perf().dataCollectionEnabled = true;
  } catch (error) {
    initialized = false;
    if (__DEV__) {
      console.warn("[Firebase Performance] init failed:", error);
    }
  }
}

/** Start a custom performance trace (Android only). */
export async function startPerfTrace(name: string): Promise<PerfTrace | null> {
  if (Platform.OS !== "android") return null;
  const perf = getPerf();
  if (!perf) return null;
  try {
    return await perf().startTrace(name);
  } catch {
    return null;
  }
}
