import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { StorageEngine } from '../services/storage';

export const DashboardScreen = ({ onSelectProject }) => {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadProjects = useCallback(async () => {
    setRefreshing(true);
    const data = await StorageEngine.getProjects();
    setProjects(data);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    const updated = await StorageEngine.createProject(newProjectName.trim());
    setProjects(updated);
    const created = updated[0];
    setNewProjectName('');
    if (onSelectProject) onSelectProject(created);
  };

  const handleDelete = (id, name) => {
    Alert.alert('Delete Project', `Are you sure you want to remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = await StorageEngine.deleteProject(id);
          setProjects(updated);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>MetaHub Workspaces</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="New Project Title..."
          placeholderTextColor="#666"
          value={newProjectName}
          onChangeText={setNewProjectName}
        />
        <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.buttonText}>Provision</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadProjects} tintColor="#fff" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => onSelectProject && onSelectProject(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>
                Created: {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(item.id, item.name)}
              style={styles.deleteBadge}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No projects provisioned. Create one above.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#121212' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#ffffff', marginBottom: 16 },
  inputContainer: { flexDirection: 'row', marginBottom: 20 },
  input: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    height: 48,
  },
  createButton: {
    backgroundColor: '#00e676',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#000', fontWeight: 'bold' },
  card: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  cardMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  deleteBadge: { backgroundColor: '#331010', padding: 8, borderRadius: 6 },
  deleteText: { color: '#ff5252', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 40 },
});
