export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
}

export interface SourceFile {
  id: string;
  name: string;
  text: string;
  size: number;
  type: string;
  createdAt: number;
}

export interface StudyTask {
  id: string;
  date: string;
  title: string;
  description: string;
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  title: string;
  tasks: StudyTask[];
  createdAt: number;
}

const DB_NAME = 'studysync_db';
const DB_VERSION = 1;

class StudySyncDB {
  private db: IDBDatabase | null = null;

  private initDB(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        
        // Notes store
        if (!db.objectStoreNames.contains('notes')) {
          db.createObjectStore('notes', { keyPath: 'id' });
        }
        
        // Folders store
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        
        // Sources store for NotebookLM-like feature
        if (!db.objectStoreNames.contains('sources')) {
          db.createObjectStore('sources', { keyPath: 'id' });
        }
        
        // Study plans store
        if (!db.objectStoreNames.contains('studyplans')) {
          db.createObjectStore('studyplans', { keyPath: 'id' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.initDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- NOTES CRUD ---
  async getAllNotes(): Promise<Note[]> {
    const store = await this.getStore('notes');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNote(note: Note): Promise<void> {
    const store = await this.getStore('notes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id: string): Promise<void> {
    const store = await this.getStore('notes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- FOLDERS CRUD ---
  async getAllFolders(): Promise<Folder[]> {
    const store = await this.getStore('folders');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveFolder(folder: Folder): Promise<void> {
    const store = await this.getStore('folders', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(folder);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFolder(id: string): Promise<void> {
    const store = await this.getStore('folders', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- SOURCES CRUD (NotebookLM) ---
  async getAllSources(): Promise<SourceFile[]> {
    const store = await this.getStore('sources');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSource(source: SourceFile): Promise<void> {
    const store = await this.getStore('sources', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(source);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSource(id: string): Promise<void> {
    const store = await this.getStore('sources', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- STUDY PLANS CRUD ---
  async getAllStudyPlans(): Promise<StudyPlan[]> {
    const store = await this.getStore('studyplans');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveStudyPlan(plan: StudyPlan): Promise<void> {
    const store = await this.getStore('studyplans', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(plan);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteStudyPlan(id: string): Promise<void> {
    const store = await this.getStore('studyplans', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- CLEAR ALL DATA ---
  async clearAllData(): Promise<void> {
    const db = await this.initDB();
    const stores = ['notes', 'folders', 'sources', 'studyplans'];
    const transaction = db.transaction(stores, 'readwrite');
    
    return new Promise((resolve, reject) => {
      let completed = 0;
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => {
          completed++;
          if (completed === stores.length) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }
}

export const dbService = new StudySyncDB();
