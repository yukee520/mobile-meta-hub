import AsyncStorage from '@react-native-async-storage/async-storage';

const PROJECTS_KEY = '@meta_hub_projects_v1';

export const StorageEngine = {
  async getProjects() {
    try {
      const jsonValue = await AsyncStorage.getItem(PROJECTS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Failed to fetch projects', e);
      return [];
    }
  },

  async createProject(name) {
    try {
      const existing = await this.getProjects();
      const newProject = {
        id: Date.now().toString(),
        name,
        createdAt: new Date().toISOString(),
        gitStatus: 'clean',
      };
      const updated = [newProject, ...existing];
      await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to save project', e);
      throw e;
    }
  },

  async deleteProject(id) {
    try {
      const existing = await this.getProjects();
      const updated = existing.filter((p) => p.id !== id);
      await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Failed to delete project', e);
      throw e;
    }
  },
};
