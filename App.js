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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

export default function App() {
  const [currentTab, setCurrentTab] = useState('projects');
  
  // Settings Credentials State
  const [githubUser, setGithubUser] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [templateRepo, setTemplateRepo] = useState('');

  // Project & File System State
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    refreshProjects();
  }, []);

  // Settings Storage
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

  // Directory Management
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

  // GitHub Template Cloner / Local Initializer
  const createProjectFromTemplate = async () => {
    const projectName = `App_${Date.now().toString().slice(-4)}`;
    const projectPath = `${getProjectsDirPath()}/${projectName}`;

    setIsLoading(true);
    try {
      await RNFS.mkdir(projectPath);

      // Attempt remote GitHub fetch if token & repo are provided
      if (githubToken && templateRepo) {
        const url = `https://api.github.com/repos/${templateRepo}/zipball/main`;
        const zipPath = `${projectPath}/template.zip`;

        const download = RNFS.downloadFile({
          fromUrl: url,
          toFile: zipPath,
          headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'MobileMetaHubApp',
          },
        });

        await download.promise;
      }

      // Populate core folder structure & templates
      await RNFS.mkdir(`${projectPath}/android`);
      await RNFS.mkdir(`${projectPath}/ios`);
      await RNFS.mkdir(`${projectPath}/src`);

      await RNFS.writeFile(
        `${projectPath}/index.js`,
        `import {AppRegistry} from 'react-native';\nimport App from './App';\nimport {name as appName} from './app.json';\n\nAppRegistry.registerComponent(appName, () => App);`,
        'utf8'
      );
      await RNFS.writeFile(
        `${projectPath}/App.js`,
        `import React from 'react';\nimport {Text, View} from 'react-native';\n\nexport default function App() {\n  return (\n    <View><Text>Project: ${projectName}</Text></View>\n  );\n}`,
        'utf8'
      );
      await RNFS.writeFile(
        `${projectPath}/styles.css`,
        `/* Mobile Meta Hub Custom UI Style */\nbody { background-color: #121212; color: #ffffff; }`,
        'utf8'
      );

      Alert.alert('Success', `Project ${projectName} generated!`);
      await refreshProjects();
      openProject(projectName);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Editor Operations
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
      Alert.alert('Saved', 'File updated.');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab Navigation */}
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

      {/* Settings Tab */}
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

      {/* Projects Dashboard */}
      {currentTab === 'projects' && (
        <View style={styles.tabContent}>
          <Text style={styles.title}>Mobile Meta Hub Workspaces</Text>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={createProjectFromTemplate}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>+ Duplicate Template Project</Text>
            )}
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
        </View>
      )}

      {/* Code & UI Editor Screen */}
      {currentTab === 'editor' && (
        <View style={styles.tabContent}>
          <Text style={styles.title}>
            {activeProject ? `Workspace: ${activeProject}` : 'Select a Project First'}
          </Text>

          {activeProject && (
            <>
              {/* File Creator Bar */}
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

              {/* Directory Bar */}
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

              {/* Code Editor */}
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
                  <TouchableOpacity style={styles.actionButton} onPress={saveFile}>
                    <Text style={styles.btnText}>Save Script</Text>
                  </TouchableOpacity>
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
  card: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 5, marginBottom: 10 },
  cardText: { color: '#FFF', fontSize: 16 },
  fileBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fileListHeader: { maxHeight: 45, marginBottom: 10 },
  fileChip: { backgroundColor: '#333', padding: 10, borderRadius: 5, marginRight: 5 },
  chipText: { color: '#FFF' },
  codeEditor: { flex: 1, backgroundColor: '#000', color: '#0F0', fontFamily: 'monospace', padding: 10, borderRadius: 5 }
});
