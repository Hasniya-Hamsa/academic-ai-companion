import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, MapPin, User, X, Check, Layers } from 'lucide-react';

interface Semester {
  id: string;
  name: string; // e.g. "Semester 1"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isActive: boolean;
}

interface ClassBlock {
  id: string;
  semesterId: string; // Links to Semester
  subject: string;
  room: string;
  teacher: string;
  day: number; // 1 = Monday, ..., 7 = Sunday
  startTime: string; // "09:00"
  endTime: string; // "10:30"
  color: string;
}

const COLORS = [
  { name: 'Indigo', value: '#818cf8' },
  { name: 'Teal', value: '#2dd4bf' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Purple', value: '#a855f7' }
];

const DAYS = [
  { num: 1, label: 'Mon', full: 'Monday' },
  { num: 2, label: 'Tue', full: 'Tuesday' },
  { num: 3, label: 'Wed', full: 'Wednesday' },
  { num: 4, label: 'Thu', full: 'Thursday' },
  { num: 5, label: 'Fri', full: 'Friday' },
  { num: 6, label: 'Sat', full: 'Saturday' },
  { num: 7, label: 'Sun', full: 'Sunday' }
];

export default function Timetable() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState<string>('');
  const [timetable, setTimetable] = useState<ClassBlock[]>([]);
  const [activeDay, setActiveDay] = useState(1);

  // Modals
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showSemesterModal, setShowSemesterModal] = useState(false);

  // Class Form states
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [day, setDay] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [color, setColor] = useState(COLORS[0].value);

  // Semester Form states
  const [semesterName, setSemesterName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    // Load semesters and timetable
    const rawSemesters = localStorage.getItem('studysync_semesters');
    const rawTimetable = localStorage.getItem('studysync_timetable');

    let loadedSemesters: Semester[] = rawSemesters ? JSON.parse(rawSemesters) : [];
    let loadedTimetable: ClassBlock[] = rawTimetable ? JSON.parse(rawTimetable) : [];

    // Initialize default semester if none exists
    if (loadedSemesters.length === 0) {
      const defaultSem: Semester = {
        id: crypto.randomUUID(),
        name: 'Semester 1',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 months out
        isActive: true
      };
      loadedSemesters = [defaultSem];
      localStorage.setItem('studysync_semesters', JSON.stringify(loadedSemesters));

      // Migrate existing timetable blocks if any
      loadedTimetable = loadedTimetable.map(item => ({
        ...item,
        semesterId: item.semesterId || defaultSem.id
      }));
      localStorage.setItem('studysync_timetable', JSON.stringify(loadedTimetable));
    }

    setSemesters(loadedSemesters);
    setTimetable(loadedTimetable);

    // Set active semester
    const activeSem = loadedSemesters.find(s => s.isActive) || loadedSemesters[0];
    setActiveSemesterId(activeSem.id);

    // Set active day to current day of week
    const currentDay = new Date().getDay();
    setActiveDay(currentDay === 0 ? 7 : currentDay);
  }, []);

  const saveSemesters = (data: Semester[]) => {
    setSemesters(data);
    localStorage.setItem('studysync_semesters', JSON.stringify(data));
  };

  const saveTimetable = (data: ClassBlock[]) => {
    setTimetable(data);
    localStorage.setItem('studysync_timetable', JSON.stringify(data));
  };

  // Add a new Semester
  const handleAddSemester = (e: React.FormEvent) => {
    e.preventDefault();
    if (!semesterName.trim() || !startDate || !endDate) return;

    const newSem: Semester = {
      id: crypto.randomUUID(),
      name: semesterName.trim(),
      startDate,
      endDate,
      isActive: semesters.length === 0 // Active if it's the only one
    };

    const updated = [...semesters, newSem];
    saveSemesters(updated);

    if (newSem.isActive) {
      setActiveSemesterId(newSem.id);
    }

    setSemesterName('');
    setStartDate('');
    setEndDate('');
    setShowSemesterModal(false);
  };

  // Set active semester
  const handleSelectSemester = (id: string) => {
    const updated = semesters.map(s => ({
      ...s,
      isActive: s.id === id
    }));
    saveSemesters(updated);
    setActiveSemesterId(id);
  };

  // Delete semester and its classes
  const handleDeleteSemester = (id: string, name: string) => {
    if (semesters.length === 1) {
      alert('You must keep at least one semester in your profile.');
      return;
    }
    if (confirm(`Delete semester "${name}"? This will also wipe all classes and schedules linked to this semester.`)) {
      const updatedSems = semesters.filter(s => s.id !== id);
      const updatedClasses = timetable.filter(c => c.semesterId !== id);

      // If we deleted the active one, mark another as active
      if (activeSemesterId === id) {
        updatedSems[0].isActive = true;
        setActiveSemesterId(updatedSems[0].id);
      }

      saveSemesters(updatedSems);
      saveTimetable(updatedClasses);
    }
  };

  // Add Class to active semester
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !activeSemesterId) return;

    const newClass: ClassBlock = {
      id: crypto.randomUUID(),
      semesterId: activeSemesterId,
      subject: subject.trim(),
      room: room.trim() || 'Online',
      teacher: teacher.trim() || 'N/A',
      day: Number(day),
      startTime,
      endTime,
      color
    };

    const updated = [...timetable, newClass];
    saveTimetable(updated);

    setSubject('');
    setRoom('');
    setTeacher('');
    setShowAddClassModal(false);
  };

  const handleDeleteClass = (id: string) => {
    if (confirm('Delete this class from your schedule?')) {
      const updated = timetable.filter(c => c.id !== id);
      saveTimetable(updated);
    }
  };

  const activeSemester = semesters.find(s => s.id === activeSemesterId);

  // Filter classes belonging to active semester and active day
  const dayClasses = timetable
    .filter(c => c.semesterId === activeSemesterId && c.day === activeDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header & Controls */}
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)' }}>Semester Timetable</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {activeSemester ? (
              <span>
                Active: <strong>{activeSemester.name}</strong> ({new Date(activeSemester.startDate).toLocaleDateString()} - {new Date(activeSemester.endDate).toLocaleDateString()})
              </span>
            ) : (
              'Manage your academic timetable by semesters.'
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowSemesterModal(true)} 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Layers size={16} /> Manage Semesters
          </button>
          <button 
            onClick={() => { setDay(activeDay); setShowAddClassModal(true); }} 
            className="btn btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Add Class
          </button>
        </div>
      </div>

      {/* Semester Quick-Selector Ribbon */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        {semesters.map(s => (
          <div 
            key={s.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: s.id === activeSemesterId ? 'var(--grad-glow)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${s.id === activeSemesterId ? 'var(--color-primary)' : 'var(--border-glass)'}`,
              cursor: 'pointer'
            }}
            onClick={() => handleSelectSemester(s.id)}
          >
            <span style={{ fontSize: '13px', fontWeight: '600', color: s.id === activeSemesterId ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
              {s.name}
            </span>
            {s.id === activeSemesterId && <Check size={12} color="var(--color-primary)" />}
            {semesters.length > 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteSemester(s.id, s.name); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Day Selector */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-glass)'
      }}>
        {DAYS.map((d) => (
          <button
            key={d.num}
            onClick={() => setActiveDay(d.num)}
            className="btn"
            style={{
              flex: 1,
              minWidth: '60px',
              padding: '12px 8px',
              background: activeDay === d.num ? 'var(--grad-primary)' : 'rgba(255, 255, 255, 0.03)',
              color: activeDay === d.num ? '#fff' : 'var(--text-secondary)',
              border: activeDay === d.num ? '1px solid transparent' : '1px solid var(--border-glass)',
              borderRadius: '10px'
            }}
          >
            <span style={{ fontSize: '13px', display: 'block', fontWeight: 'bold' }}>{d.label}</span>
          </button>
        ))}
      </div>

      {/* Timeline View */}
      <div className="glass-panel" style={{ padding: '24px', minHeight: '300px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>
          {DAYS.find(d => d.num === activeDay)?.full} Schedule
        </h2>

        {dayClasses.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
            <p>No classes scheduled for this day in the current semester.</p>
            <button 
              onClick={() => { setDay(activeDay); setShowAddClassModal(true); }} 
              className="btn btn-outline" 
              style={{ marginTop: '16px', fontSize: '13px' }}
            >
              Add Class
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
            {dayClasses.map((item) => (
              <div 
                key={item.id} 
                className="glass-card animate-fade-in" 
                style={{ 
                  borderLeft: `5px solid ${item.color}`, 
                  padding: '20px', 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{item.subject}</h3>
                  <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '13px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={14} color="var(--text-muted)" /> Room {item.room}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={14} color="var(--text-muted)" /> {item.teacher}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: '500' }}>
                    <Clock size={16} color="var(--color-primary)" />
                    {item.startTime} - {item.endTime}
                  </div>
                  <button 
                    onClick={() => handleDeleteClass(item.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Semester Modal */}
      {showSemesterModal && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '24px', position: 'relative' }}>
            <button 
              onClick={() => setShowSemesterModal(false)}
              style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-heading)' }}>Add New Semester</h2>

            <form onSubmit={handleAddSemester} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Semester Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Fall 2026 / Semester 3" 
                  value={semesterName} 
                  onChange={(e) => setSemesterName(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowSemesterModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create Semester
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Class Modal */}
      {showAddClassModal && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px', position: 'relative' }}>
            <button 
              onClick={() => setShowAddClassModal(false)}
              style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-heading)' }}>
              Add Class to {activeSemester?.name || 'Semester'}
            </h2>

            <form onSubmit={handleAddClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Subject Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Physics I" 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Room / Location</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Room 402" 
                    value={room} 
                    onChange={(e) => setRoom(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Teacher</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Dr. Miller" 
                    value={teacher} 
                    onChange={(e) => setTeacher(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Day of Week</label>
                <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
                  {DAYS.map(d => (
                    <option key={d.num} value={d.num}>{d.full}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Start Time</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Card Color Accent</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c.value,
                        border: color === c.value ? '2px solid white' : '2px solid transparent',
                        boxShadow: color === c.value ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowAddClassModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
