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

const DEFAULT_FILES = {
  'App.js': `import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Complex App Architecture</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' }
});`,
  'package.json': `{
  "name": "App",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "android": "react-native run-android",
    "start": "react-native start"
  },
  "dependencies": {
    "react": "18.3.1",
    "react-native": "0.76.5"
  }
}`
};

export default function App() {
  const [githubToken, setGithubToken] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [activeRepo, setActiveRepo] = useState('');
  
  // File System State
  const [files, setFiles] = useState(DEFAULT_FILES);
  const [activeFilePath, setActiveFilePath] = useState('App.js');
  const [newFilePath, setNewFilePath] = useState('');

  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  // 1. CREATE NEW REPO FROM TEMPLATE
  const handleCreateNewProject = async () => {
    if (!githubToken.trim() || !newRepoName.trim()) {
      Alert.alert('Error', 'Please provide both GitHub Token and Project Name.');
      return;
    }

    const cleanRepoName = newRepoName.trim().replace(/\s+/g, '-');
    setLoading(true);
    setStatusText(`Cloning template to '${cleanRepoName}'...`);

    try {
      const res = await fetch(
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
            private: false,
          }),
        }
      );

      const data = await res.json();
      if (res.status === 201) {
        setActiveRepo(cleanRepoName);
        Alert.alert('Success', `Repository '${cleanRepoName}' created!`);
      } else {
        Alert.alert('Error', data.message || 'Failed to create repo.');
      }
    } catch (err) {
      Alert.alert('Network Error', err.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  // 2. ADD NEW FILE TO LOCAL TREE
  const handleAddFile = () => {
    if (!newFilePath.trim()) return;
    const path = newFilePath.trim();
    if (files[path]) {
      Alert.alert('Error', 'File already exists.');
      return;
    }
    setFiles({ ...files, [path]: '// New file content' });
    setActiveFilePath(path);
    setNewFilePath('');
  };

  // 3. BATCH COMMIT ALL FILES TO GITHUB
  const handleBatchPush = async () => {
    if (!activeRepo) {
      Alert.alert('Error', 'No active project repo selected.');
      return;
    }

    setLoading(true);
    setStatusText(`Committing project files to ${activeRepo}...`);

    try {
      const authHeader = { Authorization: `token ${githubToken.trim()}` };

      // Step A: Get latest commit on main
      const refRes = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${activeRepo}/git/ref/heads/main`,
        { headers: authHeader }
      );
      const refData = await refRes.json();
      const latestCommitSha = refData.object.sha;

      // Step B: Get Tree SHA from latest commit
      const commitRes = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${activeRepo}/git/commits/${latestCommitSha}`,
        { headers: authHeader }
      );
      const commitData = await commitRes.json();
      const baseTreeSha = commitData.tree.sha;

      // Step C: Create blobs for each file
      const treeItems = [];
      for (const [path, content] of Object.entries(files)) {
        const blobRes = await fetch(
          `https://api.github.com/repos/${GITHUB_USERNAME}/${activeRepo}/git/blobs`,
          {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({ content, encoding: 'utf-8' }),
          }
        );
        const blobData = await blobRes.json();
        treeItems.push({
          path,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        });
      }

      // Step D: Create a new Tree
      const newTreeRes = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${activeRepo}/git/trees`,
        {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
        }
      );
      const newTreeData = await newTreeRes.json();

      // Step E: Create new Commit
      const newCommitRes = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${activeRepo}/git/commits`,
        {
          method: 'POST',
          headers: authHeader,
          body: JSON.stringify({
            message: 'Multi-file update via Mobile Meta Hub IDE',
            tree: newTreeData.sha,
            parents: [latestCommitSha],
          }),
        }
      );
      const newCommitData = await newCommitRes.json();

      // Step F: Update HEAD
      await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${activeRepo}/git/refs/heads/main`,
        {
          method: 'PATCH',
          headers: authHeader,
          body: JSON.stringify({ sha: newCommitData.sha }),
        }
      );

      Alert.alert('Pushed!', `All files committed to ${activeRepo}. APK compilation started!`);
    } catch (err) {
      Alert.alert('Commit Error', err.message);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Mobile Meta Hub Multi-File IDE</Text>

        <View style={styles.card}>
          <Text style={styles.label}>GitHub Access Token:</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="ghp_xxx"
            value={githubToken}
            onChangeText={setGithubToken}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>1. Project Repository:</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. MyComplexApp"
            value={newRepoName}
            onChangeText={setNewRepoName}
          />
          <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateNewProject}>
            <Text style={styles.btnText}>Create Project Repo</Text>
          </TouchableOpacity>
        </View>

        {/* FILE MANAGER SECTION */}
        <View style={styles.card}>
          <Text style={styles.label}>2. File Manager:</Text>
          
          <ScrollView horizontal style={styles.fileTabs}>
            {Object.keys(files).map((path) => (
              <TouchableOpacity
                key={path}
                style={[styles.tab, activeFilePath === path && styles.tabActive]}
                onPress={() => setActiveFilePath(path)}>
                <Text style={[styles.tabText, activeFilePath === path && styles.tabTextActive]}>
                  {path}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="e.g. src/components/Header.js"
              value={newFilePath}
              onChangeText={setNewFilePath}
            />
            <TouchableOpacity style={styles.btnSecondary} onPress={handleAddFile}>
              <Text style={styles.btnText}>+ Add File</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* EDITOR SECTION */}
        <View style={styles.card}>
          <Text style={styles.label}>Editing: {activeFilePath}</Text>
          <TextInput
            style={styles.codeArea}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            value={files[activeFilePath] || ''}
            onChangeText={(text) => setFiles({ ...files, [activeFilePath]: text })}
          />
          <TouchableOpacity style={styles.btnSuccess} onPress={handleBatchPush}>
            <Text style={styles.btnText}>Save, Push All Files & Build APK</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#0052CC" />
            <Text style={styles.loadingText}>{statusText}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F5F7' },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, marginBottom: 16 },
  label: { fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 6, padding: 8, marginBottom: 12 },
  fileTabs: { flexDirection: 'row', marginBottom: 12 },
  tab: { padding: 8, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 8 },
  tabActive: { borderBottomColor: '#0052CC' },
  tabText: { color: '#666' },
  tabTextActive: { color: '#0052CC', fontWeight: 'bold' },
  row: { flexDirection: 'row', gap: 8 },
  codeArea: { backgroundColor: '#1E1E1E', color: '#00FF66', fontFamily: 'monospace', height: 260, borderRadius: 6, padding: 10, textAlignVertical: 'top', marginBottom: 12 },
  btnPrimary: { backgroundColor: '#0052CC', padding: 12, borderRadius: 6, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#4C9AFF', padding: 12, borderRadius: 6, justifyContent: 'center' },
  btnSuccess: { backgroundColor: '#36B37E', padding: 12, borderRadius: 6, alignItems: 'center' },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  loading: { alignItems: 'center', marginVertical: 12 },
  loadingText: { marginTop: 6, color: '#0052CC' }
});
