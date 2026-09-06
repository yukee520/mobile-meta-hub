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
  const [fileList, setFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
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
      if (githubToken && templateRepo) {
        const cleanTemplateRepo = templateRepo.trim();
        const generateRes = await fetch(
          `https://api.github.com/repos/${cleanTemplateRepo}/generate`,
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
              include_all_branches: false,
            }),
          }
        );

        if (!generateRes.ok) {
          const errData = await generateRes.json();
          throw new Error(`GitHub Template Error: ${errData.message || 'Failed to duplicate template repo.'}`);
        }
      }

      await RNFS.mkdir(projectPath);
      await RNFS.mkdir(`${projectPath}/android`);

      // Write required Metro Config & Index Entry Files
      await RNFS.writeFile(
        `${projectPath}/metro.config.js`,
        `const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');\nconst config = {};\nmodule.exports = mergeConfig(getDefaultConfig(__dirname), config);`,
        'utf8'
      );

      await RNFS.writeFile(
        `${projectPath}/index.js`,
        `import {AppRegistry} from 'react-native';\nimport App from './App';\nimport {name as appName} from './app.json';\n\nAppRegistry.registerComponent(appName, () => App);`,
        'utf8'
      );

      await RNFS.writeFile(
        `${projectPath}/app.json`,
        JSON.stringify({ name: projectName, displayName: projectName }),
        'utf8'
      );

      await RNFS.writeFile(
        `${projectPath}/App.js`,
        `import React from 'react';\nimport {Text, View, StyleSheet} from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.text}>Workspace: ${projectName}</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },\n  text: { color: '#007ACC', fontSize: 20, fontWeight: 'bold' }\n});`,
        'utf8'
      );

      Alert.alert('Success', `Repository "${projectName}" generated with Metro config!`);
      setCustomProjectName('');
      await refreshProjects();
      openProject(projectName);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (projectName) => {
    Alert.alert(
      'Delete Workspace',
      `Delete "${projectName}" locally and permanently remove its repository from GitHub?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everywhere',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              if (githubToken && githubUser) {
                await fetch(
                  `https://api.github.com/repos/${githubUser}/${projectName}`,
                  {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `token ${githubToken}`,
                      'User-Agent': 'MobileMetaHubApp',
                    },
                  }
                );
              }

              const projectPath = `${getProjectsDirPath()}/${projectName}`;
              await RNFS.unlink(projectPath);

              if (activeProject === projectName) {
                setActiveProject(null);
                setFileList([]);
                setSelectedFile(null);
              }

              await refreshProjects();
              Alert.alert('Deleted', `Workspace "${projectName}" removed.`);
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const openProject = async (projectName) => {
    setActiveProject(projectName);
    const projectPath = `${getProjectsDirPath()}/${projectName}`;
    try {
      const contents = await RNFS.readDir(projectPath);
      setFileList(contents);
      setSelectedFile(null);
      setFileContent('');
      setCurrentTab('editor');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const openFile = async (filePath, isDir) => {
    if (isDir) {
      const contents = await RNFS.readDir(filePath);
      setFileList(contents);
      return;
    }
    try {
      setSelectedFile(filePath);
      const content = await RNFS.readFile(filePath, 'utf8');
      setFileContent(content);
    } catch (err) {
      Alert.alert('Error reading file', err.message);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    try {
      await RNFS.writeFile(selectedFile, fileContent, 'utf8');
      Alert.alert('Saved', 'File updated locally.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const deleteFile = async (filePath) => {
    Alert.alert('Delete File', 'Delete this file permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await RNFS.unlink(filePath);
            setSelectedFile(null);
            setFileContent('');
            openProject(activeProject);
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const createCustomFile = async () => {
    if (!newFileName || !activeProject) return;
    const filePath = `${getProjectsDirPath()}/${activeProject}/${newFileName}`;
    try {
      await RNFS.writeFile(filePath, '', 'utf8');
      setNewFileName('');
      openProject(activeProject);
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
      // Step A: Auto-push metro.config.js, index.js, app.json, and active file
      const projectPath = `${getProjectsDirPath()}/${activeProject}`;
      const filesToPush = ['metro.config.js', 'index.js', 'app.json'];
      
      if (selectedFile) {
        const selectedFileName = selectedFile.split('/').pop();
        if (!filesToPush.includes(selectedFileName)) {
          filesToPush.push(selectedFileName);
        }
      }

      for (const fileName of filesToPush) {
        const fullFilePath = `${projectPath}/${fileName}`;
        const fileExists = await RNFS.exists(fullFilePath);

        if (fileExists) {
          const content = await RNFS.readFile(fullFilePath, 'utf8');
          const getShaRes = await fetch(
            `https://api.github.com/repos/${githubUser}/${activeProject}/contents/${fileName}`,
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
            `https://api.github.com/repos/${githubUser}/${activeProject}/contents/${fileName}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'MobileMetaHubApp',
              },
              body: JSON.stringify({
                message: `sync: ${fileName}`,
                content: encodedContent,
                sha: sha || undefined,
              }),
            }
          );
        }
      }

      // Step B: Dispatch Action Workflow
      await fetch(
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

      Alert.alert('Pushed & Triggered', 'Metro config and project files synced to GitHub. Check GitHub Actions tab!');
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
          <TextInput style={styles.input} value={templateRepo} onChangeText={setTemplateRepo} placeholder="e.g. user/react-native-template" placeholderTextColor="#666" />

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
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>+ Create New Project</Text>
            )}
          </TouchableOpacity>

          <FlatList
            data={projects}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <View style={styles.cardRow}>
                <TouchableOpacity style={styles.card} onPress={() => openProject(item)}>
                  <Text style={styles.cardText}>📁 {item}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProject(item)}>
                  <Text style={styles.btnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <Modal visible={isModalVisible} transparent animationType="slide">
            <View style={styles.modalContainer}>
              <View style={styles.modalCard}>
                <Text style={styles.title}>New Project Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. MyAwesomeApp"
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
            {activeProject ? `Workspace: ${activeProject}` : 'Select a Project First'}
          </Text>

          {activeProject && (
            <>
              <View style={styles.fileBar}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Filename (e.g. index.css, App.js)"
                  placeholderTextColor="#666"
                  value={newFileName}
                  onChangeText={setNewFileName}
                />
                <TouchableOpacity style={styles.smallButton} onPress={createCustomFile}>
                  <Text style={styles.btnText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal style={styles.fileListHeader}>
                {fileList.map(file => (
                  <TouchableOpacity 
                    key={file.path} 
                    style={styles.fileChip} 
                    onPress={() => openFile(file.path, file.isDirectory())}>
                    <Text style={styles.chipText}>{file.isDirectory() ? `📁 ${file.name}` : `📄 ${file.name}`}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedFile ? (
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.codeEditor}
                    multiline
                    value={fileContent}
                    onChangeText={setFileContent}
                    placeholder="Write code, CSS, JS, HTML..."
                    placeholderTextColor="#555"
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity style={[styles.actionButton, { flex: 0.3, backgroundColor: '#DC3545' }]} onPress={() => deleteFile(selectedFile)}>
                      <Text style={styles.btnText}>Delete File</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { flex: 0.3, backgroundColor: '#28A745' }]} onPress={saveFile}>
                      <Text style={styles.btnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { flex: 0.35, backgroundColor: '#6f42c1' }]} onPress={pushAndTriggerBuild}>
                      {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Push & Build</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={{ marginTop: 20, color: '#888' }}>Select a file above to start editing.</Text>
              )}
            </>
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
  smallButton: { backgroundColor: '#28A745', padding: 12, borderRadius: 5, marginLeft: 5 },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  card: { flex: 1, backgroundColor: '#1E1E1E', padding: 15, borderRadius: 5, marginRight: 5 },
  deleteBtn: { backgroundColor: '#DC3545', padding: 15, borderRadius: 5 },
  cardText: { color: '#FFF', fontSize: 16 },
  fileBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fileListHeader: { maxHeight: 45, marginBottom: 10 },
  fileChip: { backgroundColor: '#333', padding: 10, borderRadius: 5, marginRight: 5 },
  chipText: { color: '#FFF' },
  codeEditor: { flex: 1, backgroundColor: '#000', color: '#0F0', fontFamily: 'monospace', padding: 10, borderRadius: 5 },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20 },
  modalCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 10 }
});
