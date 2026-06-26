import React, { useState, useEffect } from 'react';
import { Plus, FolderPlus, Trash2, Search, FileText, BrainCircuit, Check, Save } from 'lucide-react';
import { dbService, type Note, type Folder } from '../services/db';

interface NotesProps {
  onSendToAI: (noteText: string, noteTitle: string) => void;
}

export default function Notes({ onSendToAI }: NotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Save status indicators
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  // Modal / Input States
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allNotes = await dbService.getAllNotes();
      const allFolders = await dbService.getAllFolders();
      setNotes(allNotes);
      setFolders(allFolders);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name: newFolderName.trim()
    };

    await dbService.saveFolder(newFolder);
    setNewFolderName('');
    setShowFolderModal(false);
    await loadData();
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this folder? Notes inside will not be deleted, they will be moved to uncategorized.')) {
      // Update notes inside this folder to uncategorized
      const updatedNotes = notes.map(n => n.folderId === id ? { ...n, folderId: '' } : n);
      for (const note of updatedNotes) {
        if (note.folderId === '') {
          await dbService.saveNote(note);
        }
      }
      await dbService.deleteFolder(id);
      if (selectedFolderId === id) setSelectedFolderId('all');
      await loadData();
    }
  };

  const handleCreateNote = async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '',
      folderId: selectedFolderId === 'all' ? '' : selectedFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await dbService.saveNote(newNote);
    setSelectedNote(newNote);
    await loadData();
  };

  const handleNoteChange = async (fields: Partial<Note>) => {
    if (!selectedNote) return;

    setSaveStatus('saving');
    const updatedNote = {
      ...selectedNote,
      ...fields,
      updatedAt: Date.now()
    };

    setSelectedNote(updatedNote);
    await dbService.saveNote(updatedNote);
    
    // Quick auto-save simulation for visual polish
    setTimeout(() => {
      setSaveStatus('saved');
    }, 400);

    // Refresh list in background
    const allNotes = await dbService.getAllNotes();
    setNotes(allNotes);
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      await dbService.deleteNote(id);
      if (selectedNote?.id === id) setSelectedNote(null);
      await loadData();
    }
  };

  const handleExportNote = () => {
    if (!selectedNote) return;
    const blob = new Blob([`# ${selectedNote.title}\n\n${selectedNote.content}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedNote.title.toLowerCase().replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filter notes based on folder and search query
  const filteredNotes = notes.filter(note => {
    const matchesFolder = selectedFolderId === 'all' || note.folderId === selectedFolderId;
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)' }}>
      {/* Search and Folders Bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '40px', width: '100%' }}
          />
        </div>
        <button onClick={() => setShowFolderModal(true)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderPlus size={16} /> New Folder
        </button>
        <button onClick={handleCreateNote} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> New Note
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', height: '100%', minHeight: 0 }}>
        {/* Left Side: Folders + Note List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
          {/* Folders List */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>Folders</h3>
            <button
              onClick={() => setSelectedFolderId('all')}
              style={{
                width: '100%',
                padding: '10px 12px',
                textAlign: 'left',
                background: selectedFolderId === 'all' ? 'rgba(255, 255, 255, 0.05)' : 'none',
                border: 'none',
                color: selectedFolderId === 'all' ? 'var(--color-primary)' : 'var(--text-secondary)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              All Notes ({notes.length})
            </button>
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 12px',
                  background: selectedFolderId === folder.id ? 'rgba(255, 255, 255, 0.05)' : 'none',
                  color: selectedFolderId === folder.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {folder.name} ({notes.filter(n => n.folderId === folder.id).length})
                </span>
                <button
                  onClick={(e) => handleDeleteFolder(folder.id, e)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Notes List under folder */}
          <div className="glass-panel" style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>Notes</h3>
            
            {filteredNotes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>No notes found.</p>
            ) : (
              filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className="glass-card animate-fade-in"
                  style={{
                    padding: '12px',
                    cursor: 'pointer',
                    borderColor: selectedNote?.id === note.id ? 'var(--color-primary)' : 'var(--border-glass)',
                    background: selectedNote?.id === note.id ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-surface)'
                  }}
                >
                  <h4 style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.title || 'Untitled Note'}
                  </h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.content ? note.content.substring(0, 40) : 'Empty note'}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '6px', textAlign: 'right' }}>
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Active Editor */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {selectedNote ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              {/* Toolbar */}
              <div className="flex-between" style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <input
                    type="text"
                    value={selectedNote.title}
                    onChange={(e) => handleNoteChange({ title: e.target.value })}
                    style={{
                      fontSize: '20px',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 'bold',
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      color: 'var(--text-primary)',
                      flex: 1
                    }}
                    placeholder="Enter Note Title"
                  />
                  
                  {/* Save Status Icon */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {saveStatus === 'saved' ? <Check size={14} color="var(--color-success)" /> : <Save size={14} className="animate-spin" />}
                    <span>{saveStatus === 'saved' ? 'Saved' : 'Saving...'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Send to AI button */}
                  <button
                    onClick={() => onSendToAI(selectedNote.content, selectedNote.title)}
                    className="btn btn-secondary"
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      color: 'var(--color-primary)',
                      background: 'var(--grad-glow)',
                      borderColor: 'rgba(99, 102, 241, 0.2)'
                    }}
                    title="Send this note to NotebookLM AI workspace as a source"
                  >
                    <BrainCircuit size={14} /> Send to AI
                  </button>

                  <button onClick={handleExportNote} className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>
                    Export .md
                  </button>

                  <button
                    onClick={() => handleDeleteNote(selectedNote.id)}
                    className="btn btn-danger"
                    style={{ padding: '8px 12px', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Folder Placement */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Folder:</span>
                <select
                  value={selectedNote.folderId || ''}
                  onChange={(e) => handleNoteChange({ folderId: e.target.value })}
                  style={{ padding: '4px 12px', fontSize: '13px' }}
                >
                  <option value="">Uncategorized</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Editor Workspace */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <textarea
                  value={selectedNote.content}
                  onChange={(e) => handleNoteChange({ content: e.target.value })}
                  placeholder="Start typing your notes here (supports text or markdown logs)..."
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    fontSize: '15px',
                    lineHeight: '1.6',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <FileText size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
              <p style={{ fontWeight: '500' }}>No note selected</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Choose a note from the list, or create a new one to begin editing.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Folder Modal */}
      {showFolderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 23, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '24px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>Create New Folder</h2>
            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Folder Name</label>
                <input
                  type="text"
                  placeholder="e.g. Physics II"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowFolderModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
