import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

export const WorkspaceScreen = ({ project, onBack }) => {
  const [code, setCode] = useState(`// Workspace initialized for ${project?.name}\n\nmodule.exports = {\n  version: "1.0.0"\n};`);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back to Dashboard</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{project?.name} / Workspace</Text>
      <Text style={styles.sub}>Status: Sync Ready</Text>

      <TextInput
        style={styles.editor}
        multiline
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity style={styles.syncBtn}>
        <Text style={styles.syncBtnText}>Stage & Commit Changes</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#121212' },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: '#2979ff', fontSize: 14, fontWeight: '600' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  sub: { color: '#00e676', fontSize: 12, marginBottom: 12 },
  editor: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    color: '#00ff66',
    fontFamily: 'monospace',
    padding: 12,
    borderRadius: 8,
    textAlignVertical: 'top',
  },
  syncBtn: {
    backgroundColor: '#2979ff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  syncBtnText: { color: '#fff', fontWeight: 'bold' },
});
