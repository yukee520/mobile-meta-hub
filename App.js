import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

export default function App() {
  const [currentTab, setCurrentTab] = useState('projects');
  
  const [githubUser, setGithubUser] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [templateRepo, setTemplateRepo] = useState('');

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [customProjectName, setCustomProjectName] = useState('');

  useEffect(() => {
    loadSettings();
    refreshProjects();
  }, []);

  const loadSettings = async () => {
    try {
      const user = await AsyncStorage.getItem('GH_USER');
      const token = await AsyncStorage.getItem('GH_TOKEN');
      const repo = await AsyncStorage.getItem('GH_TEMPLATE');
      if (user) setGithubUser(user);
      if (token) setGithubToken(token);
      if (repo) setTemplateRepo(repo);
    } catch (e) {
      console.log('Error loading settings', e);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('GH_USER', githubUser);
      await AsyncStorage.setItem('GH_TOKEN', githubToken);
      await AsyncStorage.setItem('GH_TEMPLATE', templateRepo);
      Alert.alert('Saved', 'GitHub Settings updated successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const getProjectsDirPath = () => `${RNFS.DocumentDirectoryPath}/projects`;

  const refreshProjects = async () => {
    try {
      const path = getProjectsDirPath();
      const exists = await RNFS.exists(path);
      if (!exists) {
        await RNFS.mkdir(path);
      }
      const files = await RNFS.readDir(path);
      setProjects(files.filter(f => f.isDirectory()).map(f => f.name));
    } catch (err) {
      console.log('Error reading directory:', err.message);
    }
  };

  const createProjectFromTemplate = async () => {
    if (!customProjectName.trim()) {
      Alert.alert('Error', 'Please enter a project name.');
      return;
    }

    const projectName = customProjectName.trim().replace(/\s+/g, '-');
    const projectPath = `${getProjectsDirPath()}/${projectName}`;

    setIsLoading(true);
    setIsModalVisible(false);

    try {
      if (!githubToken || !templateRepo) {
        throw new Error('Please set GitHub Token and Template Repo in Settings first.');
      }

      const generateRes = await fetch(
        `https://api.github.com/repos/${templateRepo.trim()}/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'MobileMetaHubApp',
          },
          body: JSON.stringify({
            name: projectName,
            private: false,
          }),
        }
      );

      if (!generateRes.ok) {
        const errData = await generateRes.json();
        throw new Error(errData.message || 'Failed to duplicate template repo.');
      }

      await RNFS.mkdir(projectPath);
      
      const defaultCode = `import React from 'react';\nimport {Text, View, StyleSheet} from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.text}>Workspace: ${projectName}</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },\n  text: { color: '#007ACC', fontSize: 20, fontWeight: 'bold' }\n});`;

      await RNFS.writeFile(`${projectPath}/App.js`, defaultCode, 'utf8');

      Alert.alert('Success', `Repository "${projectName}" generated from template!`);
      setCustomProjectName('');
      await refreshProjects();
      openProject(projectName);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openProject = async (projectName) => {
    setActiveProject(projectName);
    const appJsPath = `${getProjectsDirPath()}/${projectName}/App.js`;
    try {
      const exists = await RNFS.exists(appJsPath);
      if (exists) {
        const content = await RNFS.readFile(appJsPath, 'utf8');
        setFileContent(content);
      } else {
        setFileContent('');
      }
      setCurrentTab('editor');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const saveFile = async () => {
    if (!activeProject) return;
    try {
      const appJsPath = `${getProjectsDirPath()}/${activeProject}/App.js`;
      await RNFS.writeFile(appJsPath, fileContent, 'utf8');
      Alert.alert('Saved', 'App.js saved locally.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const pushAndTriggerBuild = async () => {
    if (!githubToken || !githubUser || !activeProject) {
      Alert.alert('Missing Credentials', 'Ensure GitHub Username, Token, and Active Project are set.');
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Sync updated App.js to GitHub
      const appJsPath = `${getProjectsDirPath()}/${activeProject}/App.js`;
      const content = await RNFS.readFile(appJsPath, 'utf8');

      const getShaRes = await fetch(
        `https://api.github.com/repos/${githubUser}/${activeProject}/contents/App.js`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'MobileMetaHubApp',
          },
        }
      );

      let sha = null;
      if (getShaRes.ok) {
        const fileData = await getShaRes.json();
        sha = fileData.sha;
      }

      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      await fetch(
        `https://api.github.com/repos/${githubUser}/${activeProject}/contents/App.js`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'MobileMetaHubApp',
          },
          body: JSON.stringify({
            message: 'sync: App.js',
            content: encodedContent,
            sha: sha || undefined,
          }),
        }
      );

      // Step 2: Trigger single build workflow via dispatch
      const dispatchRes = await fetch(
        `https://api.github.com/repos/${githubUser}/${activeProject}/actions/workflows/build-apk.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'MobileMetaHubApp',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );

      if (!dispatchRes.ok) {
        throw new Error('Failed to dispatch build workflow. Verify build-apk.yml exists in repository.');
      }

      Alert.alert('Pushed & Triggered', 'App.js synced and 1 single APK build workflow triggered!');
    } catch (err) {
      Alert.alert('Push Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={() => setCurrentTab('projects')}>
          <Text style={styles.navText}>Projects</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => setCurrentTab('editor')}>
          <Text style={styles.navText}>Editor</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => setCurrentTab('settings')}>
          <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>

      {currentTab === 'settings' && (
        <ScrollView style={styles.tabContent}>
          <Text style={styles.title}>GitHub Configuration</Text>
          <Text style={styles.label}>GitHub Username</Text>
          <TextInput style={styles.input} value={githubUser} onChangeText={setGithubUser} placeholder="e.g. octocat" placeholderTextColor="#666" />
          
          <Text style={styles.label}>Personal Access Token (PAT)</Text>
          <TextInput style={styles.input} value={githubToken} onChangeText={setGithubToken} secureTextEntry placeholder="ghp_xxxxxxxxxxxx" placeholderTextColor="#666" />

          <Text style={styles.label}>Template Repo (owner/repository)</Text>
          <TextInput style={styles.input} value={templateRepo} onChangeText={setTemplateRepo} placeholder="e.g. user/mobile-meta-hub-template" placeholderTextColor="#666" />

          <TouchableOpacity style={styles.actionButton} onPress={saveSettings}>
            <Text style={styles.btnText}>Save Config</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {currentTab === 'projects' && (
        <View style={styles.tabContent}>
          <Text style={styles.title}>Mobile Meta Hub Workspaces</Text>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => setIsModalVisible(true)}
            disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>+ Duplicate Template & Create Repo</Text>}
          </TouchableOpacity>

          <FlatList
            data={projects}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => openProject(item)}>
                <Text style={styles.cardText}>📁 {item}</Text>
              </TouchableOpacity>
            )}
          />

          <Modal visible={isModalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalCard}>
                <Text style={styles.title}>New Project Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Awesome"
                  placeholderTextColor="#666"
                  value={customProjectName}
                  onChangeText={setCustomProjectName}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#666', flex: 0.45 }]} onPress={() => setIsModalVisible(false)}>
                    <Text style={styles.btnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionButton, { flex: 0.45 }]} onPress={createProjectFromTemplate}>
                    <Text style={styles.btnText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {currentTab === 'editor' && (
        <View style={styles.tabContent}>
          <Text style={styles.title}>
            {activeProject ? `Editing: ${activeProject}/App.js` : 'Select a Project First'}
          </Text>

          {activeProject && (
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.codeEditor}
                multiline
                value={fileContent}
                onChangeText={setFileContent}
                placeholder="Write App.js code..."
                placeholderTextColor="#555"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <TouchableOpacity style={[styles.actionButton, { flex: 0.45, backgroundColor: '#28A745' }]} onPress={saveFile}>
                  <Text style={styles.btnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, { flex: 0.45, backgroundColor: '#6f42c1' }]} onPress={pushAndTriggerBuild}>
                  {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Push & Build</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  navBar: { flexDirection: 'row', backgroundColor: '#1E1E1E', paddingVertical: 12 },
  navButton: { flex: 1, alignItems: 'center' },
  navText: { color: '#FFF', fontWeight: 'bold' },
  tabContent: { flex: 1, padding: 15 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#FFF', marginBottom: 15 },
  label: { color: '#AAA', marginTop: 10 },
  input: { backgroundColor: '#2A2A2A', color: '#FFF', padding: 10, borderRadius: 5, marginTop: 5, marginBottom: 10 },
  actionButton: { backgroundColor: '#007ACC', padding: 12, borderRadius: 5, alignItems: 'center', marginVertical: 10 },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  card: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 5, marginBottom: 10 },
  cardText: { color: '#FFF', fontSize: 16 },
  codeEditor: { flex: 1, backgroundColor: '#000', color: '#0F0', fontFamily: 'monospace', padding: 10, borderRadius: 5 },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20 },
  modalCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 10 }
});
