import { Mixpanel } from 'mixpanel-react-native';

const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

// Mixpanel's SDK wraps native iOS/Android modules — like RevenueCat, it must
// be present in the compiled binary and can't be turned on for
// already-installed builds via an OTA update; this guard just keeps a
// missing token from crashing dev/preview builds that predate it.
let mixpanel: Mixpanel | null = null;
let ready: Promise<void> | null = null;

function getInstance(): Mixpanel | null {
  if (!token) return null;
  if (!mixpanel) {
    mixpanel = new Mixpanel(token, true);
    ready = mixpanel.init();
  }
  return mixpanel;
}

async function withInstance(fn: (m: Mixpanel) => void) {
  const m = getInstance();
  if (!m) return;
  if (ready) await ready;
  fn(m);
}

export function identifyUser(userId: string) {
  withInstance((m) => m.identify(userId));
}

export function setUserProfile(props: Record<string, string | number | boolean>) {
  withInstance((m) => m.getPeople().set(props));
}

export function resetUser() {
  withInstance((m) => m.reset());
}

export function track(event: string, props?: Record<string, unknown>) {
  withInstance((m) => m.track(event, props));
}
