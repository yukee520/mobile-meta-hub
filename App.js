import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

const GITHUB_USERNAME = 'yukee520';
const TEMPLATE_REPO = 'mobile-meta-hub-template';

export default function App() {
  const [githubToken, setGithubToken] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [activeRepo, setActiveRepo] = useState('');
  const [code, setCode] = useState(`import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Hello from My Custom App!</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
});`);

  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  const handleCreateNewProject = async () => {
    if (!githubToken.trim()) {
      Alert.alert('Error', 'Please enter your GitHub Personal Access Token.');
      return;
    }
    if (!newRepoName.trim()) {
      Alert.alert('Error', 'Please enter a project repository name.');
      return;
    }

    const cleanRepoName = newRepoName.trim().replace(/\s+/g, '-');
    setLoading(true);
    setStatusText(`Creating repo '${cleanRepoName}' from template...`);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${TEMPLATE_REPO}/generate`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${githubToken.trim()}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            owner: GITHUB_USERNAME,
            name: cleanRepoName,
            description: `Generated via Mobile Meta Hub`,
            private: false,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 201) {
        setActiveRepo(cleanRepoName);
        Alert.alert(
          'Success!',
          `Repository '${cleanRepoName}' created! You can now write your app code below.`
        );
      } else {
        Alert.alert('Error Creating Repo', data.message || 'Failed to create repo.');
      }
    } catch (error) {
      Alert.alert('Network Error', error.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleSaveAndPush = async () => {
    if (!activeRepo) {
      Alert.alert('Error', 'No active repository selected or created.');
      return;
    }

    setLoading(true);
    setStatusText(`Pushing updated App.js to ${activeRepo}...`);

    try {
      const fileUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${activeRepo}/contents/App.js`;
      const getFileRes = await fetch(fileUrl, {
        headers: { Authorization: `token ${githubToken.trim()}` },
      });

      let fileSha = '';
      if (getFileRes.status === 200) {
        const fileData = await getFileRes.json();
        fileSha = fileData.sha;
      }

      const encodedContent = btoa(unescape(encodeURIComponent(code)));

      const updateRes = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${githubToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Update App.js via Mobile Meta Hub IDE',
          content: encodedContent,
          sha: fileSha ? fileSha : undefined,
        }),
      });

      if (updateRes.status === 200 || updateRes.status === 201) {
        Alert.alert(
          'Pushed Successfully!',
          `Your code has been pushed to '${activeRepo}'. GitHub Actions is now compiling your APK!`
        );
      } else {
        const errData = await updateRes.json();
        Alert.alert('Push Failed', errData.message || 'Could not commit code.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>Mobile Meta Hub IDE</Text>

        <View style={styles.card}>
          <Text style={styles.label}>GitHub Personal Access Token:</Text>
          <TextInput
            style={styles.input}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            secureTextEntry
            value={githubToken}
            onChangeText={setGithubToken}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>1. Create New Project Repo:</Text>
          <TextInput
            style={styles.input}
            placeholder="New Project Name (e.g., Sun34)"
            value={newRepoName}
            onChangeText={setNewRepoName}
          />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleCreateNewProject}
            disabled={loading}>
            <Text style={styles.btnText}>Duplicate Template & Create Repo</Text>
          </TouchableOpacity>
        </View>

        {activeRepo ? (
          <View style={styles.activeRepoBadge}>
            <Text style={styles.activeRepoText}>Active Repo: {activeRepo}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>2. Write App.js Code:</Text>
          <TextInput
            style={styles.codeArea}
            multiline
            numberOfLines={18}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.btnSuccess, !activeRepo && styles.btnDisabled]}
            onPress={handleSaveAndPush}
            disabled={loading || !activeRepo}>
            <Text style={styles.btnText}>Save, Push & Build APK</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>{statusText}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  scrollContent: { padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', color: '#172B4D', marginBottom: 16, textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, marginBottom: 16, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 6, padding: 10, fontSize: 14, marginBottom: 12 },
  codeArea: { borderWidth: 1, borderColor: '#CCC', borderRadius: 6, padding: 10, fontFamily: 'monospace', fontSize: 13, backgroundColor: '#1E1E1E', color: '#00FF66', height: 280, textAlignVertical: 'top', marginBottom: 12 },
  btnPrimary: { backgroundColor: '#0052CC', padding: 12, borderRadius: 6, alignItems: 'center' },
  btnSuccess: { backgroundColor: '#36B37E', padding: 12, borderRadius: 6, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#A5ADBA' },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  activeRepoBadge: { backgroundColor: '#DEEBFF', padding: 10, borderRadius: 6, marginBottom: 16, alignItems: 'center' },
  activeRepoText: { color: '#0052CC', fontWeight: 'bold', fontSize: 14 },
  loadingContainer: { marginTop: 10, alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#0052CC', fontSize: 13 },
});
