import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Send, Sparkles, BookOpen, HelpCircle, Trash2, HelpCircle as CardIcon, RefreshCw } from 'lucide-react';
import { extractTextFromPdf } from '../utils/pdfParser';
import { dbService, type SourceFile } from '../services/db';
import { chatWithSources, generateFlashcards, generateQuiz, generateSummary, hasApiKey } from '../services/gemini';

// Interface for Chat Messages
interface Message {
  role: 'user' | 'model';
  parts: string;
}

export default function NotebookLM() {
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'chat' | 'guide' | 'quiz' | 'cards'>('chat');
  const [isKeyConfigured, setIsKeyConfigured] = useState(false);

  // File Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ page: 0, total: 0 });

  // Chat states
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'model', parts: 'Welcome to your AI Notebook Workspace! Upload textbooks, lecture slides, or markdown notes, select the sources you want to study, and ask me questions about them.' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Study Guide / Summary States
  const [studyGuide, setStudyGuide] = useState<string>('');
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);

  // Quiz States
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Flashcards States
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  useEffect(() => {
    loadSources();
    setIsKeyConfigured(hasApiKey());
  }, []);

  useEffect(() => {
    // Scroll chat to bottom on new messages
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadSources = async () => {
    try {
      const allSources = await dbService.getAllSources();
      setSources(allSources);
      // Select all by default
      setSelectedSourceIds(allSources.map(s => s.id));
    } catch (e) {
      console.error(e);
    }
  };

  // Check if a source exists from notes import
  useEffect(() => {
    const checkImportedNote = async () => {
      const pendingImport = localStorage.getItem('studysync_imported_note');
      if (pendingImport) {
        localStorage.removeItem('studysync_imported_note');
        const parsed = JSON.parse(pendingImport);
        
        // Save as a source
        const newSource: SourceFile = {
          id: crypto.randomUUID(),
          name: `${parsed.title}.txt`,
          text: parsed.content || 'Empty note content.',
          size: new Blob([parsed.content]).size,
          type: 'txt',
          createdAt: Date.now()
        };
        await dbService.saveSource(newSource);
        await loadSources();
      }
    };
    checkImportedNote();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ page: 0, total: 0 });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let extractedText = '';

      try {
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          extractedText = await extractTextFromPdf(arrayBuffer, (page, total) => {
            setUploadProgress({ page, total });
          });
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          extractedText = await file.text();
        } else {
          alert(`File format "${file.type}" not supported. Upload PDF, TXT, or Markdown.`);
          continue;
        }

        const newSource: SourceFile = {
          id: crypto.randomUUID(),
          name: file.name,
          text: extractedText,
          size: file.size,
          type: file.type === 'application/pdf' ? 'pdf' : 'txt',
          createdAt: Date.now()
        };

        await dbService.saveSource(newSource);
      } catch (err) {
        console.error(err);
        alert(`Failed to parse file "${file.name}".`);
      }
    }

    setIsUploading(false);
    loadSources();
  };

  const handleDeleteSource = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this source from your workspace?')) {
      await dbService.deleteSource(id);
      setSelectedSourceIds(selectedSourceIds.filter(sid => sid !== id));
      loadSources();
    }
  };

  const handleToggleSelectSource = (id: string) => {
    if (selectedSourceIds.includes(id)) {
      setSelectedSourceIds(selectedSourceIds.filter(sid => sid !== id));
    } else {
      setSelectedSourceIds([...selectedSourceIds, id]);
    }
  };

  const getActiveSources = () => {
    return sources.filter(s => selectedSourceIds.includes(s.id));
  };

  // AI chat call
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isGeneratingChat) return;
    if (!isKeyConfigured) {
      alert('Please configure your Gemini API Key in the Settings page first.');
      return;
    }

    const activeSources = getActiveSources();
    if (activeSources.length === 0) {
      alert('Please select at least one source file from the sidebar to provide context for the AI.');
      return;
    }

    const userMessage: Message = { role: 'user', parts: userInput.trim() };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setUserInput('');
    setIsGeneratingChat(true);

    try {
      const response = await chatWithSources({
        sources: activeSources.map(s => ({ name: s.name, text: s.text })),
        query: userMessage.parts,
        history: chatMessages.slice(-10) // Send last 10 messages for conversation memory
      });

      setChatMessages([...nextMessages, { role: 'model', parts: response }]);
    } catch (err) {
      console.error(err);
      setChatMessages([...nextMessages, { role: 'model', parts: 'Error: Failed to fetch AI response. Please check your internet connection or Gemini API key.' }]);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  // Generate Summary Guide
  const handleGenerateSummaryGuide = async () => {
    if (!isKeyConfigured) return alert('Configure API Key in Settings first.');
    const activeSources = getActiveSources();
    if (activeSources.length === 0) return alert('Select source files for context.');

    setIsGeneratingGuide(true);
    setStudyGuide('');
    try {
      const summary = await generateSummary(activeSources.map(s => ({ name: s.name, text: s.text })));
      setStudyGuide(summary);
    } catch (err) {
      console.error(err);
      alert('Failed to generate summary study guide.');
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  // Generate Quiz
  const handleGenerateQuiz = async () => {
    if (!isKeyConfigured) return alert('Configure API Key in Settings first.');
    const activeSources = getActiveSources();
    if (activeSources.length === 0) return alert('Select source files for context.');

    setIsGeneratingQuiz(true);
    setQuizQuestions([]);
    setSelectedAnswers({});
    try {
      const questions = await generateQuiz(activeSources.map(s => ({ name: s.name, text: s.text })));
      setQuizQuestions(questions);
    } catch (err) {
      console.error(err);
      alert('Failed to generate quiz.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Generate Flashcards
  const handleGenerateFlashcards = async () => {
    if (!isKeyConfigured) return alert('Configure API Key in Settings first.');
    const activeSources = getActiveSources();
    if (activeSources.length === 0) return alert('Select source files for context.');

    setIsGeneratingCards(true);
    setFlashcards([]);
    setFlippedCards({});
    setCurrentCardIndex(0);
    try {
      const cards = await generateFlashcards(activeSources.map(s => ({ name: s.name, text: s.text })));
      setFlashcards(cards);
    } catch (err) {
      console.error(err);
      alert('Failed to generate flashcards.');
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const handleFlipCard = (index: number) => {
    setFlippedCards({ ...flippedCards, [index]: !flippedCards[index] });
  };

  // Formatting Helper for citations and code blocks
  const renderMessageContent = (text: string) => {
    // Simple markdown renderer for headers, bold, list, and line breaks
    return text.split('\n').map((line, i) => {
      let content: React.ReactNode = line;
      
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={i} style={{ fontSize: '15px', fontWeight: 'bold', margin: '12px 0 6px 0' }}>{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={i} style={{ fontSize: '16px', fontWeight: 'bold', margin: '14px 0 8px 0', color: 'var(--color-primary)' }}>{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={i} style={{ fontSize: '18px', fontWeight: '800', margin: '16px 0 10px 0', fontFamily: 'var(--font-heading)' }}>{line.replace('# ', '')}</h2>;
      }

      // Bullets
      if (line.startsWith('- ') || line.startsWith('* ')) {
        content = <li>{line.substring(2)}</li>;
        return <ul key={i} style={{ paddingLeft: '20px', margin: '4px 0' }}>{content}</ul>;
      }

      // Bold text mapping
      const boldRegex = /\*\*(.*?)\*\*/g;
      if (boldRegex.test(line)) {
        const parts = line.split(/\*\*/g);
        content = parts.map((part, index) => index % 2 === 1 ? <strong key={index} style={{ color: 'var(--color-secondary)' }}>{part}</strong> : part);
      }

      return <p key={i} style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '8px' }}>{content}</p>;
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', height: 'calc(100vh - 120px)', minHeight: 0 }}>
      {/* Left Sidebar: Sources Panel */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '18px', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={18} color="var(--color-primary)" /> AI Sources
        </h2>

        {/* Upload Button */}
        <label 
          className="btn btn-secondary" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '8px', 
            padding: '24px 16px',
            border: '2px dashed var(--border-glass)',
            background: 'none',
            borderRadius: '12px',
            cursor: 'pointer'
          }}
        >
          <Upload size={24} color="var(--color-primary)" />
          <span style={{ fontSize: '13px', fontWeight: '600' }}>
            {isUploading ? 'Extracting text...' : 'Upload files'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PDF, TXT, MD</span>
          <input 
            type="file" 
            multiple 
            accept=".pdf,.txt,.md" 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            disabled={isUploading}
          />
        </label>

        {isUploading && uploadProgress.total > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Processing pages: {uploadProgress.page} of {uploadProgress.total}
          </div>
        )}

        {/* Sources Checkbox List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Active Files ({selectedSourceIds.length}/{sources.length})
          </h3>
          
          {sources.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>
              No documents uploaded yet. Upload a syllabus or textbook to start.
            </p>
          ) : (
            sources.map(source => {
              const isChecked = selectedSourceIds.includes(source.id);
              
              return (
                <div 
                  key={source.id}
                  onClick={() => handleToggleSelectSource(source.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: isChecked ? 'rgba(99, 102, 241, 0.05)' : 'none',
                    border: `1px solid ${isChecked ? 'rgba(99, 102, 241, 0.15)' : 'var(--border-glass)'}`,
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={() => {}} // Controlled via parent click
                      style={{ cursor: 'pointer' }}
                    />
                    <FileText size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span 
                      style={{ 
                        fontSize: '13px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                      title={source.name}
                    >
                      {source.name}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteSource(source.id, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Side: Main Workspace Editor/Tabs */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-glass)', padding: '12px 24px' }}>
          <button 
            onClick={() => setActiveWorkspaceTab('chat')}
            className={`btn ${activeWorkspaceTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            AI Chat
          </button>
          <button 
            onClick={() => setActiveWorkspaceTab('guide')}
            className={`btn ${activeWorkspaceTab === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Study Guide
          </button>
          <button 
            onClick={() => setActiveWorkspaceTab('quiz')}
            className={`btn ${activeWorkspaceTab === 'quiz' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            MCQ Quiz
          </button>
          <button 
            onClick={() => setActiveWorkspaceTab('cards')}
            className={`btn ${activeWorkspaceTab === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Flashcards
          </button>
        </div>

        {/* Workspace Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', minHeight: 0 }}>
          
          {/* Tab 1: AI Chat Interface */}
          {activeWorkspaceTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px' }}>
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      background: msg.role === 'user' ? 'var(--grad-primary)' : 'rgba(255,255,255,0.03)',
                      color: '#ffffff',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border-glass)',
                      boxShadow: msg.role === 'user' ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none'
                    }}
                  >
                    {renderMessageContent(msg.parts)}
                  </div>
                ))}
                {isGeneratingChat && (
                  <div style={{ alignSelf: 'flex-start', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={14} className="animate-spin" /> Thinking...
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '16px' }}>
                <input 
                  type="text" 
                  placeholder="Ask a question about the active sources..." 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  style={{ flex: 1 }}
                  disabled={isGeneratingChat}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }} disabled={isGeneratingChat}>
                  <Send size={18} />
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Study Guide */}
          {activeWorkspaceTab === 'guide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div className="flex-between">
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Compile a structured lecture study guide, terms sheet, and notes summary.
                </p>
                <button 
                  onClick={handleGenerateSummaryGuide} 
                  disabled={isGeneratingGuide}
                  className="btn btn-primary"
                  style={{ gap: '8px' }}
                >
                  <Sparkles size={16} /> {isGeneratingGuide ? 'Compiling Guide...' : 'Generate Study Guide'}
                </button>
              </div>

              <div style={{ flex: 1, border: '1px solid var(--border-glass)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', padding: '24px', overflowY: 'auto' }}>
                {isGeneratingGuide ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={24} className="animate-spin" color="var(--color-primary)" />
                    <p>Generating summary from selected sources...</p>
                  </div>
                ) : studyGuide ? (
                  <div className="guide-content" style={{ color: 'var(--text-primary)' }}>
                    {renderMessageContent(studyGuide)}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
                    <FileText size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                    <p>No study guide compiled. Click the button above to generate one.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: MCQ Quiz */}
          {activeWorkspaceTab === 'quiz' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div className="flex-between">
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Generate an interactive multiple-choice test based on the context files.
                </p>
                <button 
                  onClick={handleGenerateQuiz} 
                  disabled={isGeneratingQuiz}
                  className="btn btn-primary"
                  style={{ gap: '8px' }}
                >
                  <Sparkles size={16} /> {isGeneratingQuiz ? 'Building Quiz...' : 'Generate Quiz'}
                </button>
              </div>

              <div style={{ flex: 1, border: '1px solid var(--border-glass)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', padding: '24px', overflowY: 'auto' }}>
                {isGeneratingQuiz ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={24} className="animate-spin" color="var(--color-primary)" />
                    <p>Creating interactive multiple choice questions...</p>
                  </div>
                ) : quizQuestions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {quizQuestions.map((q, qIdx) => {
                      const selectedOpt = selectedAnswers[qIdx];
                      const isCorrect = selectedOpt === q.answerIndex;
                      const hasSubmitted = selectedOpt !== undefined;

                      return (
                        <div key={qIdx} className="glass-card animate-fade-in" style={{ padding: '20px' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '14px', display: 'flex', gap: '8px' }}>
                            <span style={{ color: 'var(--color-primary)' }}>Q{qIdx + 1}.</span> {q.question}
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {q.options.map((opt: string, oIdx: number) => {
                              let optionBg = 'rgba(255,255,255,0.02)';
                              let optionBorder = 'var(--border-glass)';
                              
                              if (hasSubmitted) {
                                if (oIdx === q.answerIndex) {
                                  optionBg = 'rgba(52, 211, 153, 0.15)'; // Green for correct
                                  optionBorder = 'var(--color-success)';
                                } else if (selectedOpt === oIdx) {
                                  optionBg = 'rgba(248, 113, 113, 0.15)'; // Red for wrong selected
                                  optionBorder = 'var(--color-danger)';
                                }
                              } else {
                                // Not submitted hover helper classes can be simulated via inline styles
                              }

                              return (
                                <button
                                  key={oIdx}
                                  onClick={() => {
                                    if (!hasSubmitted) {
                                      setSelectedAnswers({ ...selectedAnswers, [qIdx]: oIdx });
                                    }
                                  }}
                                  disabled={hasSubmitted}
                                  style={{
                                    textAlign: 'left',
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    background: optionBg,
                                    border: `1px solid ${optionBorder}`,
                                    color: '#ffffff',
                                    cursor: hasSubmitted ? 'default' : 'pointer',
                                    transition: 'var(--transition-fast)'
                                  }}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {hasSubmitted && (
                            <div 
                              style={{ 
                                marginTop: '16px', 
                                padding: '12px 16px', 
                                borderRadius: '8px', 
                                background: isCorrect ? 'rgba(52, 211, 153, 0.05)' : 'rgba(248, 113, 113, 0.05)',
                                fontSize: '13px',
                                borderLeft: `4px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-danger)'}`
                              }}
                            >
                              <p style={{ fontWeight: 'bold', color: isCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {isCorrect ? 'Correct!' : 'Incorrect'}
                              </p>
                              <p style={{ color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
                    <HelpCircle size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                    <p>No quiz generated. Click the button above to build one.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Flashcards */}
          {activeWorkspaceTab === 'cards' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div className="flex-between">
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Generate high-yield flip flashcards for concept memory testing.
                </p>
                <button 
                  onClick={handleGenerateFlashcards} 
                  disabled={isGeneratingCards}
                  className="btn btn-primary"
                  style={{ gap: '8px' }}
                >
                  <Sparkles size={16} /> {isGeneratingCards ? 'Generating Cards...' : 'Generate Flashcards'}
                </button>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                {isGeneratingCards ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={24} className="animate-spin" color="var(--color-primary)" />
                    <p>Extracting high-yield study cards...</p>
                  </div>
                ) : flashcards.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '440px' }}>
                    {/* Card container with flip support */}
                    <div 
                      onClick={() => handleFlipCard(currentCardIndex)}
                      style={{
                        width: '100%',
                        height: '240px',
                        cursor: 'pointer',
                        perspective: '1000px',
                      }}
                    >
                      <div 
                        style={{
                          width: '100%',
                          height: '100%',
                          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                          transformStyle: 'preserve-3d',
                          position: 'relative',
                          transform: flippedCards[currentCardIndex] ? 'rotateY(180deg)' : 'rotateY(0deg)'
                        }}
                      >
                        {/* Front Side */}
                        <div 
                          className="glass-panel" 
                          style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '24px',
                            textAlign: 'center',
                            borderWidth: '2px',
                            background: 'rgba(15, 23, 42, 0.85)'
                          }}
                        >
                          <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Card {currentCardIndex + 1} of {flashcards.length}
                          </span>
                          <p style={{ fontSize: '18px', fontWeight: '700', marginTop: '16px', lineHeight: '1.5' }}>
                            {flashcards[currentCardIndex].front}
                          </p>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', position: 'absolute', bottom: '16px' }}>
                            Click to reveal answer
                          </span>
                        </div>

                        {/* Back Side */}
                        <div 
                          className="glass-panel" 
                          style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '24px',
                            textAlign: 'center',
                            borderColor: 'var(--color-secondary)',
                            borderWidth: '2px',
                            background: 'rgba(13, 148, 136, 0.05)'
                          }}
                        >
                          <span style={{ fontSize: '11px', color: 'var(--color-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Definition / Answer
                          </span>
                          <p style={{ fontSize: '15px', marginTop: '16px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                            {flashcards[currentCardIndex].back}
                          </p>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', position: 'absolute', bottom: '16px' }}>
                            Click to flip back
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pagination Controls */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <button 
                        onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                        disabled={currentCardIndex === 0}
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px' }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {currentCardIndex + 1} / {flashcards.length}
                      </span>
                      <button 
                        onClick={() => setCurrentCardIndex(Math.min(flashcards.length - 1, currentCardIndex + 1))}
                        disabled={currentCardIndex === flashcards.length - 1}
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
                    <CardIcon size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                    <p>No flashcards generated. Click the button above to build some.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
