import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { registerRootComponent } from 'expo';

SplashScreen.preventAutoHideAsync().catch(() => {});

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
