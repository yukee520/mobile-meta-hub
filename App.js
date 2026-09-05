import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeWrapper } from './src/components/SafeWrapper';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { WorkspaceScreen } from './src/screens/WorkspaceScreen';

export default function App() {
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <SafeAreaProvider>
      <SafeWrapper>
        {selectedProject ? (
          <WorkspaceScreen
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <DashboardScreen onSelectProject={(p) => setSelectedProject(p)} />
        )}
      </SafeWrapper>
    </SafeAreaProvider>
  );
}
