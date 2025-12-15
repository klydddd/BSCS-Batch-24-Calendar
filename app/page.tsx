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

  // Edit modal state
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    isAllDay: false,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Calendar view state
  type ViewMode = 'list' | 'calendar';
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  const openEditModal = (event: CalendarEventItem) => {
    setEditingEvent(event);

    // Parse date/time from the event
    const startDate = event.start.split('T')[0] || '';
    const endDate = event.end.split('T')[0] || '';

    let startTime = '';
    let endTime = '';

    if (!event.isAllDay && event.start.includes('T')) {
      // Extract time from ISO string (e.g., "2025-12-15T09:00:00+08:00" -> "09:00")
      const startMatch = event.start.match(/T(\d{2}:\d{2})/);
      const endMatch = event.end.match(/T(\d{2}:\d{2})/);
      startTime = startMatch ? startMatch[1] : '';
      endTime = endMatch ? endMatch[1] : '';
    }

    setEditForm({
      title: event.title,
      description: event.description || '',
      startDate,
      startTime,
      endDate,
      endTime,
      isAllDay: event.isAllDay,
    });
  };

  const closeEditModal = () => {
    setEditingEvent(null);
    setEditForm({
      title: '',
      description: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      isAllDay: false,
    });
  };

  const handleUpdateEvent = async () => {
    if (!session || !editingEvent) return;

    setIsUpdating(true);
    setError(null);

    try {
      const updateData: {
        title: string;
        description: string;
        isAllDay: boolean;
        startDateTime?: string;
        endDateTime?: string;
        startDate?: string;
        endDate?: string;
      } = {
        title: editForm.title,
        description: editForm.description,
        isAllDay: editForm.isAllDay,
      };

      if (editForm.isAllDay) {
        updateData.startDate = editForm.startDate;
        updateData.endDate = editForm.endDate || editForm.startDate;
      } else {
        // Combine date and time into ISO format
        updateData.startDateTime = `${editForm.startDate}T${editForm.startTime || '00:00'}:00`;
        updateData.endDateTime = `${editForm.endDate || editForm.startDate}T${editForm.endTime || editForm.startTime || '01:00'}:00`;
      }

      const response = await fetch(`/api/calendar/events/${editingEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: session.accessToken,
          updateData,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          sendNotifications: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update the event in the local state
        setCalendarEvents(calendarEvents.map(e =>
          e.id === editingEvent.id
            ? {
              ...e,
              title: editForm.title,
              description: editForm.description,
              start: editForm.isAllDay
                ? editForm.startDate
                : `${editForm.startDate}T${editForm.startTime}:00`,
              end: editForm.isAllDay
                ? (editForm.endDate || editForm.startDate)
                : `${editForm.endDate || editForm.startDate}T${editForm.endTime}:00`,
              isAllDay: editForm.isAllDay,
            }
            : e
        ));
        setSuccess(`Updated "${editForm.title}" successfully!`);
        closeEditModal();
      } else {
        setError(result.error || 'Failed to update event');
      }
    } catch {
      setError('Failed to update event. Please try again.');
    } finally {
      setIsUpdating(false);
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
        body: JSON.stringify({
          input: input.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }),
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
        body: JSON.stringify({
          accessToken: session.accessToken,
          calendarItem: item,
          attendees: recipients,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
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
          body: JSON.stringify({
            accessToken: session.accessToken,
            calendarItem: item,
            attendees: recipients,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }),
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

  // Calendar view helpers
  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day of the month
    const startPadding = firstDay.getDay();
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    // Add empty slots to complete the last week
    const endPadding = 6 - lastDay.getDay();
    for (let i = 0; i < endPadding; i++) {
      days.push(null);
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    // Format the calendar date as YYYY-MM-DD in local timezone (not UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    return calendarEvents.filter(event => {
      // For all-day events, the start is just a date like "2025-12-16"
      // For timed events, the start is like "2025-12-16T21:00:00+08:00"
      // We need to parse the event date in the correct timezone

      if (event.isAllDay) {
        // All-day events just have a date string
        return event.start === dateStr;
      } else {
        // For timed events, parse the datetime and compare in local timezone
        const eventDateTime = new Date(event.start);
        const eventYear = eventDateTime.getFullYear();
        const eventMonth = String(eventDateTime.getMonth() + 1).padStart(2, '0');
        const eventDay = String(eventDateTime.getDate()).padStart(2, '0');
        const eventDateStr = `${eventYear}-${eventMonth}-${eventDay}`;
        return eventDateStr === dateStr;
      }
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const filteredEvents = calendarEvents.filter(event =>
    event.title.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
    event.attendees.some(a => a.toLowerCase().includes(eventSearchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-red-700">
      {/* Transparent Header on Red */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 py-5">
        <div className="max-w-7xl mx-auto relative flex items-center justify-between">
          {/* Logo - Left */}
          <span className="font-bold text-base tracking-tight text-white">BSCS Calendar</span>

          {/* Tab Navigation - Absolute Center */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-8">
            <button
              onClick={() => setActiveTab('create')}
              className={`tab-link-hero ${activeTab === 'create' ? 'tab-link-hero-active' : ''}`}
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`tab-link-hero ${activeTab === 'manage' ? 'tab-link-hero-active' : ''}`}
            >
              Manage
            </button>
          </div>

          {/* Auth - Right */}
          <div className="flex items-center gap-6">
            {session ? (
              <>
                <span className="text-sm text-white/60 hidden sm:block">{session.email}</span>
                <button onClick={handleDisconnect} className="text-white/80 hover:text-white text-sm font-medium transition-colors">Sign Out</button>
              </>
            ) : (
              <button onClick={handleConnectGoogle} disabled={isConnecting} className="text-white/80 hover:text-white text-sm font-medium transition-colors">
                {isConnecting ? 'Connecting...' : 'Sign In'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Messages - Fixed at top */}
        {error && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-shake">
            <div className="message-box message-box-error">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-xl font-light ml-4">×</button>
            </div>
          </div>
        )}

        {success && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-fade-in">
            <div className="message-box message-box-success">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12l2.5 2.5L16 9" />
                </svg>
                <p className="text-sm text-green-700">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600 text-xl font-light ml-4">×</button>
            </div>
          </div>
        )}

        {/* Hero Section with Glass Overlay */}
        <div className="hero-section">
          {/* Pure Red Background */}
          <div className="hero-bg"></div>

          {/* Massive Title - At bottom */}
          <div className="hero-title-container">
            <p className="hero-subtitle mb-4">
              BSCS Batch 2025 Exclusive Calendar Automation
            </p>
            <h1 className="hero-title">
              BSCS CALENDAR
            </h1>
          </div>

          {/* Glass Container - On top of title */}
          {activeTab === 'create' && (
            <div className="glass-container animate-slide-up">
              <div className="flex flex-col lg:flex-row gap-5 h-full">
                {/* Left Panel - Recipients */}
                <div className="w-full lg:w-72 flex-shrink-0">
                  <div className="glass-panel p-5 h-full">
                    <div className="flex items-center gap-3 mb-5">
                      <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-sm">Recipients</h3>
                        <p className="text-xs text-white/50 mt-0.5">Add classmates</p>
                      </div>
                      {recipients.length > 0 && (
                        <span className="badge-glass">{recipients.length}</span>
                      )}
                    </div>

                    <div className="flex gap-2 mb-4">
                      <textarea
                        value={recipientInput}
                        onChange={(e) => setRecipientInput(e.target.value)}
                        onKeyDown={handleRecipientKeyDown}
                        placeholder="Paste emails..."
                        rows={2}
                        className="input-glass flex-1 text-xs resize-none"
                      />
                      <button
                        onClick={addRecipients}
                        disabled={getValidEmailCount() === 0}
                        className="add-btn-glass"
                      >
                        +
                      </button>
                    </div>

                    {recipientInput.trim() && (
                      <p className="text-xs text-white/60 mb-3">
                        <span className="text-white font-medium">{getValidEmailCount()}</span> valid email{getValidEmailCount() !== 1 ? 's' : ''} detected
                      </p>
                    )}

                    {recipients.length > 0 ? (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto">
                        {recipients.map((email, index) => (
                          <div key={index} className="recipient-item-glass">
                            <span className="truncate text-sm">{email}</span>
                            <button
                              onClick={() => removeRecipient(email)}
                              className="ml-2 text-white/40 hover:text-red-300 transition-colors flex-shrink-0 text-lg font-light"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state-glass">
                        <svg fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M6 20c0-3.5 2.5-6 6-6s6 2.5 6 6" />
                        </svg>
                        <p>No recipients yet</p>
                      </div>
                    )}

                    {recipients.length > 0 && (
                      <button
                        onClick={() => setRecipients([])}
                        className="mt-4 text-xs text-white/60 hover:text-white transition-colors w-full text-center"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Panel - To-Do List Input */}
                <div className="flex-1 min-w-0">
                  <div className="glass-panel p-5 h-full flex flex-col">
                    <form onSubmit={handleParseInput} className="flex-1 flex flex-col">
                      <div className="flex items-center gap-3 mb-4">
                        <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <h3 className="font-semibold text-white text-sm">To-Do List</h3>
                      </div>
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Paste your to-do list here...

Example:
PEF3
- Submit video (Dec 12)
- Course Evaluation (until Dec 12)
- Performance (on Dec 12)"
                        className="flex-1 w-full min-h-[160px] p-4 bg-white/15 border border-white/25 rounded-xl text-white text-sm placeholder-white/60 focus:outline-none focus:border-white/50 focus:bg-white/20 resize-none"
                        disabled={isParsing}
                      />
                      <div className="flex justify-between items-center mt-4">
                        <span className="text-xs text-white/60">
                          {input.length > 0 && `${input.split('\n').filter(l => l.trim()).length} lines`}
                        </span>
                        <button type="submit" disabled={isParsing || !input.trim()} className="btn-glass">
                          {isParsing ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Parsing
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                              </svg>
                              Parse with AI
                            </span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manage Tab Glass Container */}
          {activeTab === 'manage' && (
            <div className="glass-container animate-slide-up">
              {!session ? (
                <div className="glass-panel p-12 max-w-md mx-auto text-center">
                  <svg className="w-14 h-14 mx-auto mb-5 text-white/50" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M7 11V7a5 5 0 1110 0v4" />
                    <circle cx="12" cy="16" r="1" fill="currentColor" />
                  </svg>
                  <p className="text-white/70 text-sm">Connect your Google account to manage events.</p>
                  <button onClick={handleConnectGoogle} className="btn-white mt-8">
                    Sign In with Google
                  </button>
                </div>
              ) : (
                <div className="glass-panel p-5 w-full max-w-4xl mx-auto">
                  {/* Header with search, view toggle, and refresh */}
                  <div className="mb-5">
                    <div className="flex flex-wrap gap-3 items-center">
                      {/* Search - only show in list view */}
                      {viewMode === 'list' && (
                        <div className="flex-1 relative min-w-[200px]">
                          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                          </svg>
                          <input
                            type="text"
                            value={eventSearchQuery}
                            onChange={(e) => setEventSearchQuery(e.target.value)}
                            placeholder="Search events..."
                            className="input-glass w-full pl-11"
                          />
                        </div>
                      )}

                      {/* Calendar navigation - only show in calendar view */}
                      {viewMode === 'calendar' && (
                        <div className="flex-1 flex items-center gap-2">
                          <button
                            onClick={prevMonth}
                            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M15 18l-6-6 6-6" />
                            </svg>
                          </button>
                          <button
                            onClick={goToToday}
                            className="px-3 py-1.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          >
                            Today
                          </button>
                          <button
                            onClick={nextMonth}
                            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </button>
                          <span className="text-white font-semibold ml-2">
                            {formatMonthYear(currentMonth)}
                          </span>
                        </div>
                      )}

                      {/* View Toggle */}
                      <div className="flex bg-white/10 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode('list')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'list'
                            ? 'bg-white/20 text-white'
                            : 'text-white/60 hover:text-white'
                            }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <line x1="8" y1="6" x2="21" y2="6" />
                            <line x1="8" y1="12" x2="21" y2="12" />
                            <line x1="8" y1="18" x2="21" y2="18" />
                            <line x1="3" y1="6" x2="3.01" y2="6" />
                            <line x1="3" y1="12" x2="3.01" y2="12" />
                            <line x1="3" y1="18" x2="3.01" y2="18" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setViewMode('calendar')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'calendar'
                            ? 'bg-white/20 text-white'
                            : 'text-white/60 hover:text-white'
                            }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                            <line x1="9" y1="4" x2="9" y2="10" />
                            <line x1="15" y1="4" x2="15" y2="10" />
                          </svg>
                        </button>
                      </div>

                      {/* Refresh button */}
                      <button onClick={loadCalendarEvents} disabled={isLoadingEvents} className="icon-btn-glass">
                        <svg className={`w-4 h-4 ${isLoadingEvents ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {isLoadingEvents ? (
                    <div className="flex justify-center py-16">
                      <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  ) : viewMode === 'list' ? (
                    /* List View */
                    <>
                      {filteredEvents.length === 0 ? (
                        <div className="text-center py-16">
                          <svg className="w-14 h-14 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          <p className="text-white/50 text-sm">{eventSearchQuery ? 'No events found.' : 'No upcoming events.'}</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[350px] overflow-y-auto">
                          {filteredEvents.map((event) => (
                            <div key={event.id} className="event-card-glass">
                              <div className="flex items-start gap-4">
                                <div className="indicator-dot mt-2" style={{ background: event.isAllDay ? '#fbbf24' : '#3b82f6' }} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-white text-sm">{event.title}</p>
                                  <p className="text-xs text-white/50 mt-1">
                                    {event.isAllDay ? formatDate(event.start) : formatDateTime(event.start)}
                                  </p>
                                  {event.attendees.length > 0 && (
                                    <p className="text-xs text-white/40 mt-0.5">{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {event.link && (
                                    <a href={event.link} target="_blank" rel="noopener noreferrer" className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  )}
                                  <button
                                    onClick={() => openEditModal(event)}
                                    className="p-2 text-white/40 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-all"
                                    title="Edit event"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEvent(event.id, event.title)}
                                    disabled={deletingEventId === event.id}
                                    className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50"
                                    title="Delete event"
                                  >
                                    {deletingEventId === event.id ? (
                                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                        <p className="text-center text-white/40 text-xs mt-5">
                          Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </>
                  ) : (
                    /* Calendar View */
                    <div className="calendar-grid">
                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className="text-center text-xs font-semibold text-white/50 py-2">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {getCalendarDays(currentMonth).map((date, index) => (
                          <div
                            key={index}
                            className={`min-h-[80px] p-1 rounded-lg transition-all ${date
                              ? isToday(date)
                                ? 'bg-white/20 border border-white/40'
                                : 'bg-white/5 hover:bg-white/10'
                              : 'bg-transparent'
                              }`}
                          >
                            {date && (
                              <>
                                <div className={`text-xs font-medium mb-1 ${isToday(date) ? 'text-white' : 'text-white/60'
                                  }`}>
                                  {date.getDate()}
                                </div>
                                <div className="space-y-0.5 overflow-hidden max-h-[56px]">
                                  {getEventsForDate(date).slice(0, 3).map((event) => (
                                    <button
                                      key={event.id}
                                      onClick={() => openEditModal(event)}
                                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate transition-all hover:opacity-80 ${event.isAllDay
                                        ? 'bg-amber-500/30 text-amber-200'
                                        : 'bg-blue-500/30 text-blue-200'
                                        }`}
                                      title={event.title}
                                    >
                                      {event.title}
                                    </button>
                                  ))}
                                  {getEventsForDate(date).length > 3 && (
                                    <p className="text-[10px] text-white/40 px-1">
                                      +{getEventsForDate(date).length - 3} more
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Event count */}
                      <p className="text-center text-white/40 text-xs mt-5">
                        {calendarEvents.length} event{calendarEvents.length !== 1 ? 's' : ''} total
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Parsed Items Section - Below hero */}
        {parsedItems.length > 0 && activeTab === 'create' && (
          <div className="max-w-5xl mx-auto px-6 py-12 animate-slide-up">
            <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/20">
              <div className="flex items-center gap-4">
                <span className="font-bold text-white text-lg">{parsedItems.length} items found</span>
                <span className="px-3 py-1.5 bg-white/20 text-white text-xs font-semibold rounded-full">{selectedItems.size} selected</span>
              </div>
              <div className="flex items-center gap-6">
                <button onClick={selectAll} className="text-white/70 hover:text-white text-sm font-medium transition-colors">Select all</button>
                <button onClick={deselectAll} className="text-white/70 hover:text-white text-sm font-medium transition-colors">Clear</button>
              </div>
            </div>

            <div className="space-y-3">
              {parsedItems.map((item, index) => (
                <div
                  key={index}
                  onClick={() => toggleItemSelection(index)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${selectedItems.has(index)
                    ? 'bg-white/20 border-2 border-white/40'
                    : 'bg-white/10 border-2 border-transparent hover:border-white/20'
                    }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${selectedItems.has(index)
                      ? 'bg-white border-white'
                      : 'border-white/40'
                      }`}>
                      {selectedItems.has(index) && (
                        <svg className="w-3 h-3" fill="none" stroke="#b91c1c" strokeWidth="3" viewBox="0 0 24 24">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${item.type === 'event' ? 'bg-blue-500/30 text-blue-200' : 'bg-amber-500/30 text-amber-200'}`}>
                          {item.type === 'event' ? 'Event' : 'Task'}
                        </span>
                        {item.type === 'task' && (item as CalendarTask).priority && (
                          <span className="px-2 py-0.5 bg-white/10 text-white/70 text-xs font-semibold rounded">
                            {(item as CalendarTask).priority}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-white/60 mt-1.5">
                        {item.type === 'event' ? formatDateTime((item as CalendarEvent).startDateTime) : formatDate((item as CalendarTask).dueDate)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleCreateSingleEvent(index)}
                        disabled={!session || creatingIndex === index}
                        className="p-2.5 text-white/50 hover:text-green-300 hover:bg-green-500/20 rounded-xl transition-all disabled:opacity-30"
                      >
                        {creatingIndex === index ? (
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => removeItem(index)}
                        className="p-2.5 text-white/50 hover:text-red-300 hover:bg-red-500/20 rounded-xl transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/20">
              <button
                onClick={() => { setParsedItems([]); setSelectedItems(new Set()); }}
                className="text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                Clear all
              </button>
              <button
                onClick={handleCreateSelectedEvents}
                disabled={isLoading || !session || selectedItems.size === 0}
                className="px-6 py-3 bg-white text-red-700 font-bold text-sm uppercase tracking-wide rounded-full hover:bg-white/90 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating
                  </span>
                ) : (
                  <span>Add {selectedItems.size} to Calendar</span>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeEditModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg bg-red-800/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">Edit Event</h2>
              <button
                onClick={closeEditModal}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all"
                  placeholder="Event title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/50 focus:bg-white/20 resize-none transition-all"
                  placeholder="Event description (optional)"
                />
              </div>

              {/* All-day toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, isAllDay: !editForm.isAllDay })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isAllDay ? 'bg-blue-500' : 'bg-white/20'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editForm.isAllDay ? 'left-6' : 'left-1'}`} />
                </button>
                <span className="text-sm text-white/80">All-day event</span>
              </div>

              {/* Date/Time inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all [color-scheme:dark]"
                  />
                </div>
                {!editForm.isAllDay && (
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={editForm.startTime}
                      onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                      className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all [color-scheme:dark]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-2">End Date</label>
                  <input
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                    className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all [color-scheme:dark]"
                  />
                </div>
                {!editForm.isAllDay && (
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-2">End Time</label>
                    <input
                      type="time"
                      value={editForm.endTime}
                      onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                      className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all [color-scheme:dark]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
              <button
                onClick={closeEditModal}
                className="px-5 py-2.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateEvent}
                disabled={isUpdating || !editForm.title.trim() || !editForm.startDate}
                className="px-6 py-2.5 bg-white text-red-700 font-bold text-sm rounded-full hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
