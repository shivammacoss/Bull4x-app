import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { Image } from 'react-native';
import { API_BASE_URL, API_URL } from '../config';

const { height } = Dimensions.get('window');
const AUTH_URL = `${API_URL}/auth`;

function parseJsonSafe(text) {
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

const SignupScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleSignup = async () => {
    if (!formData.firstName || !formData.email || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const email = formData.email.trim().toLowerCase();
    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      let response;
      try {
        response = await fetch(`${AUTH_URL}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            email,
            address: '—',
            countryCode: '+1',
          }),
          signal: controller.signal,
        });
      } catch (e) {
        if (e.name === 'AbortError') {
          throw new Error(
            `Request timed out.\nAPI: ${API_URL}\n\nCheck internet, API_BASE_URL in .env, and that https://api.bull4x.com is reachable.`
          );
        }
        if (e.message === 'Network request failed') {
          throw new Error(
            `Cannot reach server.\nUsing: ${API_BASE_URL}\n\n` +
              `• Confirm API_BASE_URL in .env (e.g. https://api.bull4x.com).\n` +
              `• For local PC backend use http://10.0.2.2:PORT (emulator) or your LAN IP.\n` +
              `• Restart Metro: npx expo start -c`
          );
        }
        throw e;
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await response.text();
      const data = parseJsonSafe(text);
      if (data._raw && !data.message) {
        throw new Error(`Unexpected response (${response.status}). First line:\n${String(data._raw).slice(0, 120)}`);
      }

      if (!response.ok) {
        throw new Error(data.message || `Signup failed (${response.status})`);
      }

      await SecureStore.setItemAsync('user', JSON.stringify(data.user));
      if (data.token) {
        await SecureStore.setItemAsync('token', data.token);
      }

      navigation.replace('MainTrading');
    } catch (error) {
      Alert.alert('Signup failed', error.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/bull4x-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>Bull4X</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, styles.activeTab]}>
            <Text style={styles.activeTabText}>Sign up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.tabText}>Sign in</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start your trading journey today</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#666"
            value={formData.firstName}
            onChangeText={(text) => setFormData({ ...formData, firstName: text })}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Phone number (optional)"
            placeholderTextColor="#666"
            keyboardType="phone-pad"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry={!showPassword}
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Create account</Text>}
        </TouchableOpacity>

        <Text style={styles.terms}>
          By creating an account, you agree to our <Text style={styles.termsLink}>Terms of Service</Text>
        </Text>

        <View style={styles.signinContainer}>
          <Text style={styles.signinText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.signinLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    minHeight: height,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  brandName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#dc2626',
  },
  tabText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: '#fff',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  terms: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  termsLink: {
    color: '#dc2626',
  },
  signinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signinText: {
    color: '#666',
    fontSize: 15,
  },
  signinLink: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SignupScreen;
