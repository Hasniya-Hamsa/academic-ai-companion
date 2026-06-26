import { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, CheckSquare, FileText, BrainCircuit, Settings as SettingsIcon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Timetable from './components/Timetable';
import Assignments from './components/Assignments';
import Notes from './components/Notes';
import NotebookLM from './components/NotebookLM';
import Settings from './components/Settings';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  useEffect(() => {
    // Set theme from localstorage or default to dark
    const theme = localStorage.getItem('studysync_theme') || 'dark';
    document.body.classList.toggle('light-theme', theme === 'light');
  }, []);

  const handleApiKeyChange = () => {
    // Left empty for compatibility with settings change handler signature
  };

  const handleSendNoteToAI = (content: string, title: string) => {
    // Save note in temporary location for NotebookLM to pick up
    localStorage.setItem('studysync_imported_note', JSON.stringify({ content, title }));
    setActiveTab('notebook');
  };

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={(tab) => setActiveTab(tab)} />;
      case 'timetable':
        return <Timetable />;
      case 'assignments':
        return <Assignments />;
      case 'notes':
        return <Notes onSendToAI={handleSendNoteToAI} />;
      case 'notebook':
        return <NotebookLM />;
      case 'settings':
        return <Settings onKeyChange={handleApiKeyChange} />;
      default:
        return <Dashboard onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar - Desktop Layout */}
      <aside className="sidebar">
        <div>
          <div className="logo-section">
            <BrainCircuit size={26} />
            <span>StudySync AI</span>
          </div>
          
          <nav className="nav-links">
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard size={20} /> Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('timetable')} 
              className={`nav-item ${activeTab === 'timetable' ? 'active' : ''}`}
            >
              <Calendar size={20} /> Timetable
            </button>
            <button 
              onClick={() => setActiveTab('assignments')} 
              className={`nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
            >
              <CheckSquare size={20} /> Assignments
            </button>
            <button 
              onClick={() => setActiveTab('notes')} 
              className={`nav-item ${activeTab === 'notes' ? 'active' : ''}`}
            >
              <FileText size={20} /> Notebooks
            </button>
            <button 
              onClick={() => setActiveTab('notebook')} 
              className={`nav-item ${activeTab === 'notebook' ? 'active' : ''}`}
            >
              <BrainCircuit size={20} /> AI Workspace
            </button>
          </nav>
        </div>

        <div>
          <button 
            onClick={() => setActiveTab('settings')} 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            style={{ width: '100%' }}
          >
            <SettingsIcon size={20} /> Settings
          </button>
        </div>
      </aside>

      {/* Main viewport */}
      <main className="app-content">
        {renderActiveComponent()}
      </main>

      {/* Bottom Nav Bar - Mobile layout */}
      <nav className="bottom-nav">
        <div className="bottom-nav-links">
          <div 
            onClick={() => setActiveTab('dashboard')} 
            className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={22} />
            <span>Dashboard</span>
          </div>
          <div 
            onClick={() => setActiveTab('timetable')} 
            className={`bottom-nav-item ${activeTab === 'timetable' ? 'active' : ''}`}
          >
            <Calendar size={22} />
            <span>Schedule</span>
          </div>
          <div 
            onClick={() => setActiveTab('assignments')} 
            className={`bottom-nav-item ${activeTab === 'assignments' ? 'active' : ''}`}
          >
            <CheckSquare size={22} />
            <span>Planner</span>
          </div>
          <div 
            onClick={() => setActiveTab('notes')} 
            className={`bottom-nav-item ${activeTab === 'notes' ? 'active' : ''}`}
          >
            <FileText size={22} />
            <span>Notes</span>
          </div>
          <div 
            onClick={() => setActiveTab('notebook')} 
            className={`bottom-nav-item ${activeTab === 'notebook' ? 'active' : ''}`}
          >
            <BrainCircuit size={22} />
            <span>AI Desk</span>
          </div>
          <div 
            onClick={() => setActiveTab('settings')} 
            className={`bottom-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <SettingsIcon size={22} />
            <span>Settings</span>
          </div>
        </div>
      </nav>
    </div>
  );
}

export default App;

