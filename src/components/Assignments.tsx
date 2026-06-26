import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, CheckSquare, Calendar, Sparkles, BrainCircuit, X, ChevronDown, ChevronUp } from 'lucide-react';
import { estimateAssignmentTime, generateStudyPlan, hasApiKey } from '../services/gemini';
import { dbService, type StudyPlan } from '../services/db';

interface Assignment {
  id: string;
  title: string;
  subject: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'progress' | 'done';
  description: string;
  estimatedHours?: number;
  stepsBreakdown?: Array<{ title: string; duration: string; description: string; completed: boolean }>;
}

export default function Assignments() {
  const [activeTab, setActiveTab] = useState<'list' | 'plans'>('list');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [isKeyAvailable, setIsKeyAvailable] = useState(false);

  // Modals and loading
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);

  // Assignment Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [description, setDescription] = useState('');

  // Study Plan Form State
  const [planCourse, setPlanCourse] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planSyllabus, setPlanSyllabus] = useState('');
  const [planHours, setPlanHours] = useState(2);
  const [planLevel, setPlanLevel] = useState('Intermediate');

  useEffect(() => {
    loadAssignments();
    loadStudyPlans();
    setIsKeyAvailable(hasApiKey());
  }, []);

  const loadAssignments = () => {
    const raw = localStorage.getItem('studysync_assignments');
    if (raw) {
      setAssignments(JSON.parse(raw));
    }
  };

  const loadStudyPlans = async () => {
    const plans = await dbService.getAllStudyPlans();
    setStudyPlans(plans);
  };

  const saveAssignmentsData = (data: Assignment[]) => {
    setAssignments(data);
    localStorage.setItem('studysync_assignments', JSON.stringify(data));
  };

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim() || !deadline) return;

    const newAssignment: Assignment = {
      id: crypto.randomUUID(),
      title: title.trim(),
      subject: subject.trim(),
      deadline,
      priority,
      status: 'todo',
      description: description.trim()
    };

    const updated = [...assignments, newAssignment];
    saveAssignmentsData(updated);

    // Reset form
    setTitle('');
    setSubject('');
    setDeadline('');
    setPriority('medium');
    setDescription('');
    setShowAddModal(false);
  };

  const handleDeleteAssignment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this assignment?')) {
      const updated = assignments.filter(a => a.id !== id);
      saveAssignmentsData(updated);
      if (expandedAssignment === id) setExpandedAssignment(null);
    }
  };

  const toggleStatus = (id: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const statuses: Array<'todo' | 'progress' | 'done'> = ['todo', 'progress', 'done'];
    const nextIndex = (statuses.indexOf(currentStatus as any) + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];

    const updated = assignments.map(a => a.id === id ? { ...a, status: nextStatus } : a);
    saveAssignmentsData(updated);
  };

  // AI Workload Estimation
  const handleGenerateEstimation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isKeyAvailable) {
      alert('Please configure your Gemini API Key in the Settings page to use this feature.');
      return;
    }

    const assignment = assignments.find(a => a.id === id);
    if (!assignment) return;

    setIsEstimating(id);
    try {
      const data = await estimateAssignmentTime({
        title: assignment.title,
        subject: assignment.subject,
        description: assignment.description || 'No description provided.'
      });

      const updated = assignments.map(a => {
        if (a.id === id) {
          return {
            ...a,
            estimatedHours: data.estimatedHours,
            stepsBreakdown: data.steps.map((s: any) => ({ ...s, completed: false }))
          };
        }
        return a;
      });

      saveAssignmentsData(updated);
      setExpandedAssignment(id);
    } catch (err) {
      console.error(err);
      alert('Failed to estimate study workload. Check your network or API key.');
    } finally {
      setIsEstimating(null);
    }
  };

  const toggleStepCompleted = (assignmentId: string, stepIndex: number) => {
    const updated = assignments.map(a => {
      if (a.id === assignmentId && a.stepsBreakdown) {
        const steps = [...a.stepsBreakdown];
        steps[stepIndex] = { ...steps[stepIndex], completed: !steps[stepIndex].completed };
        return { ...a, stepsBreakdown: steps };
      }
      return a;
    });
    saveAssignmentsData(updated);
  };

  // AI Study Plan Generator
  const handleGenerateStudyPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKeyAvailable) {
      alert('Please configure your Gemini API Key in Settings first.');
      return;
    }
    if (!planCourse.trim() || !planDate || !planSyllabus.trim()) return;

    setIsPlanning(true);
    try {
      const plan = await generateStudyPlan({
        courseName: planCourse.trim(),
        targetDate: planDate,
        syllabus: planSyllabus.trim(),
        hoursPerDay: Number(planHours),
        knowledgeLevel: planLevel
      });

      const newPlan: StudyPlan = {
        id: crypto.randomUUID(),
        title: plan.title,
        tasks: plan.tasks.map(t => ({
          id: crypto.randomUUID(),
          date: t.date,
          title: t.title,
          description: t.description,
          completed: false
        })),
        createdAt: Date.now()
      };

      await dbService.saveStudyPlan(newPlan);
      await loadStudyPlans();

      // Reset Form
      setPlanCourse('');
      setPlanDate('');
      setPlanSyllabus('');
      setShowPlanModal(false);
      setActiveTab('plans');
    } catch (err) {
      console.error(err);
      alert('Failed to generate study plan. Please verify syllabus details and try again.');
    } finally {
      setIsPlanning(false);
    }
  };

  const togglePlanTaskCompleted = async (planId: string, taskId: string) => {
    const plan = studyPlans.find(p => p.id === planId);
    if (!plan) return;

    const updatedTasks = plan.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    const updatedPlan = { ...plan, tasks: updatedTasks };

    await dbService.saveStudyPlan(updatedPlan);
    await loadStudyPlans();
  };

  const handleDeletePlan = async (id: string) => {
    if (confirm('Are you sure you want to delete this study plan?')) {
      await dbService.deleteStudyPlan(id);
      await loadStudyPlans();
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-heading)' }}>Academic Planner</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage homework deadlines and generate AI-guided revision schedules.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'list' ? (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Add Assignment
            </button>
          ) : (
            <button onClick={() => setShowPlanModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BrainCircuit size={18} /> Generate Plan
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-glass)' }}>
        <button
          onClick={() => setActiveTab('list')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 8px',
            color: activeTab === 'list' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: '600',
            fontFamily: 'var(--font-heading)',
            fontSize: '15px',
            cursor: 'pointer',
            borderBottom: activeTab === 'list' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          Assignments
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 8px',
            color: activeTab === 'plans' ? 'var(--color-primary)' : 'var(--text-secondary)',
            fontWeight: '600',
            fontFamily: 'var(--font-heading)',
            fontSize: '15px',
            cursor: 'pointer',
            borderBottom: activeTab === 'plans' ? '2px solid var(--color-primary)' : '2px solid transparent',
            marginBottom: '-1px'
          }}
        >
          AI Study Plans ({studyPlans.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {assignments.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No homework or assignments logged.</p>
              <button onClick={() => setShowAddModal(true)} className="btn btn-outline" style={{ marginTop: '16px' }}>
                Add Assignment
              </button>
            </div>
          ) : (
            assignments.map((item) => {
              const isExpanded = expandedAssignment === item.id;
              const hasEstimate = item.estimatedHours !== undefined;

              return (
                <div
                  key={item.id}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    cursor: 'pointer',
                    borderColor: isExpanded ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-glass)'
                  }}
                  onClick={() => setExpandedAssignment(isExpanded ? null : item.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Status Toggle Box */}
                      <button
                        onClick={(e) => toggleStatus(item.id, item.status, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: item.status === 'done' ? 'var(--color-success)' : item.status === 'progress' ? 'var(--color-warning)' : 'var(--text-muted)'
                        }}
                      >
                        <CheckSquare size={22} fill={item.status === 'done' ? 'rgba(52, 211, 153, 0.2)' : 'none'} />
                      </button>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.subject}</span>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: item.priority === 'high' ? 'var(--color-danger)' : item.priority === 'medium' ? 'var(--color-warning)' : 'var(--color-primary)'
                          }} />
                        </div>
                        <h3 style={{
                          fontSize: '17px',
                          textDecoration: item.status === 'done' ? 'line-through' : 'none',
                          color: item.status === 'done' ? 'var(--text-secondary)' : 'var(--text-primary)',
                          marginTop: '2px'
                        }}>
                          {item.title}
                        </h3>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        <Calendar size={14} />
                        {new Date(item.deadline).toLocaleDateString()}
                      </div>

                      {!hasEstimate && item.status !== 'done' && (
                        <button
                          onClick={(e) => handleGenerateEstimation(item.id, e)}
                          disabled={isEstimating === item.id}
                          className="btn btn-secondary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            color: 'var(--color-primary)',
                            background: 'var(--grad-glow)'
                          }}
                        >
                          <Sparkles size={12} /> {isEstimating === item.id ? 'Estimating...' : 'AI Estimate'}
                        </button>
                      )}

                      {hasEstimate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', background: 'rgba(99, 102, 241, 0.1)', padding: '4px 8px', borderRadius: '6px', color: 'var(--color-primary)' }}>
                          <Clock size={12} /> {item.estimatedHours} hrs
                        </div>
                      )}

                      <button onClick={(e) => handleDeleteAssignment(item.id, e)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <Trash2 size={16} />
                      </button>

                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded AI Checklist Content */}
                  {isExpanded && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }} onClick={(e) => e.stopPropagation()}>
                      {item.description && (
                        <div style={{ marginBottom: '16px' }}>
                          <p style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-secondary)' }}>Description</p>
                          <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginTop: '4px', lineHeight: '1.5' }}>{item.description}</p>
                        </div>
                      )}

                      {item.stepsBreakdown && (
                        <div>
                          <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <BrainCircuit size={16} /> AI Suggested Steps ({item.stepsBreakdown.filter(s => s.completed).length}/{item.stepsBreakdown.length})
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {item.stepsBreakdown.map((step, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '10px',
                                  padding: '8px 12px',
                                  background: step.completed ? 'rgba(52, 211, 153, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                  borderRadius: '8px',
                                  border: step.completed ? '1px solid rgba(52, 211, 153, 0.1)' : '1px solid var(--border-glass)'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={step.completed}
                                  onChange={() => toggleStepCompleted(item.id, idx)}
                                  style={{ marginTop: '3px', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div className="flex-between">
                                    <span style={{
                                      fontSize: '14px',
                                      fontWeight: '600',
                                      textDecoration: step.completed ? 'line-through' : 'none',
                                      color: step.completed ? 'var(--text-secondary)' : 'var(--text-primary)'
                                    }}>
                                      {step.title}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{step.duration}</span>
                                  </div>
                                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{step.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* AI Study Plans Tab View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {studyPlans.length === 0 ? (
            <div className="glass-panel" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No customized syllabus study plans generated yet.</p>
              <button onClick={() => setShowPlanModal(true)} className="btn btn-outline" style={{ marginTop: '16px' }}>
                Create Custom Study Plan
              </button>
            </div>
          ) : (
            studyPlans.map((plan) => {
              const completedCount = plan.tasks.filter(t => t.completed).length;
              const progress = plan.tasks.length > 0 ? Math.round((completedCount / plan.tasks.length) * 100) : 0;

              return (
                <div key={plan.id} className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
                  <div className="flex-between" style={{ marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '19px', fontWeight: '800' }}>{plan.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                        Generated on {new Date(plan.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={() => handleDeletePlan(plan.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: '20px' }}>
                    <div className="flex-between" style={{ fontSize: '13px', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Tasks: {completedCount}/{plan.tasks.length} completed</span>
                      <span style={{ fontWeight: 'bold' }}>{progress}% Done</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: 'var(--grad-primary)', borderRadius: '4px' }} />
                    </div>
                  </div>

                  {/* Schedule Checkbox Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {plan.tasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          padding: '12px 16px',
                          background: task.completed ? 'rgba(52, 211, 153, 0.04)' : 'rgba(255, 255, 255, 0.01)',
                          border: task.completed ? '1px solid rgba(52, 211, 153, 0.1)' : '1px solid var(--border-glass)',
                          borderRadius: '10px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => togglePlanTaskCompleted(plan.id, task.id)}
                          style={{ marginTop: '4px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div className="flex-between">
                            <span style={{
                              fontWeight: '600',
                              fontSize: '14px',
                              textDecoration: task.completed ? 'line-through' : 'none',
                              color: task.completed ? 'var(--text-secondary)' : 'var(--text-primary)'
                            }}>
                              {task.title}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              background: 'rgba(255,255,255,0.05)',
                              borderRadius: '4px',
                              color: 'var(--text-muted)'
                            }}>
                              {new Date(task.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.4' }}>{task.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddModal && (
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
            <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-heading)' }}>Add New Assignment</h2>

            <form onSubmit={handleAddAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Assignment Title</label>
                <input type="text" placeholder="e.g. Lab Report 3" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Subject</label>
                  <input type="text" placeholder="e.g. Chemistry" value={subject} onChange={(e) => setSubject(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Deadline Date</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Description (Helps AI breakdown)</label>
                <textarea rows={3} placeholder="Provide instructions, rubric, or page length to help AI estimate workload..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Study Plan Generator Modal */}
      {showPlanModal && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setShowPlanModal(false)} style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="var(--color-primary)" /> Generate Study Plan
            </h2>

            <form onSubmit={handleGenerateStudyPlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Course / Exam Name</label>
                <input type="text" placeholder="e.g. Calculus II Midterm" value={planCourse} onChange={(e) => setPlanCourse(e.target.value)} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Exam / Target Date</label>
                  <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Study Hours / Day</label>
                  <input type="number" min={1} max={12} value={planHours} onChange={(e) => setPlanHours(Number(e.target.value))} required />
                </div>
              </div>

              <div className="form-group">
                <label>Knowledge Level</label>
                <select value={planLevel} onChange={(e) => setPlanLevel(e.target.value)}>
                  <option value="Beginner">Beginner (Starting from scratch)</option>
                  <option value="Intermediate">Intermediate (Understand basics)</option>
                  <option value="Advanced">Advanced (Need revision & mock tests)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Syllabus Topics (Be specific)</label>
                <textarea rows={4} placeholder="Enter topics to cover: e.g. Limits, Integration by parts, Taylor series, Volumes of solids of revolution..." value={planSyllabus} onChange={(e) => setPlanSyllabus(e.target.value)} required />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowPlanModal(false)} className="btn btn-secondary" style={{ flex: 1 }} disabled={isPlanning}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, gap: '8px' }} disabled={isPlanning}>
                  {isPlanning ? 'Planning...' : 'Generate Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
