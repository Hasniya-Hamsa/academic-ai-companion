import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Trash2, Key, Database, RefreshCw, Moon, Sun } from 'lucide-react';
import { validateApiKey } from '../services/gemini';
import { dbService } from '../services/db';

interface SettingsProps {
  onKeyChange: () => void;
}

export default function Settings({ onKeyChange }: SettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isLight, setIsLight] = useState(false);
  
  // DB stats
  const [notesCount, setNotesCount] = useState(0);
  const [sourcesCount, setSourcesCount] = useState(0);
  const [plansCount, setPlansCount] = useState(0);

  useEffect(() => {
    const savedKey = localStorage.getItem('studysync_gemini_api_key') || '';
    setApiKey(savedKey);
    if (savedKey) {
      setValidationStatus('success');
    }
    
    // Theme setup
    const isLightTheme = document.body.classList.contains('light-theme');
    setIsLight(isLightTheme);

    loadDbStats();
  }, []);

  const loadDbStats = async () => {
    try {
      const notes = await dbService.getAllNotes();
      const sources = await dbService.getAllSources();
      const plans = await dbService.getAllStudyPlans();
      setNotesCount(notes.length);
      setSourcesCount(sources.length);
      setPlansCount(plans.length);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      localStorage.removeItem('studysync_gemini_api_key');
      setValidationStatus('idle');
      onKeyChange();
      return;
    }

    setIsValidating(true);
    setValidationStatus('idle');
    
    const isValid = await validateApiKey(apiKey.trim());
    setIsValidating(false);
    
    if (isValid) {
      localStorage.setItem('studysync_gemini_api_key', apiKey.trim());
      setValidationStatus('success');
      onKeyChange();
    } else {
      setValidationStatus('error');
    }
  };

  const toggleTheme = () => {
    const nextLight = !isLight;
    setIsLight(nextLight);
    document.body.classList.toggle('light-theme', nextLight);
  };

  const handleClearData = async () => {
    if (confirm('Are you absolutely sure you want to delete all notes, uploaded documents, timetable logs, and settings? This action cannot be undone.')) {
      await dbService.clearAllData();
      localStorage.clear();
      setApiKey('');
      setValidationStatus('idle');
      loadDbStats();
      onKeyChange();
      alert('All application data has been successfully cleared.');
      window.location.reload();
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Configure your AI credentials, theme options, and manage local storage data.</p>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Key size={20} color="var(--color-primary)" /> Gemini AI API Key
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', lineHeight: '1.5' }}>
          To unlock the study plan generator, assignment time estimator, and NotebookLM-style file workspace, you need a Google Gemini API Key. 
          You can get a free-tier key from the{' '}
          <a 
            href="https://aistudio.google.com/" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '500' }}
          >
            Google AI Studio
          </a>.
        </p>

        <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label htmlFor="apiKeyInput">Gemini API Key</label>
            <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
              <input
                id="apiKeyInput"
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ flex: 1, paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '108px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isValidating}
                style={{ minWidth: '90px' }}
              >
                {isValidating ? <RefreshCw size={16} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </form>

        {validationStatus === 'success' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontSize: '14px', marginTop: '12px' }}>
            <CheckCircle2 size={16} /> API Key is configured and valid.
          </div>
        )}

        {validationStatus === 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)', fontSize: '14px', marginTop: '12px' }}>
            <AlertCircle size={16} /> Invalid API Key. Please verify the key and try again.
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          {isLight ? <Sun size={20} color="var(--color-warning)" /> : <Moon size={20} color="var(--color-primary)" />} Appearance
        </h2>
        <div className="flex-between">
          <div>
            <p style={{ fontWeight: '500' }}>Theme Preference</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>Switch between dark mode and light mode.</p>
          </div>
          <button onClick={toggleTheme} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isLight ? <Moon size={16} /> : <Sun size={16} />}
            {isLight ? 'Dark Mode' : 'Light Mode'}
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <Database size={20} color="var(--color-secondary)" /> Data Management
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Notes Stored</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px' }}>{notesCount}</p>
          </div>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>AI Sources</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px' }}>{sourcesCount}</p>
          </div>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Study Plans</p>
            <p style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px' }}>{plansCount}</p>
          </div>
        </div>
        <div className="flex-between" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
          <div>
            <p style={{ fontWeight: '500', color: 'var(--color-danger)' }}>Danger Zone</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>Delete all notes, files, timetables, and settings from this device.</p>
          </div>
          <button onClick={handleClearData} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={16} /> Reset App
          </button>
        </div>
      </div>
    </div>
  );
}
