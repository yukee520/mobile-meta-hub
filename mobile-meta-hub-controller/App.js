import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'editor' | 'settings'

  // Settings State
  const [githubToken, setGithubToken] = useState('');
  const [templateRepo, setTemplateRepo] = useState('username/mobile-meta-hub-template');

  // Projects State
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Editor State
  const [selectedRepo, setSelectedRepo] = useState('');
  const [filePath, setFilePath] = useState('App.js');
  const [fileContent, setFileContent] = useState('');
  const [fileSha, setFileSha] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // --- API CALLS ---

  // Fetch GitHub Repositories for the User
  const fetchUserRepos = async () => {
    if (!githubToken) {
      Alert.alert('Configuration Error', 'Please enter your GitHub Access Token in Settings first.');
      return;
    }
    setLoadingProjects(true);
    try {
      const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        Alert.alert('Error Fetching Projects', data.message || 'Failed to retrieve projects.');
      }
    } catch (error) {
      Alert.alert('Network Error', error.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Delete a Repository from GitHub
  const deleteRepository = (repoFullName) => {
    Alert.alert(
      'Delete Repository',
      `Are you sure you want to permanently delete ${repoFullName} from GitHub?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`https://api.github.com/repos/${repoFullName}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `token ${githubToken}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              });
              if (response.status === 204) {
                Alert.alert('Success', 'Repository deleted successfully.');
                setProjects(projects.filter((p) => p.full_name !== repoFullName));
              } else {
                const data = await response.json();
                Alert.alert('Delete Failed', data.message || 'Unable to delete repo.');
              }
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // Fetch File Content from GitHub
  const fetchFileContent = async () => {
    if (!selectedRepo || !filePath) {
      Alert.alert('Input Required', 'Please specify both Repository and File Path.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(
        `https://api.github.com/repos/${selectedRepo}/contents/${filePath}`,
        {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      const data = await response.json();
      if (data.content) {
        // Decode base64 UTF-8 string content
        const decoded = decodeURIComponent(
          escape(atob(data.content.replace(/\s/g, '')))
        );
        setFileContent(decoded);
        setFileSha(data.sha);
      } else {
        Alert.alert('File Not Found', 'File does not exist at path or is empty. Ready for new file creation.');
        setFileContent('');
        setFileSha('');
      }
    } catch (error) {
      Alert.alert('Error Loading File', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Create or Update File on GitHub
  const saveFileToGithub = async () => {
    if (!selectedRepo || !filePath) {
      Alert.alert('Error', 'Please specify Target Repository and File Path.');
      return;
    }
    setIsSaving(true);
    try {
      // Encode UTF-8 string to base64
      const encoded = btoa(unescape(encodeURIComponent(fileContent)));
      const payload = {
        message: `mobile-meta-hub: update ${filePath}`,
        content: encoded,
        ...(fileSha ? { sha: fileSha } : {}),
      };

      const response = await fetch(
        `https://api.github.com/repos/${selectedRepo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `token ${githubToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (response.status === 200 || response.status === 201) {
        Alert.alert('Saved', 'File committed to GitHub successfully!');
        setFileSha(data.content.sha);
      } else {
        Alert.alert('Save Failed', data.message || 'Failed to save file.');
      }
    } catch (err) {
      Alert.alert('Error Saving', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a File from GitHub
  const deleteFileFromGithub = async () => {
    if (!selectedRepo || !filePath || !fileSha) {
      Alert.alert('Error', 'Load a valid existing file first to delete it.');
      return;
    }
    Alert.alert('Delete File', `Delete ${filePath} from ${selectedRepo}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete File',
        style: 'destructive',
        onPress: async () => {
          setIsSaving(true);
          try {
            const payload = {
              message: `mobile-meta-hub: delete ${filePath}`,
              sha: fileSha,
            };
            const response = await fetch(
              `https://api.github.com/repos/${selectedRepo}/contents/${filePath}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: `token ${githubToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              }
            );
            if (response.status === 200) {
              Alert.alert('Deleted', 'File removed from repository.');
              setFileContent('');
              setFileSha('');
            } else {
              const data = await response.json();
              Alert.alert('Delete Failed', data.message || 'Could not delete file.');
            }
          } catch (err) {
            Alert.alert('Error', err.message);
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  // --- RENDER TAB CONTENTS ---

  const renderProjectsTab = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity style={styles.primaryBtn} onPress={fetchUserRepos}>
        <Text style={styles.primaryBtnText}>Sync GitHub Repositories</Text>
      </TouchableOpacity>

      {loadingProjects ? (
        <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id.toString()}
          style={{ marginTop: 12 }}
          renderItem={({ item }) => (
            <View style={styles.projectCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.projectTitle}>{item.name}</Text>
                <Text style={styles.projectSub}>{item.full_name}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.editCardBtn}
                  onPress={() => {
                    setSelectedRepo(item.full_name);
                    setActiveTab('editor');
                  }}
                >
                  <Text style={styles.editCardText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteCardBtn}
                  onPress={() => deleteRepository(item.full_name)}
                >
                  <Text style={styles.deleteCardText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderEditorTab = () => (
    <ScrollView style={styles.tabContainer}>
      <Text style={styles.label}>Target Repository (owner/repo)</Text>
      <TextInput
        style={styles.input}
        value={selectedRepo}
        onChangeText={setSelectedRepo}
        placeholder="e.g. username/CryptoHub"
        placeholderTextColor="#64748B"
      />

      <Text style={styles.label}>File Path</Text>
      <TextInput
        style={styles.input}
        value={filePath}
        onChangeText={setFilePath}
        placeholder="e.g. App.js or src/utils/api.js"
        placeholderTextColor="#64748B"
      />

      <TouchableOpacity style={styles.secondaryBtn} onPress={fetchFileContent}>
        <Text style={styles.secondaryBtnText}>Load File Content</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 16 }]}>Code Editor</Text>
      <TextInput
        style={[styles.input, styles.codeEditor]}
        value={fileContent}
        onChangeText={setFileContent}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="// Code goes here..."
        placeholderTextColor="#64748B"
      />

      <View style={styles.editorActionRow}>
        <TouchableOpacity
          style={[styles.primaryBtn, { flex: 1, marginRight: 8 }]}
          onPress={saveFileToGithub}
          disabled={isSaving}
        >
          <Text style={styles.primaryBtnText}>
            {isSaving ? 'Saving...' : 'Save / Commit'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteCardBtn, { paddingVertical: 12, paddingHorizontal: 16 }]}
          onPress={deleteFileFromGithub}
          disabled={isSaving}
        >
          <Text style={styles.deleteCardText}>Delete File</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderSettingsTab = () => (
    <View style={styles.tabContainer}>
      <Text style={styles.label}>Personal Access Token (PAT)</Text>
      <TextInput
        style={styles.input}
        value={githubToken}
        onChangeText={setGithubToken}
        secureTextEntry
        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        placeholderTextColor="#64748B"
      />

      <Text style={styles.label}>Template Repository</Text>
      <TextInput
        style={styles.input}
        value={templateRepo}
        onChangeText={setTemplateRepo}
        placeholder="username/mobile-meta-hub-template"
        placeholderTextColor="#64748B"
      />

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => Alert.alert('Saved', 'Configuration retained in state.')}
      >
        <Text style={styles.primaryBtnText}>Save Configuration</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.appTitle}>Mobile Meta Hub Controller</Text>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'projects' && styles.activeTab]}
          onPress={() => setActiveTab('projects')}
        >
          <Text style={[styles.tabText, activeTab === 'projects' && styles.activeTabText]}>
            Projects
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'editor' && styles.activeTab]}
          onPress={() => setActiveTab('editor')}
        >
          <Text style={[styles.tabText, activeTab === 'editor' && styles.activeTabText]}>
            Editor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'projects' && renderProjectsTab()}
        {activeTab === 'editor' && renderEditorTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  appTitle: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC', padding: 16, textAlign: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: '#1E293B', marginHorizontal: 12, borderRadius: 8, padding: 4 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeTab: { backgroundColor: '#38BDF8' },
  tabText: { color: '#94A3B8', fontWeight: 'bold', fontSize: 13 },
  activeTabText: { color: '#0F172A' },
  tabContainer: { flex: 1, padding: 16 },
  label: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeEditor: { height: 240, fontFamily: 'monospace', textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: '#38BDF8', padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryBtnText: { color: '#0F172A', fontWeight: 'bold', fontSize: 14 },
  secondaryBtn: { backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center' },
  secondaryBtnText: { color: '#F8FAFC', fontWeight: '600' },
  projectCard: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectTitle: { color: '#F8FAFC', fontWeight: 'bold', fontSize: 15 },
  projectSub: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 6 },
  editCardBtn: { backgroundColor: '#0284C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  editCardText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  deleteCardBtn: { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  deleteCardText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  editorActionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
});
