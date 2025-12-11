'use client';

import { useState, useEffect, FormEvent, KeyboardEvent } from 'react';
import { CalendarItem, CalendarEvent, CalendarTask, AIParseResponse, CalendarCreateResponse } from './types/calendar';

interface UserSession {
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface CalendarEventItem {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  isAllDay: boolean;
  attendees: string[];
  link?: string;
  created: string;
}

type ActiveTab = 'create' | 'manage';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('create');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState<CalendarItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [eventSearchQuery, setEventSearchQuery] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const email = params.get('email');
    const refreshToken = params.get('refresh_token');
    const expiresAt = params.get('expires_at');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState({}, '', '/');
    }

    if (accessToken && email) {
      const newSession: UserSession = {
        email,
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresAt: expiresAt ? parseInt(expiresAt) : undefined,
      };
      setSession(newSession);
      localStorage.setItem('calendarSession', JSON.stringify(newSession));
      window.history.replaceState({}, '', '/');
    } else {
      const stored = localStorage.getItem('calendarSession');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
            setSession(parsed);
          } else {
            localStorage.removeItem('calendarSession');
          }
        } catch {
          localStorage.removeItem('calendarSession');
        }
      }
    }

    const savedRecipients = localStorage.getItem('calendarRecipients');
    if (savedRecipients) {
      try {
        setRecipients(JSON.parse(savedRecipients));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('calendarRecipients', JSON.stringify(recipients));
  }, [recipients]);

  useEffect(() => {
    if (activeTab === 'manage' && session) {
      loadCalendarEvents();
    }
  }, [activeTab, session]);

  const loadCalendarEvents = async () => {
    if (!session) return;
    setIsLoadingEvents(true);
    setError(null);
    try {
      const response = await fetch(`/api/calendar/events?access_token=${encodeURIComponent(session.accessToken)}`);
      const result = await response.json();
      if (result.success && result.events) {
        setCalendarEvents(result.events);
      } else {
        setError(result.error || 'Failed to load events');
      }
    } catch {
      setError('Failed to load events. Please try again.');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!session) return;
    const confirmed = window.confirm(`Delete "${eventTitle}"?\n\nCancellation notifications will be sent to all attendees.`);
    if (!confirmed) return;
    setDeletingEventId(eventId);
    setError(null);
    try {
      const response = await fetch(
        `/api/calendar/events/${eventId}?access_token=${encodeURIComponent(session.accessToken)}&send_notifications=true`,
        { method: 'DELETE' }
      );
      const result = await response.json();
      if (result.success) {
        setCalendarEvents(calendarEvents.filter(e => e.id !== eventId));
        setSuccess(`Deleted "${eventTitle}" successfully!`);
      } else {
        setError(result.error || 'Failed to delete event');
      }
    } catch {
      setError('Failed to delete event. Please try again.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const response = await fetch('/api/auth');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError('Failed to get authentication URL');
      }
    } catch {
      setError('Failed to connect to Google');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setSession(null);
    localStorage.removeItem('calendarSession');
    setParsedItems([]);
    setSelectedItems(new Set());
    setCalendarEvents([]);
  };

  const addRecipients = () => {
    const emailsToAdd = recipientInput
      .split(/[\s,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && isValidEmail(e) && !recipients.includes(e));
    if (emailsToAdd.length > 0) {
      setRecipients([...recipients, ...emailsToAdd]);
      setRecipientInput('');
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter(r => r !== email));
  };

  const handleRecipientKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addRecipients();
    }
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getValidEmailCount = () => {
    return recipientInput.split(/[\s,;\n]+/).filter(e => e.trim() && isValidEmail(e.trim())).length;
  };

  const handleParseInput = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setIsParsing(true);
    setError(null);
    setParsedItems([]);
    setSelectedItems(new Set());
    setSuccess(null);
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });
      const result: AIParseResponse = await response.json();
      if (result.success && result.data && result.data.length > 0) {
        setParsedItems(result.data);
        setSelectedItems(new Set(result.data.map((_, i) => i)));
      } else {
        setError(result.error || 'Failed to parse input. No items found.');
      }
    } catch {
      setError('Failed to process your input. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) newSelected.delete(index);
    else newSelected.add(index);
    setSelectedItems(newSelected);
  };

  const selectAll = () => setSelectedItems(new Set(parsedItems.map((_, i) => i)));
  const deselectAll = () => setSelectedItems(new Set());

  const handleCreateSingleEvent = async (index: number) => {
    if (!session || !parsedItems[index]) return;
    setCreatingIndex(index);
    setError(null);
    const item = { ...parsedItems[index] };
    if (recipients.length > 0 && item.type === 'event') {
      (item as CalendarEvent).attendees = [...(item.attendees || []), ...recipients];
    }
    try {
      const response = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: session.accessToken, calendarItem: item, attendees: recipients }),
      });
      const result: CalendarCreateResponse = await response.json();
      if (result.success) {
        const newItems = parsedItems.filter((_, i) => i !== index);
        setParsedItems(newItems);
        const newSelected = new Set<number>();
        selectedItems.forEach(i => {
          if (i < index) newSelected.add(i);
          else if (i > index) newSelected.add(i - 1);
        });
        setSelectedItems(newSelected);
        setSuccess(`Created "${parsedItems[index].title}" successfully!`);
      } else {
        setError(result.error || 'Failed to create event');
      }
    } catch {
      setError('Failed to create event. Please try again.');
    } finally {
      setCreatingIndex(null);
    }
  };

  const handleCreateSelectedEvents = async () => {
    if (!session || selectedItems.size === 0) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    let successCount = 0;
    let failCount = 0;
    const createdIndices: number[] = [];
    for (const index of Array.from(selectedItems).sort((a, b) => b - a)) {
      const item = { ...parsedItems[index] };
      if (recipients.length > 0 && item.type === 'event') {
        (item as CalendarEvent).attendees = [...(item.attendees || []), ...recipients];
      }
      try {
        const response = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: session.accessToken, calendarItem: item, attendees: recipients }),
        });
        const result: CalendarCreateResponse = await response.json();
        if (result.success) {
          successCount++;
          createdIndices.push(index);
        } else failCount++;
      } catch {
        failCount++;
      }
    }
    const newItems = parsedItems.filter((_, i) => !createdIndices.includes(i));
    setParsedItems(newItems);
    setSelectedItems(new Set());
    if (successCount > 0) {
      setSuccess(`Created ${successCount} item${successCount > 1 ? 's' : ''}!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
    }
    if (failCount > 0 && successCount === 0) setError(`Failed to create ${failCount} item${failCount > 1 ? 's' : ''}.`);
    if (newItems.length === 0) setInput('');
    setIsLoading(false);
  };

  const removeItem = (index: number) => {
    const newItems = parsedItems.filter((_, i) => i !== index);
    setParsedItems(newItems);
    const newSelected = new Set<number>();
    selectedItems.forEach(i => {
      if (i < index) newSelected.add(i);
      else if (i > index) newSelected.add(i - 1);
    });
    setSelectedItems(newSelected);
  };

  const formatDateTime = (dateTimeStr: string) => {
    try {
      return new Date(dateTimeStr).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
      });
    } catch { return dateTimeStr; }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  const filteredEvents = calendarEvents.filter(event =>
    event.title.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
    event.attendees.some(a => a.toLowerCase().includes(eventSearchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-red-50 font-sans">
      {/* Fixed Header with Login */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-md shadow-red-200">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-800 hidden sm:block">BSCS Calendar</span>
          </div>

          {/* Login Button */}
          <div className="flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/70 backdrop-blur-md border border-white/60 shadow-neu-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">{session.email}</span>
                  <span className="text-sm font-medium text-gray-700 sm:hidden">Connected</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="text-xs text-gray-500 hover:text-red-600 transition-colors font-medium"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={isConnecting}
                className="btn-primary"
              >
                {isConnecting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-to-br from-red-200 to-rose-300 rounded-full blur-3xl opacity-40" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-gradient-to-tr from-rose-200 to-red-200 rounded-full blur-3xl opacity-30" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-red-100 rounded-full blur-2xl opacity-50" />
      </div>

      <main className="relative z-10 flex min-h-screen w-full flex-col items-center justify-start pt-24 pb-12 px-4 sm:px-8">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-3 tracking-tight">
            BSCS Calendar
          </h1>
          <p className="text-gray-500">
            BSCS Batch 2025 Exclusive calendar Automation
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="w-full max-w-xl mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex p-1.5 rounded-2xl bg-white/40 backdrop-blur-lg shadow-neu border border-white/60">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${activeTab === 'create'
                ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-200'
                : 'text-gray-600 hover:text-red-600 hover:bg-white/50'
                }`}
            >
              ✨ Create
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex-1 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${activeTab === 'manage'
                ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-200'
                : 'text-gray-600 hover:text-red-600 hover:bg-white/50'
                }`}
            >
              📋 Manage
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full max-w-xl mb-6 animate-shake">
            <div className="glass-card p-4 border-red-200 bg-red-50/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shadow-neu-inset">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="w-full max-w-xl mb-6 animate-fade-in">
            <div className="glass-card p-4 border-green-200 bg-green-50/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shadow-neu-inset">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-green-700 font-medium">{success}</p>
                </div>
                <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE TAB */}
        {activeTab === 'create' && (
          <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Recipients */}
            <div className="w-full lg:w-72 flex-shrink-0 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="glass-card p-5 lg:sticky lg:top-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center shadow-neu-inset">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">Recipients</h3>
                    <p className="text-xs text-gray-500">Add classmates</p>
                  </div>
                  {recipients.length > 0 && (
                    <span className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-100 rounded-full">{recipients.length}</span>
                  )}
                </div>

                {/* Add Recipients Input */}
                <div className="flex gap-2 mb-4">
                  <textarea
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={handleRecipientKeyDown}
                    placeholder="Paste emails..."
                    rows={2}
                    className="input-neu flex-1 text-xs"
                  />
                  <button
                    onClick={addRecipients}
                    disabled={getValidEmailCount() === 0}
                    className="px-3 rounded-xl bg-white/80 border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-neu-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {recipientInput.trim() && (
                  <p className="text-xs text-gray-500 mb-3">
                    <span className="text-red-600 font-semibold">{getValidEmailCount()}</span> valid email{getValidEmailCount() !== 1 ? 's' : ''} detected
                  </p>
                )}

                {/* Recipients List */}
                {recipients.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {recipients.map((email, index) => (
                      <div
                        key={index}
                        className="group flex items-center justify-between px-3 py-2 bg-white/80 border border-red-100 text-gray-700 rounded-lg text-xs shadow-sm hover:border-red-300 hover:shadow-md transition-all"
                      >
                        <span className="truncate">{email}</span>
                        <button
                          onClick={() => removeRecipient(email)}
                          className="ml-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-xs">No recipients yet</p>
                  </div>
                )}

                {recipients.length > 0 && (
                  <button
                    onClick={() => setRecipients([])}
                    className="mt-3 text-xs text-gray-500 hover:text-red-600 font-medium transition-colors w-full text-center"
                  >
                    Clear all recipients
                  </button>
                )}
              </div>
            </div>

            {/* Main Content - Input Form */}
            <div className="flex-1 min-w-0">
              <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <form onSubmit={handleParseInput}>
                  <div className="glass-card overflow-hidden">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Paste your to-do list here...

Example:
PEF3
- Submit video (Dec 12)
- Course Evaluation (until Dec 12)
- Performance (on Dec 12)"
                      className="w-full min-h-[180px] px-5 py-4 bg-transparent text-gray-800 text-sm placeholder-gray-400 focus:outline-none resize-none"
                      disabled={isParsing}
                    />
                    <div className="flex justify-between items-center border-t border-white/50 bg-white/30 px-5 py-4">
                      <span className="text-xs text-gray-400">
                        {input.length > 0 && `${input.split('\n').filter(l => l.trim()).length} lines`}
                      </span>
                      <button type="submit" disabled={isParsing || !input.trim()} className="btn-primary">
                        {isParsing ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Parsing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Parse with AI
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Parsed Items */}
              {parsedItems.length > 0 && (
                <div className="w-full max-w-xl animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800">{parsedItems.length} items found</span>
                      <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full shadow-sm">{selectedItems.size} selected</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={selectAll} className="text-xs text-gray-500 hover:text-red-600 font-medium transition-colors">Select all</button>
                      <button onClick={deselectAll} className="text-xs text-gray-500 hover:text-red-600 font-medium transition-colors">Clear</button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {parsedItems.map((item, index) => (
                      <div
                        key={index}
                        onClick={() => toggleItemSelection(index)}
                        className={`glass-card p-4 cursor-pointer transition-all duration-300 ${selectedItems.has(index)
                          ? 'border-red-300 bg-red-50/50 shadow-lg shadow-red-100'
                          : 'hover:shadow-lg'
                          }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${selectedItems.has(index)
                            ? 'bg-gradient-to-br from-red-500 to-rose-500 border-red-500 shadow-md shadow-red-200'
                            : 'border-gray-300 bg-white shadow-neu-inset'
                            }`}>
                            {selectedItems.has(index) && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${item.type === 'event'
                                ? 'text-red-600 bg-red-100'
                                : 'text-amber-600 bg-amber-100'
                                }`}>
                                {item.type === 'event' ? '📅 Event' : '📋 Task'}
                              </span>
                              {item.type === 'task' && (item as CalendarTask).priority && (
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${(item as CalendarTask).priority === 'high' ? 'text-red-600 bg-red-100' :
                                  (item as CalendarTask).priority === 'medium' ? 'text-amber-600 bg-amber-100' : 'text-gray-600 bg-gray-100'
                                  }`}>
                                  {(item as CalendarTask).priority}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-800">{item.title}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {item.type === 'event' ? formatDateTime((item as CalendarEvent).startDateTime) : formatDate((item as CalendarTask).dueDate)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleCreateSingleEvent(index)}
                              disabled={!session || creatingIndex === index}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all disabled:opacity-50"
                            >
                              {creatingIndex === index ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              )}
                            </button>
                            <button onClick={() => removeItem(index)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <button onClick={() => { setParsedItems([]); setSelectedItems(new Set()); }} className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors">
                      Clear all
                    </button>
                    <button
                      onClick={handleCreateSelectedEvents}
                      disabled={isLoading || !session || selectedItems.size === 0}
                      className="btn-primary px-6"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Creating...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Add {selectedItems.size} to Calendar
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {parsedItems.length === 0 && (
                <div className="animate-fade-in">
                  <div className="text-center py-10">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center mx-auto mb-4 shadow-neu">
                      <svg className="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">Paste your to-do list and click <span className="text-red-600 font-semibold">Parse with AI</span></p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MANAGE TAB */}
        {activeTab === 'manage' && (
          <div className="w-full max-w-xl animate-fade-in">
            {!session ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mx-auto mb-4 shadow-neu">
                  <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-gray-500">Connect your Google account to manage events.</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={eventSearchQuery}
                        onChange={(e) => setEventSearchQuery(e.target.value)}
                        placeholder="Search events..."
                        className="input-neu w-full pl-11"
                      />
                    </div>
                    <button
                      onClick={loadCalendarEvents}
                      disabled={isLoadingEvents}
                      className="px-4 rounded-xl bg-white/80 border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-300 hover:shadow-md transition-all disabled:opacity-50 shadow-neu-sm"
                    >
                      <svg className={`w-4 h-4 ${isLoadingEvents ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isLoadingEvents ? (
                  <div className="flex justify-center py-16">
                    <svg className="animate-spin h-8 w-8 text-red-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mx-auto mb-4 shadow-neu">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">{eventSearchQuery ? 'No events found.' : 'No upcoming events.'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.map((event) => (
                      <div key={event.id} className="glass-card p-4 hover:shadow-lg transition-all">
                        <div className="flex items-start gap-4">
                          <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 shadow-md ${event.isAllDay ? 'bg-amber-400 shadow-amber-200' : 'bg-red-500 shadow-red-200'
                            }`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800">{event.title}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {event.isAllDay ? formatDate(event.start) : formatDateTime(event.start)}
                            </p>
                            {event.attendees.length > 0 && (
                              <p className="text-xs text-gray-400 mt-1">{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {event.link && (
                              <a href={event.link} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteEvent(event.id, event.title)}
                              disabled={deletingEventId === event.id}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                            >
                              {deletingEventId === event.id ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredEvents.length > 0 && (
                  <p className="text-center text-gray-400 text-xs mt-6">Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}</p>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
