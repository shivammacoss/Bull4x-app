import React, { useLayoutEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

import SignupScreen from './src/screens/SignupScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MainTradingScreen from './src/screens/MainTradingScreen';
import WalletScreen from './src/screens/WalletScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SupportScreen from './src/screens/SupportScreen';
import CopyTradeScreen from './src/screens/CopyTradeScreen';
import IBScreen from './src/screens/IBScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import OrderBookScreen from './src/screens/OrderBookScreen';
import InstructionsScreen from './src/screens/InstructionsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ChallengeRulesScreen from './src/screens/ChallengeRulesScreen';
import BuyChallengeScreen from './src/screens/BuyChallengeScreen';

const Stack = createNativeStackNavigator();
const { width: SCREEN_W } = Dimensions.get('window');

// Inner app component that can use theme
const AppContent = () => {
  const { colors, isDark } = useTheme();
  
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPrimary }
        }}
      >
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="MainTrading" component={MainTradingScreen} />
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Support" component={SupportScreen} />
        <Stack.Screen name="CopyTrade" component={CopyTradeScreen} />
        <Stack.Screen name="IB" component={IBScreen} />
        <Stack.Screen name="Accounts" component={AccountsScreen} />
        <Stack.Screen name="OrderBook" component={OrderBookScreen} />
        <Stack.Screen name="Instructions" component={InstructionsScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ChallengeRules" component={ChallengeRulesScreen} />
        <Stack.Screen name="BuyChallenge" component={BuyChallengeScreen} />
      </Stack.Navigator>
    </>
  );
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useLayoutEffect(() => {
    let cancelled = false;
    SplashScreen.hideAsync()
      .then(() => new Promise((r) => setTimeout(r, 200)))
      .then(() => {
        if (!cancelled) setShowSplash(false);
      })
      .catch(() => {
        if (!cancelled) setShowSplash(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
      {showSplash ? (
        <View style={styles.flashOverlay}>
          <Image
            source={require('./assets/splash-bull4x.png')}
            style={styles.flashLogo}
            resizeMode="contain"
          />
        </View>
      ) : null}
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NavigationContainer
            theme={{
              dark: true,
              colors: {
                primary: '#d4af37',
                background: '#000000',
                card: '#000000',
                text: '#ffffff',
                border: '#1a1a1a',
                notification: '#d4af37',
              },
              fonts: {
                regular: { fontFamily: 'System', fontWeight: '400' },
                medium: { fontFamily: 'System', fontWeight: '500' },
                bold: { fontFamily: 'System', fontWeight: '700' },
                heavy: { fontFamily: 'System', fontWeight: '900' },
              },
            }}
          >
            <AppContent />
            </NavigationContainer>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashLogo: {
    width: Math.min(SCREEN_W * 0.72, 320),
    height: Math.min(SCREEN_W * 0.72, 320),
  },
});
