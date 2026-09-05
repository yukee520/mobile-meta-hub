import React from 'react';
import { StyleSheet, StatusBar, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Environment Execution Error</Text>
          <Text style={styles.errorSub}>{this.state.error?.toString()}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export const SafeWrapper = ({ children }) => (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="light-content" backgroundColor="#121212" />
    <ErrorBoundary>{children}</ErrorBoundary>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#ff5252', fontSize: 18, fontWeight: 'bold' },
  errorSub: { color: '#a0a0a0', marginTop: 8, textAlign: 'center' },
});
