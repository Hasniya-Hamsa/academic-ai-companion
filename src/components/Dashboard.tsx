import { useEffect, useState } from 'react';
import { Calendar, BookOpen, Clock, AlertTriangle, ArrowRight, CheckSquare, BrainCircuit, Sparkles } from 'lucide-react';
import { dbService, type StudyPlan } from '../services/db';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [hasKey, setHasKey] = useState(false);
  const [notesCount, setNotesCount] = useState(0);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  
  // Custom suggestion based on upcoming items
  const [aiSuggestion, setAiSuggestion] = useState('Configure your Gemini API key in Settings to get dynamic AI study recommendations!');

  useEffect(() => {
    const key = localStorage.getItem('studysync_gemini_api_key');
    setHasKey(!!key);
    
    // Load counts and items
    loadData();
    if (key) {
      generateLocalSuggestion();
    }
  }, []);

  const loadData = async () => {
    try {
      const notes = await dbService.getAllNotes();
      setNotesCount(notes.length);

      const plans = await dbService.getAllStudyPlans();
      setStudyPlans(plans);

      const rawAssignments = localStorage.getItem('studysync_assignments');
      const loadedAssignments = rawAssignments ? JSON.parse(rawAssignments) : [];
      setAssignments(loadedAssignments);

      const rawTimetable = localStorage.getItem('studysync_timetable');
      const loadedTimetable = rawTimetable ? JSON.parse(rawTimetable) : [];
      setTimetable(loadedTimetable);
    } catch (e) {
      console.error(e);
    }
  };

  const generateLocalSuggestion = () => {
    const rawAssignments = localStorage.getItem('studysync_assignments');
    const loadedAssignments = rawAssignments ? JSON.parse(rawAssignments) : [];
    
    const pending = loadedAssignments.filter((a: any) => a.status !== 'done');
    if (pending.length === 0) {
      setAiSuggestion("You're all caught up! Great job. Use the AI Workspace to upload syllabus notes and prepare for upcoming topics ahead of class.");
    } else {
      // Sort by deadline
      const sorted = [...pending].sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
      const urgent = sorted[0];
      const today = new Date().toISOString().split('T')[0];
      const diffTime = new Date(urgent.deadline).getTime() - new Date(today).getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 2) {
        setAiSuggestion(`Urgent Priority: Your assignment "${urgent.title}" is due in ${diffDays} day(s). Click on the assignment to generate an AI study timeline breakdown and start working on it now!`);
      } else {
        setAiSuggestion(`Study Recommendation: You have some time before "${urgent.title}" is due. We recommend dedicating 45 minutes today to revise topics in the NotebookLM AI workspace.`);
      }
    }
  };

  // Get current day of week (1=Monday, ..., 7=Sunday)
  const getTodayDayNum = () => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day; // map Sunday to 7, Monday to 1
  };

  const getTodayClasses = () => {
    const todayNum = getTodayDayNum();
    const rawSemesters = localStorage.getItem('studysync_semesters');
    const loadedSemesters = rawSemesters ? JSON.parse(rawSemesters) : [];
    const activeSem = loadedSemesters.find((s: any) => s.isActive) || loadedSemesters[0];

    if (!activeSem) return [];

    return timetable
      .filter((item: any) => item.semesterId === activeSem.id && item.day === todayNum)
      .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
  };

  const todayClasses = getTodayClasses();
  const pendingAssignments = assignments.filter((a: any) => a.status !== 'done');
  const dueSoonAssignments = pendingAssignments
    .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3);

  const getCompletedTasksRatio = () => {
    const total = assignments.length;
    if (total === 0) return 0;
    const completed = assignments.filter((a: any) => a.status === 'done').length;
    return Math.round((completed / total) * 100);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header section */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Welcome to your academic cockpit. Here is your status for today.</p>
        </div>
        <button 
          onClick={() => onNavigate('timetable')} 
          className="btn btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Calendar size={16} /> View Schedule
        </button>
      </div>

      {/* API Warning Banner if key is missing */}
      {!hasKey && (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '16px 20px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            borderColor: 'rgba(239, 68, 68, 0.2)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'between',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <AlertTriangle color="var(--color-danger)" size={24} />
            <div>
              <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Gemini API Key Missing</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
                Setup your API key to generate study schedules, estimate workload, and chat with notes.
              </p>
            </div>
          </div>
          <button onClick={() => onNavigate('settings')} className="btn btn-danger" style={{ padding: '8px 16px', fontSize: '13px' }}>
            Configure Key
          </button>
        </div>
      )}

      {/* AI Recommendation Widget */}
      {hasKey && (
        <div 
          className="glass-panel animate-fade-in" 
          style={{ 
            padding: '20px', 
            background: 'var(--grad-glow)', 
            borderColor: 'rgba(99, 102, 241, 0.2)', 
            display: 'flex', 
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <div style={{ 
            background: 'var(--grad-primary)', 
            borderRadius: '10px', 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BrainCircuit size={20} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)' }}>STUDYSYNC AI</h3>
              <Sparkles size={12} color="var(--color-secondary)" />
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginTop: '6px', lineHeight: '1.6' }}>
              {aiSuggestion}
            </p>
          </div>
        </div>
      )}

      {/* Stats Counter Row */}
      <div className="stat-grid">
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--color-primary)' }}>
            <CheckSquare size={24} />
          </div>
          <div className="stat-info">
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Academic Progress</p>
            <h3>{getCompletedTasksRatio()}%</h3>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(20, 184, 166, 0.15)', color: 'var(--color-secondary)' }}>
            <BookOpen size={24} />
          </div>
          <div className="stat-info">
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>My Notebooks</p>
            <h3>{notesCount}</h3>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.15)', color: 'var(--color-warning)' }}>
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Tasks Pending</p>
            <h3>{pendingAssignments.length}</h3>
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout Grid */}
      <div className="db-grid">
        {/* Col 1: Today's Timetable */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={20} color="var(--color-primary)" /> Today's Schedule
          </h2>
          
          {todayClasses.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No classes scheduled for today.</p>
              <button 
                onClick={() => onNavigate('timetable')} 
                className="btn btn-outline" 
                style={{ marginTop: '16px', padding: '6px 14px', fontSize: '12px' }}
              >
                Add Schedule
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {todayClasses.map((item: any) => (
                <div 
                  key={item.id} 
                  className="glass-card" 
                  style={{ 
                    borderLeft: `4px solid ${item.color || 'var(--color-primary)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '15px' }}>{item.subject}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                      Room {item.room} • {item.teacher}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                    <Clock size={14} color="var(--text-muted)" />
                    {item.startTime} - {item.endTime}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Col 2: Due Soon Assignments */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckSquare size={20} color="var(--color-secondary)" /> Due Soon
          </h2>

          {dueSoonAssignments.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No pending assignments!</p>
              <button 
                onClick={() => onNavigate('assignments')} 
                className="btn btn-outline" 
                style={{ marginTop: '16px', padding: '6px 14px', fontSize: '12px' }}
              >
                Add Assignment
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dueSoonAssignments.map((a: any) => {
                const diffTime = new Date(a.deadline).getTime() - new Date().setHours(0,0,0,0);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const isOverdue = diffDays < 0;

                return (
                  <div 
                    key={a.id} 
                    className="glass-card" 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                    onClick={() => onNavigate('assignments')}
                  >
                    <div className="flex-between">
                      <span style={{ 
                        fontSize: '11px', 
                        padding: '2px 8px', 
                        borderRadius: '10px', 
                        background: a.priority === 'high' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                        color: a.priority === 'high' ? 'var(--color-danger)' : 'var(--text-secondary)',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        {a.subject}
                      </span>
                      <span style={{ 
                        fontSize: '12px', 
                        color: isOverdue ? 'var(--color-danger)' : diffDays <= 2 ? 'var(--color-warning)' : 'var(--text-muted)',
                        fontWeight: '600'
                      }}>
                        {isOverdue ? 'Overdue' : diffDays === 0 ? 'Due Today' : diffDays === 1 ? 'Due Tomorrow' : `In ${diffDays} days`}
                      </span>
                    </div>
                    <h4 style={{ fontSize: '14px', fontWeight: '600' }}>{a.title}</h4>
                  </div>
                );
              })}
              <button 
                onClick={() => onNavigate('assignments')} 
                className="btn btn-secondary" 
                style={{ marginTop: '4px', fontSize: '12px', padding: '8px', width: '100%' }}
              >
                Manage All Assignments <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Row 3: Active AI Study Plans */}
        {studyPlans.length > 0 && (
          <div className="glass-panel db-card-full" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BrainCircuit size={20} color="var(--color-primary)" /> Active AI Study Plans
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {studyPlans.slice(0, 2).map((plan) => {
                const completedCount = plan.tasks.filter((t: any) => t.completed).length;
                const progress = plan.tasks.length > 0 ? Math.round((completedCount / plan.tasks.length) * 100) : 0;
                
                return (
                  <div 
                    key={plan.id} 
                    className="glass-card" 
                    style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px' }}
                    onClick={() => onNavigate('assignments')} // Wait, we can manage study plans in planner or assignments
                  >
                    <div>
                      <h4 style={{ fontSize: '16px' }}>{plan.title}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                        Created on {new Date(plan.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Tasks: {completedCount}/{plan.tasks.length}</span>
                        <span style={{ fontWeight: 'bold' }}>{progress}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--grad-primary)', borderRadius: '3px' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
