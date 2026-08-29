// Installs global.crypto.getRandomValues (Hermes has no Web Crypto). Must run
// before anything that generates a security token — see src/utils/secureToken.
import 'react-native-get-random-values';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
