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

  // Recipients/Attendees
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');

  // Manage Events
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [eventSearchQuery, setEventSearchQuery] = useState('');

  // Check for OAuth callback params on mount
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

    // Restore saved recipients
    const savedRecipients = localStorage.getItem('calendarRecipients');
    if (savedRecipients) {
      try {
        setRecipients(JSON.parse(savedRecipients));
      } catch {
        // ignore
      }
    }
  }, []);

  // Save recipients to localStorage when they change
  useEffect(() => {
    localStorage.setItem('calendarRecipients', JSON.stringify(recipients));
  }, [recipients]);

  // Load events when switching to manage tab
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
    } catch (err) {
      setError('Failed to load events. Please try again.');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!session) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${eventTitle}"?\n\nThis will also cancel the event for all attendees who received invites.`
    );

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
        setSuccess(`Deleted "${eventTitle}" and sent cancellation notifications to attendees.`);
      } else {
        setError(result.error || 'Failed to delete event');
      }
    } catch (err) {
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
    } catch (err) {
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
    // Split by spaces, commas, semicolons, or newlines
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

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const getValidEmailCount = () => {
    return recipientInput
      .split(/[\s,;\n]+/)
      .filter(e => e.trim() && isValidEmail(e.trim()))
      .length;
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
    } catch (err) {
      setError('Failed to process your input. Please try again.');
    } finally {
      setIsParsing(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    setSelectedItems(new Set(parsedItems.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

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
        body: JSON.stringify({
          accessToken: session.accessToken,
          calendarItem: item,
          attendees: recipients,
        }),
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
        const recipientText = recipients.length > 0 ? ` (invited ${recipients.length} recipient${recipients.length > 1 ? 's' : ''})` : '';
        setSuccess(`Created "${parsedItems[index].title}" successfully!${recipientText}`);
      } else {
        setError(result.error || 'Failed to create event');
      }
    } catch (err) {
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
          body: JSON.stringify({
            accessToken: session.accessToken,
            calendarItem: item,
            attendees: recipients,
          }),
        });

        const result: CalendarCreateResponse = await response.json();

        if (result.success) {
          successCount++;
          createdIndices.push(index);
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    const newItems = parsedItems.filter((_, i) => !createdIndices.includes(i));
    setParsedItems(newItems);
    setSelectedItems(new Set());

    const recipientText = recipients.length > 0 ? ` (invited ${recipients.length} recipient${recipients.length > 1 ? 's' : ''})` : '';
    if (successCount > 0) {
      setSuccess(`Successfully created ${successCount} item${successCount > 1 ? 's' : ''}!${recipientText}${failCount > 0 ? ` (${failCount} failed)` : ''}`);
    }
    if (failCount > 0 && successCount === 0) {
      setError(`Failed to create ${failCount} item${failCount > 1 ? 's' : ''}.`);
    }

    if (newItems.length === 0) {
      setInput('');
    }

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
      const date = new Date(dateTimeStr);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateTimeStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const filteredEvents = calendarEvents.filter(event =>
    event.title.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
    event.attendees.some(a => a.toLowerCase().includes(eventSearchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 font-sans">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <main className="relative z-10 flex min-h-screen w-full flex-col items-center justify-start py-12 px-4 sm:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-purple-300 text-sm mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            Powered by Google Gemini AI
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent mb-4">
            BSCS Calendar Automation
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            BSCS batch 2025 exclusive calendar automation
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="w-full max-w-2xl mb-6">
          <div className="flex bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-1">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'create'
                ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Events
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'manage'
                ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Manage Events
            </button>
          </div>
        </div>

        {/* Google Account Connection */}
        <div className="w-full max-w-2xl mb-6">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${session ? 'bg-green-500/20' : 'bg-white/10'}`}>
                  <svg className={`w-6 h-6 ${session ? 'text-green-400' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Your Google Account</h3>
                  {session ? (
                    <p className="text-sm text-green-400">{session.email}</p>
                  ) : (
                    <p className="text-sm text-slate-400">Connect to create events</p>
                  )}
                </div>
              </div>
              {session ? (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-300 text-sm font-medium"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnecting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium hover:from-purple-600 hover:to-cyan-600 transition-all duration-300 shadow-lg shadow-purple-500/25 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Connecting...
                    </span>
                  ) : (
                    'Connect Google'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full max-w-2xl mb-6">
            <div className="bg-red-500/10 backdrop-blur-xl rounded-2xl border border-red-500/20 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-400">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="w-full max-w-2xl mb-6">
            <div className="bg-green-500/10 backdrop-blur-xl rounded-2xl border border-green-500/20 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-400">{success}</p>
              <button onClick={() => setSuccess(null)} className="ml-auto text-green-400 hover:text-green-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* CREATE TAB */}
        {activeTab === 'create' && (
          <>
            {/* Recipients Section */}
            <div className="w-full max-w-2xl mb-8">
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Recipients</h3>
                    <p className="text-sm text-slate-400">Add emails to send calendar invites to</p>
                  </div>
                </div>

                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {recipients.map((email, index) => (
                      <div
                        key={index}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-300 rounded-full text-sm"
                      >
                        <span>{email}</span>
                        <button
                          onClick={() => removeRecipient(email)}
                          className="hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <textarea
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      onKeyDown={handleRecipientKeyDown}
                      placeholder="Paste multiple emails here...&#10;Separate with spaces, commas, or new lines&#10;e.g. email1@gmail.com, email2@gmail.com"
                      rows={3}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition-all resize-none text-sm"
                    />
                    <button
                      onClick={addRecipients}
                      disabled={getValidEmailCount() === 0}
                      className="px-4 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed self-end"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  {recipientInput.trim() && (
                    <p className="text-xs text-slate-500">
                      {getValidEmailCount()} valid email{getValidEmailCount() !== 1 ? 's' : ''} detected
                    </p>
                  )}
                </div>

                {recipients.length > 0 && (
                  <p className="text-xs text-slate-500 mt-3">
                    ✨ Events will be created on your calendar and invites will be sent to {recipients.length} recipient{recipients.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Input Form */}
            <div className="w-full max-w-2xl mb-8">
              <form onSubmit={handleParseInput} className="relative">
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Paste your to-do list here... e.g.:

PEF3
- Final Requirement: Practice Assessment (submit video by Dec 12)
- MyClass Course Evaluation (until Dec. 12)
- Non-main Performers Performance (on Dec. 12)`}
                    className="w-full min-h-[180px] rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-white placeholder-slate-500 p-5 pr-14 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all duration-300 resize-none"
                    disabled={isParsing}
                  />
                  <button
                    type="submit"
                    disabled={isParsing || !input.trim()}
                    className="absolute right-4 bottom-4 w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white flex items-center justify-center hover:from-purple-600 hover:to-cyan-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
                  >
                    {isParsing ? (
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Parsed Items List */}
            {parsedItems.length > 0 && (
              <div className="w-full max-w-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-white">
                      {parsedItems.length} Item{parsedItems.length > 1 ? 's' : ''} Found
                    </h2>
                    <span className="text-sm text-slate-400">
                      ({selectedItems.size} selected)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAll}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAll}
                      className="px-3 py-1.5 text-sm rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {parsedItems.map((item, index) => (
                    <div
                      key={index}
                      className={`bg-white/5 backdrop-blur-xl rounded-xl border transition-all duration-300 overflow-hidden ${selectedItems.has(index)
                        ? 'border-purple-500/50 bg-purple-500/5'
                        : 'border-white/10 hover:border-white/20'
                        }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => toggleItemSelection(index)}
                            className={`mt-1 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${selectedItems.has(index)
                              ? 'bg-purple-500 text-white'
                              : 'bg-white/10 border border-white/20'
                              }`}
                          >
                            {selectedItems.has(index) && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.type === 'event'
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                {item.type === 'event' ? '📅 Event' : '📋 Task'}
                              </span>
                              {item.type === 'task' && (item as CalendarTask).priority && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${(item as CalendarTask).priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                  (item as CalendarTask).priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-green-500/20 text-green-400'
                                  }`}>
                                  {(item as CalendarTask).priority}
                                </span>
                              )}
                            </div>
                            <h3 className="text-white font-medium truncate">{item.title}</h3>
                            <p className="text-sm text-slate-400 mt-1">
                              {item.type === 'event'
                                ? formatDateTime((item as CalendarEvent).startDateTime)
                                : `Due: ${formatDate((item as CalendarTask).dueDate)}`
                              }
                            </p>
                            {recipients.length > 0 && (
                              <p className="text-xs text-cyan-400 mt-1">
                                → Will invite: {recipients.slice(0, 2).join(', ')}{recipients.length > 2 ? ` +${recipients.length - 2} more` : ''}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleCreateSingleEvent(index)}
                              disabled={!session || creatingIndex === index}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-medium hover:from-purple-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {creatingIndex === index ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                'Add'
                              )}
                            </button>
                            <button
                              onClick={() => removeItem(index)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between p-4 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
                  <button
                    onClick={() => {
                      setParsedItems([]);
                      setSelectedItems(new Set());
                    }}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-300"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleCreateSelectedEvents}
                    disabled={isLoading || !session || selectedItems.size === 0}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium hover:from-purple-600 hover:to-cyan-600 transition-all duration-300 shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {session
                          ? `Add ${selectedItems.size} Selected${recipients.length > 0 ? ' & Send Invites' : ''}`
                          : 'Connect Google First'
                        }
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Help Text */}
            {parsedItems.length === 0 && (
              <div className="w-full max-w-2xl mt-8">
                <div className="text-center">
                  <h3 className="text-slate-400 font-medium mb-4">How it works:</h3>
                  <div className="grid gap-4 text-left">
                    <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">1️⃣</span>
                        <div>
                          <h4 className="text-white font-medium">Add Recipients (Optional)</h4>
                          <p className="text-sm text-slate-400">Enter email addresses of people who should receive calendar invites</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">2️⃣</span>
                        <div>
                          <h4 className="text-white font-medium">Paste Your To-Do List</h4>
                          <p className="text-sm text-slate-400">The AI will parse it and extract events/tasks automatically</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">3️⃣</span>
                        <div>
                          <h4 className="text-white font-medium">Create & Invite</h4>
                          <p className="text-sm text-slate-400">Events are created on your calendar and invites are sent to all recipients</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* MANAGE TAB */}
        {activeTab === 'manage' && (
          <div className="w-full max-w-2xl">
            {!session ? (
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
                <svg className="w-16 h-16 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-semibold text-white mb-2">Connect Your Google Account</h3>
                <p className="text-slate-400 mb-4">Connect your Google account to view and manage your calendar events.</p>
              </div>
            ) : (
              <>
                {/* Search and Refresh */}
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={eventSearchQuery}
                      onChange={(e) => setEventSearchQuery(e.target.value)}
                      placeholder="Search events by title or attendee..."
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={loadCalendarEvents}
                    disabled={isLoadingEvents}
                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    <svg className={`w-5 h-5 ${isLoadingEvents ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>

                {/* Events List */}
                {isLoadingEvents ? (
                  <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
                    <svg className="w-16 h-16 text-slate-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {eventSearchQuery ? 'No Events Found' : 'No Upcoming Events'}
                    </h3>
                    <p className="text-slate-400">
                      {eventSearchQuery
                        ? 'Try adjusting your search query.'
                        : 'Create some events using the "Create Events" tab!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.map((event) => (
                      <div
                        key={event.id}
                        className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-all"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${event.isAllDay ? 'bg-amber-500/20' : 'bg-purple-500/20'
                              }`}>
                              {event.isAllDay ? (
                                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="text-white font-medium">{event.title}</h3>
                              <p className="text-sm text-slate-400 mt-1">
                                {event.isAllDay
                                  ? formatDate(event.start)
                                  : formatDateTime(event.start)
                                }
                              </p>
                              {event.attendees.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {event.attendees.slice(0, 3).map((attendee, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs"
                                    >
                                      {attendee}
                                    </span>
                                  ))}
                                  {event.attendees.length > 3 && (
                                    <span className="px-2 py-0.5 bg-white/10 text-slate-400 rounded text-xs">
                                      +{event.attendees.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              {event.link && (
                                <a
                                  href={event.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                  title="Open in Google Calendar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteEvent(event.id, event.title)}
                                disabled={deletingEventId === event.id}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                title="Delete event (cancels for all attendees)"
                              >
                                {deletingEventId === event.id ? (
                                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Event count */}
                {filteredEvents.length > 0 && (
                  <p className="text-center text-slate-500 text-sm mt-4">
                    Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} from the past 7 days to 90 days ahead
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
