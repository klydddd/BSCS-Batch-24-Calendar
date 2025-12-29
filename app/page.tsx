'use client';

import { useState, useEffect, FormEvent, KeyboardEvent, useRef, Fragment } from 'react';
import { CalendarItem, CalendarEvent, CalendarTask, AIParseResponse, CalendarCreateResponse } from './types/calendar';
import { Analytics } from '@vercel/analytics/next';
import { Snowfall } from 'react-snowfall';
import html2canvas from 'html2canvas';
import Tesseract from 'tesseract.js';
import Link from 'next/link';

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

type ActiveTab = 'create' | 'manage' | 'schedule';

interface ScheduleEntry {
  id: string;
  subject: string;
  room: string;
  day: string;
  startTime: string;
  endTime: string;
  color: string;
}

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

  // Class schedule state
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingScheduleEntry, setEditingScheduleEntry] = useState<ScheduleEntry | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    subject: '',
    room: '',
    day: 'Monday',
    startTime: '07:00',
    endTime: '08:00',
    color: '#3b82f6'
  });

  // Drag selection state for schedule
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: string; timeIndex: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ day: string; timeIndex: number } | null>(null);

  // Mobile schedule view state
  const [selectedMobileDay, setSelectedMobileDay] = useState('Monday');
  const [isMobileView, setIsMobileView] = useState(false);

  // Export schedule state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOrientation, setExportOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [isExporting, setIsExporting] = useState(false);
  const scheduleExportRef = useRef<HTMLDivElement>(null);

  // Export customization options
  const [exportTitle, setExportTitle] = useState('My Class Schedule');
  const [exportTheme, setExportTheme] = useState<'red' | 'blue' | 'green' | 'purple' | 'dark'>('red');
  const [showTimeLabels, setShowTimeLabels] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showRoomInfo, setShowRoomInfo] = useState(true);
  const [watermarkText, setWatermarkText] = useState('BSCS CALENDAR');
  const [visibleDays, setVisibleDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  const [hideEmptyCells, setHideEmptyCells] = useState(false);
  const [autoFitTime, setAutoFitTime] = useState(false); // Hide excess time rows outside schedule range

  const toggleVisibleDay = (day: string) => {
    if (visibleDays.includes(day)) {
      if (visibleDays.length > 1) { // Prevent hiding all days
        setVisibleDays(visibleDays.filter(d => d !== day));
      }
    } else {
      // Sort days according to WEEK order
      const newDays = [...visibleDays, day];
      const WEEK_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      newDays.sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
      setVisibleDays(newDays);
    }
  };

  // OCR state
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrPreviewImage, setOcrPreviewImage] = useState<string | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // Check for mobile view on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Schedule helper functions
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TIME_SLOTS: string[] = [];
  for (let hour = 7; hour <= 19; hour++) {
    TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 19) {
      TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }

  const formatTimeLabel = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  // Get filtered time slots based on actual schedule entries (for auto-fit time feature)
  const getFilteredTimeSlots = (entries: ScheduleEntry[], allSlots: string[]): string[] => {
    if (entries.length === 0) return allSlots;

    // Find earliest start and latest end times from all entries
    let earliestMinutes = Infinity;
    let latestMinutes = 0;

    entries.forEach(entry => {
      const startParts = entry.startTime.split(':').map(Number);
      const endParts = entry.endTime.split(':').map(Number);
      const startMins = startParts[0] * 60 + startParts[1];
      const endMins = endParts[0] * 60 + endParts[1];

      if (startMins < earliestMinutes) earliestMinutes = startMins;
      if (endMins > latestMinutes) latestMinutes = endMins;
    });

    // Round down earliest to previous hour, round up latest to next hour
    const earliestHour = Math.floor(earliestMinutes / 60);
    const latestHour = Math.ceil(latestMinutes / 60);

    // Filter time slots to only include those within the range
    return allSlots.filter(slot => {
      const slotMinutes = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
      const slotHour = parseInt(slot.split(':')[0]);
      // Include slots from earliestHour to latestHour (exclusive end)
      return slotHour >= earliestHour && slotMinutes < latestHour * 60;
    });
  };

  const getScheduleEntry = (day: string, time: string) => {
    return scheduleEntries.find(entry => {
      if (entry.day !== day) return false;
      // Convert to minutes for accurate comparison
      const entryStartMins = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
      const entryEndMins = parseInt(entry.endTime.split(':')[0]) * 60 + parseInt(entry.endTime.split(':')[1]);
      const slotMins = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
      return slotMins >= entryStartMins && slotMins < entryEndMins;
    });
  };

  // Check if any entry starts within this 30-min slot window
  const isSlotStart = (day: string, time: string) => {
    const slotMins = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
    const slotEndMins = slotMins + 30;
    return scheduleEntries.some(entry => {
      if (entry.day !== day) return false;
      const entryStartMins = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
      // Entry starts within this 30-min slot
      return entryStartMins >= slotMins && entryStartMins < slotEndMins;
    });
  };

  // Get entries that start within a given slot window (for rendering)
  const getEntriesStartingInSlot = (day: string, time: string) => {
    const slotMins = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
    const slotEndMins = slotMins + 30;
    return scheduleEntries.filter(entry => {
      if (entry.day !== day) return false;
      const entryStartMins = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
      return entryStartMins >= slotMins && entryStartMins < slotEndMins;
    });
  };

  // Calculate the offset within a slot (0-100%) for entries not starting exactly on :00 or :30
  const getSlotOffset = (entry: ScheduleEntry, slotTime: string) => {
    const slotMins = parseInt(slotTime.split(':')[0]) * 60 + parseInt(slotTime.split(':')[1]);
    const entryStartMins = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
    const offsetMins = entryStartMins - slotMins;
    return (offsetMins / 30) * 100; // Percentage of the 30-min slot
  };

  const getSlotSpan = (entry: ScheduleEntry) => {
    const startMinutes = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
    const endMinutes = parseInt(entry.endTime.split(':')[0]) * 60 + parseInt(entry.endTime.split(':')[1]);
    // Use Math.ceil to ensure classes ending at non-standard times (like :45) cover all slots
    return Math.ceil((endMinutes - startMinutes) / 30);
  };

  const openScheduleModal = (day?: string, time?: string) => {
    setEditingScheduleEntry(null);
    setScheduleForm({
      subject: '',
      room: '',
      day: day || 'Monday',
      startTime: time || '07:00',
      endTime: time ? `${(parseInt(time.split(':')[0]) + 1).toString().padStart(2, '0')}:${time.split(':')[1]}` : '08:00',
      color: '#3b82f6'
    });
    setShowScheduleModal(true);
  };

  const openEditScheduleModal = (entry: ScheduleEntry) => {
    setEditingScheduleEntry(entry);
    setScheduleForm({
      subject: entry.subject,
      room: entry.room || '',
      day: entry.day,
      startTime: entry.startTime,
      endTime: entry.endTime,
      color: entry.color
    });
    setShowScheduleModal(true);
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setEditingScheduleEntry(null);
    setScheduleForm({
      subject: '',
      room: '',
      day: 'Monday',
      startTime: '07:00',
      endTime: '08:00',
      color: '#3b82f6'
    });
  };

  const handleSaveScheduleEntry = () => {
    if (!scheduleForm.subject.trim()) return;

    if (editingScheduleEntry) {
      // Update existing entry
      const updatedEntries = scheduleEntries.map(e =>
        e.id === editingScheduleEntry.id
          ? { ...e, ...scheduleForm }
          : e
      );
      setScheduleEntries(updatedEntries);
      localStorage.setItem('classSchedule', JSON.stringify(updatedEntries));
    } else {
      // Add new entry
      const newEntry: ScheduleEntry = {
        id: Date.now().toString(),
        ...scheduleForm
      };
      const updatedEntries = [...scheduleEntries, newEntry];
      setScheduleEntries(updatedEntries);
      localStorage.setItem('classSchedule', JSON.stringify(updatedEntries));
    }
    closeScheduleModal();
  };

  const handleDeleteScheduleEntry = (id: string) => {
    const updatedEntries = scheduleEntries.filter(e => e.id !== id);
    setScheduleEntries(updatedEntries);
    localStorage.setItem('classSchedule', JSON.stringify(updatedEntries));
  };

  // Drag selection handlers
  const handleDragStart = (day: string, timeIndex: number) => {
    setIsDragging(true);
    setDragStart({ day, timeIndex });
    setDragEnd({ day, timeIndex });
  };

  const handleDragMove = (day: string, timeIndex: number) => {
    if (isDragging && dragStart && dragStart.day === day) {
      setDragEnd({ day, timeIndex });
    }
  };

  const handleDragEnd = () => {
    if (isDragging && dragStart && dragEnd && dragStart.day === dragEnd.day) {
      const startIndex = Math.min(dragStart.timeIndex, dragEnd.timeIndex);
      const endIndex = Math.max(dragStart.timeIndex, dragEnd.timeIndex);

      const startTime = TIME_SLOTS[startIndex];
      // End time should be 30 minutes after the last selected slot
      const endTimeIndex = endIndex + 1;
      const endTime = endTimeIndex < TIME_SLOTS.length ? TIME_SLOTS[endTimeIndex] : '19:00';

      setEditingScheduleEntry(null);
      setScheduleForm({
        subject: '',
        room: '',
        day: dragStart.day,
        startTime: startTime,
        endTime: endTime,
        color: '#3b82f6'
      });
      setShowScheduleModal(true);
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const isInDragRange = (day: string, timeIndex: number) => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    if (day !== dragStart.day) return false;

    const minIndex = Math.min(dragStart.timeIndex, dragEnd.timeIndex);
    const maxIndex = Math.max(dragStart.timeIndex, dragEnd.timeIndex);

    return timeIndex >= minIndex && timeIndex <= maxIndex;
  };

  // Load schedule from localStorage on mount
  useEffect(() => {
    const savedSchedule = localStorage.getItem('classSchedule');
    if (savedSchedule) {
      try {
        setScheduleEntries(JSON.parse(savedSchedule));
      } catch {
        // ignore
      }
    }
  }, []);

  const SCHEDULE_COLORS = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];

  // Export schedule as PNG
  const handleExportSchedule = async () => {
    setIsExporting(true);

    try {
      // Create a temporary container for the export
      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'absolute';
      exportContainer.style.left = '-9999px';
      exportContainer.style.top = '0';

      // Set dimensions based on orientation - larger for more time slots
      const isLandscape = exportOrientation === 'landscape';
      const width = isLandscape ? 1400 : 900;
      const height = isLandscape ? 900 : 1600; // Taller to fit all time slots

      // Theme colors
      const themeGradients: Record<string, string> = {
        red: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #7f1d1d 100%)',
        blue: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1e3a5f 100%)',
        green: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #14532d 100%)',
        purple: 'linear-gradient(135deg, #4c1d95 0%, #6b21a8 50%, #4c1d95 100%)',
        dark: 'linear-gradient(135deg, #1f2937 0%, #111827 50%, #1f2937 100%)',
      };

      const themeBorderColors: Record<string, string> = {
        red: 'rgba(139,0,0,0.5)',
        blue: 'rgba(30,64,175,0.5)',
        green: 'rgba(22,101,52,0.5)',
        purple: 'rgba(107,33,168,0.5)',
        dark: 'rgba(75,85,99,0.5)',
      };

      exportContainer.style.width = `${width}px`;
      exportContainer.style.height = `${height}px`;
      exportContainer.style.background = themeGradients[exportTheme];
      exportContainer.style.padding = isLandscape ? '30px' : '40px 30px';
      exportContainer.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
      exportContainer.style.boxSizing = 'border-box';

      // Calculate dimensions
      const containerPadding = isLandscape ? 30 : 40;
      const innerWidth = width - (containerPadding * 2);
      const innerHeight = height - (containerPadding * 2);

      // Use all time slots (30-min intervals) for accurate positioning
      // When autoFitTime is enabled, filter to only show time range that contains classes
      const exportTimeSlots = autoFitTime ? getFilteredTimeSlots(scheduleEntries, TIME_SLOTS) : TIME_SLOTS;
      const numRows = exportTimeSlots.length;

      // Calculate cell dimensions - ensure all rows fit
      const titleHeight = isLandscape ? 40 : 50;
      const footerHeight = showFooter ? 30 : 0;
      const headerRowHeight = isLandscape ? 28 : 32;
      const timeLabelWidth = showTimeLabels ? (isLandscape ? 60 : 70) : 10;
      const gridGap = 2; // Smaller gap for more rows

      // Fixed cell height to ensure all rows fit
      const availableGridHeight = innerHeight - titleHeight - footerHeight - 40 - headerRowHeight;
      const totalGapHeight = (numRows - 1) * gridGap;
      const cellHeight = Math.floor((availableGridHeight - totalGapHeight) / numRows);
      const dayColumnWidth = Math.floor((innerWidth - timeLabelWidth - 40 - (visibleDays.length * gridGap)) / visibleDays.length);

      const borderColor = themeBorderColors[exportTheme];

      // Build grid cells HTML
      let gridCells = '';

      // Header row with day names
      gridCells += `<div style="grid-column: 1; grid-row: 1;"></div>`;
      visibleDays.forEach((day, i) => {
        const shortDay = isLandscape ? day.slice(0, day.length) : day.slice(0, 3);
        gridCells += `
          <div style="
            grid-column: ${i + 2}; 
            grid-row: 1; 
            background: rgba(255,255,255,0.15); 
            border-radius: 6px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            text-align: center;
            font-size: ${isLandscape ? '12px' : '13px'}; 
            font-weight: 600; 
            color: rgba(255,255,255,0.95);
            padding-bottom: 12px; 
            height: 100%;
            box-sizing: border-box;
          ">
            ${shortDay}
          </div>
        `;
      });

      // Time slots and day cells - 30 minute resolution
      exportTimeSlots.forEach((time, rowIndex) => {
        const gridRow = rowIndex + 2;
        const timeLabel = formatTimeLabel(time);
        const isFullHour = time.endsWith(':00');

        // Time label - only show for full hours
        gridCells += `
          <div style="
            grid-column: 1; 
            grid-row: ${gridRow}; 
            font-size: ${isLandscape ? '9px' : '10px'}; 
            color: rgba(255,255,255,0.5); 
            text-align: right; 
            padding-right: 8px; 
            display: flex; 
            align-items: center; 
            justify-content: flex-end;
          ">
            ${showTimeLabels && isFullHour ? timeLabel : ''}
          </div>
        `;

        // Day cells
        visibleDays.forEach((day, dayIndex) => {
          // Check if any entry STARTS within this 30-min slot window
          const slotStartTotal = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
          const slotEndTotal = slotStartTotal + 30;

          const entryStartingHere = scheduleEntries.find(e => {
            if (e.day !== day) return false;
            const entryStartMins = parseInt(e.startTime.split(':')[0]) * 60 + parseInt(e.startTime.split(':')[1]);
            return entryStartMins >= slotStartTotal && entryStartMins < slotEndTotal;
          });

          // Check if there's an entry covering this slot (but started earlier)
          const coveringEntry = !entryStartingHere ? scheduleEntries.find(e => {
            if (e.day !== day) return false;
            const entryStartMins = parseInt(e.startTime.split(':')[0]) * 60 + parseInt(e.startTime.split(':')[1]);
            const entryEndMins = parseInt(e.endTime.split(':')[0]) * 60 + parseInt(e.endTime.split(':')[1]);
            return slotStartTotal >= entryStartMins && slotStartTotal < entryEndMins;
          }) : null;

          if (entryStartingHere) {
            const entry = entryStartingHere;
            const startMinutes = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
            const endMinutes = parseInt(entry.endTime.split(':')[0]) * 60 + parseInt(entry.endTime.split(':')[1]);
            // Span is in 30-minute units
            const spanSlots = Math.ceil((endMinutes - startMinutes) / 30);

            gridCells += `
              <div style="
                grid-column: ${dayIndex + 2};
                grid-row: ${gridRow} / span ${spanSlots};
                background: ${entry.color}50;
                border-left: 4px solid ${entry.color};
                border-radius: 6px;
                padding: 6px 8px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
              ">
                <div style="font-size: ${isLandscape ? '11px' : '13px'}; font-weight: 700; color: white; word-wrap: break-word; line-height: 1.3;">
                  ${entry.subject}
                </div>
                ${(showRoomInfo && entry.room) ? `<div style="font-size: ${isLandscape ? '9px' : '10px'}; color: rgba(255,255,255,0.8); margin-top: 3px;">${entry.room}</div>` : ''}
                <div style="font-size: ${isLandscape ? '8px' : '9px'}; color: rgba(255,255,255,0.7); margin-top: auto; padding-top: 3px;">
                  ${formatTimeLabel(entry.startTime)} - ${formatTimeLabel(entry.endTime)}
                </div>
              </div>
            `;
          } else if (coveringEntry) {
            // This slot is covered by an entry that started earlier - skip rendering
          } else if (!hideEmptyCells) {
            // Empty cell - minimal styling for 30-min slots (only if not hiding empty)
            gridCells += `
              <div style="
                grid-column: ${dayIndex + 2};
                grid-row: ${gridRow};
                background: rgba(0,0,0,0.1);
                border-radius: 2px;
                ${isFullHour ? `border-top: 1px solid ${borderColor};` : ''}
              "></div>
            `;
          }
        });
      });

      const scheduleHTML = `
        <div style="
          height: 100%; 
          display: flex; 
          flex-direction: column;
          box-sizing: border-box;
          padding: 10px;
          position: relative;
        ">
          ${watermarkText ? `
            <div style="
              position: absolute;
              bottom: 20px;
              left: 0;
              right: 0;
              width: 100%;
              text-align: left;
              font-size: ${isLandscape ? '120px' : '100px'};
              font-weight: 900;
              color: rgba(255,255,255,0.05);
              text-transform: uppercase;
              pointer-events: none;
              user-select: none;
              line-height: 1;
            ">
              ${watermarkText}
            </div>
          ` : ''}
          
          <h2 style="
            color: white; 
            font-size: ${isLandscape ? '20px' : '24px'}; 
            font-weight: 800; 
            margin: 0 0 16px 0; 
            text-align: center;
            letter-spacing: -0.02em;
            position: relative;
            z-index: 1;
          ">
            ${exportTitle}
          </h2>
          
          <div style="
            flex: 1;
            display: grid;
            grid-template-columns: ${timeLabelWidth}px repeat(${visibleDays.length}, 1fr);
            grid-template-rows: ${headerRowHeight}px repeat(${numRows}, ${cellHeight}px);
            gap: ${gridGap}px;
            position: relative;
            z-index: 1;
            overflow: hidden;
          ">
            ${gridCells}
          </div>
          
          ${showFooter ? `
            <p style="
              text-align: center; 
              font-size: ${isLandscape ? '11px' : '12px'}; 
              color: rgba(255,255,255,0.5); 
              margin: 16px 0 0 0;
              position: relative;
              z-index: 1;
            ">
              ${scheduleEntries.length} class${scheduleEntries.length !== 1 ? 'es' : ''} scheduled
            </p>
          ` : ''}
        </div>
      `;

      exportContainer.innerHTML = scheduleHTML;
      document.body.appendChild(exportContainer);

      // Capture with html2canvas
      const canvas = await html2canvas(exportContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      // Remove the temporary container
      document.body.removeChild(exportContainer);

      // Download the image
      const link = document.createElement('a');
      link.download = `my-class-schedule-${exportOrientation}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting schedule:', error);
      alert('Failed to export schedule. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Parse schedule string like "M 8:00AM-11:00AM" or "TTh 1:00PM-2:30PM"
  const parseScheduleTime = (scheduleStr: string): { day: string; startTime: string; endTime: string }[] => {
    const results: { day: string; startTime: string; endTime: string }[] = [];

    // Clean up the string - remove (ab), (lab), etc.
    const cleanStr = scheduleStr.replace(/\([^)]*\)/g, '').trim();

    // Day mappings
    const dayMappings: Record<string, string[]> = {
      'M': ['Monday'],
      'T': ['Tuesday'],
      'W': ['Wednesday'],
      'TH': ['Thursday'],
      'F': ['Friday'],
      'S': ['Saturday'],
      'SU': ['Sunday'],
      'MW': ['Monday', 'Wednesday'],
      'MF': ['Monday', 'Friday'],
      'WF': ['Wednesday', 'Friday'],
      'MWF': ['Monday', 'Wednesday', 'Friday'],
      'TTH': ['Tuesday', 'Thursday'],
      'TT': ['Tuesday', 'Thursday'],
      'MTH': ['Monday', 'Thursday'],
      'MWTH': ['Monday', 'Wednesday', 'Thursday'],
      'MTTH': ['Monday', 'Tuesday', 'Thursday'],
      'MTWTH': ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      'MTWTHF': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    };

    // Parse day codes from string (handle TH as Thursday)
    const parseDayCodes = (code: string): string[] => {
      const upperCode = code.toUpperCase();
      if (dayMappings[upperCode]) {
        return dayMappings[upperCode];
      }

      // Parse individual characters
      const days: string[] = [];
      let i = 0;
      while (i < upperCode.length) {
        if (i < upperCode.length - 1 && upperCode.slice(i, i + 2) === 'TH') {
          days.push('Thursday');
          i += 2;
        } else if (i < upperCode.length - 1 && upperCode.slice(i, i + 2) === 'SU') {
          days.push('Sunday');
          i += 2;
        } else {
          const char = upperCode[i];
          if (char === 'M') days.push('Monday');
          else if (char === 'T') days.push('Tuesday');
          else if (char === 'W') days.push('Wednesday');
          else if (char === 'F') days.push('Friday');
          else if (char === 'S') days.push('Saturday');
          i++;
        }
      }
      return days;
    };

    // Pattern: "M 8:00AM-11:00AM" or "TH 3:00PM-5:00PM" (no space before AM/PM)
    const pattern1 = /([A-Z]+)\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/gi;

    // Pattern: "M 8:00 AM - 11:00 AM" (with spaces)
    const pattern2 = /([A-Z]+)\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/gi;

    let matches = [...cleanStr.matchAll(pattern1)];
    if (matches.length === 0) {
      matches = [...cleanStr.matchAll(pattern2)];
    }

    for (const match of matches) {
      const dayCode = match[1];
      let startHour = parseInt(match[2]);
      const startMin = parseInt(match[3]);
      const startPeriod = match[4].toUpperCase();
      let endHour = parseInt(match[5]);
      const endMin = parseInt(match[6]);
      const endPeriod = match[7].toUpperCase();

      // Convert to 24-hour format
      if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
      if (startPeriod === 'AM' && startHour === 12) startHour = 0;
      if (endPeriod === 'PM' && endHour !== 12) endHour += 12;
      if (endPeriod === 'AM' && endHour === 12) endHour = 0;

      const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

      const days = parseDayCodes(dayCode);
      for (const day of days) {
        if (!results.some(r => r.day === day && r.startTime === startTime && r.endTime === endTime)) {
          results.push({ day, startTime, endTime });
        }
      }
    }

    return results;
  };

  // Handle OCR image upload
  const handleOCRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setOcrPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setIsProcessingOCR(true);
    setOcrProgress(0);
    setOcrStatus('Analyzing image with AI...');

    try {
      // Create form data for the Gemini API
      const formData = new FormData();
      formData.append('image', file);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setOcrProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Call the Gemini API endpoint
      const response = await fetch('/api/parse-schedule', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setOcrProgress(100);

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse schedule');
      }

      setOcrStatus('Processing schedule data...');

      const parsedEntries = result.data as { subjectCode: string; day: string; startTime: string; endTime: string; room?: string }[];
      console.log('Parsed entries from Gemini:', parsedEntries);

      if (!parsedEntries || parsedEntries.length === 0) {
        setOcrStatus('No schedule entries found. Please try a clearer image or enter manually.');
        return;
      }

      // Convert to ScheduleEntry format
      const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
      const newEntries: ScheduleEntry[] = [];

      // Map to track colors assigned to each subject
      const subjectColorMap = new Map<string, string>();
      let colorIndex = 0;

      // First, check existing entries for already assigned colors
      for (const existingEntry of scheduleEntries) {
        if (!subjectColorMap.has(existingEntry.subject)) {
          subjectColorMap.set(existingEntry.subject, existingEntry.color);
        }
      }

      for (const entry of parsedEntries) {
        // Handle potentially combined days (e.g., "Monday, Thursday")
        const entryDays = entry.day.split(/,|&| and /).map(d => d.trim());
        const subjectName = entry.subjectCode || `Class ${colorIndex + 1}`;

        // Get or assign color for this subject
        let subjectColor = subjectColorMap.get(subjectName);
        if (!subjectColor) {
          // Assign new color for this subject
          subjectColor = colorPalette[colorIndex % colorPalette.length];
          subjectColorMap.set(subjectName, subjectColor);
          colorIndex++;
        }

        for (const dayname of entryDays) {
          // Normalize day name
          let normalizedDay = dayname;
          if (dayname.toLowerCase().startsWith('mon')) normalizedDay = 'Monday';
          else if (dayname.toLowerCase().startsWith('tue')) normalizedDay = 'Tuesday';
          else if (dayname.toLowerCase().startsWith('wed')) normalizedDay = 'Wednesday';
          else if (dayname.toLowerCase().startsWith('thu')) normalizedDay = 'Thursday';
          else if (dayname.toLowerCase().startsWith('fri')) normalizedDay = 'Friday';
          else if (dayname.toLowerCase().startsWith('sat')) normalizedDay = 'Saturday';
          else if (dayname.toLowerCase().startsWith('sun')) normalizedDay = 'Sunday';

          // Check if this entry already exists
          const exists = newEntries.some(e =>
            e.day === normalizedDay &&
            e.startTime === entry.startTime &&
            e.endTime === entry.endTime
          ) || scheduleEntries.some(e =>
            e.day === normalizedDay &&
            e.startTime === entry.startTime &&
            e.endTime === entry.endTime
          );

          if (!exists && entry.startTime && entry.endTime && normalizedDay) {
            newEntries.push({
              id: `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              subject: subjectName,
              day: normalizedDay,
              startTime: entry.startTime,
              endTime: entry.endTime,
              color: subjectColor,
              room: entry.room || '',
            });
          }
        }
      }

      console.log('Total entries to add:', newEntries.length);

      if (newEntries.length > 0) {
        // Add new entries to existing schedule and save to localStorage
        const updatedEntries = [...scheduleEntries, ...newEntries];
        setScheduleEntries(updatedEntries);
        localStorage.setItem('classSchedule', JSON.stringify(updatedEntries));
        setOcrStatus(`Successfully added ${newEntries.length} class${newEntries.length !== 1 ? 'es' : ''} to your schedule!`);

        // Close modal after a delay
        setTimeout(() => {
          setShowOCRModal(false);
          setOcrPreviewImage(null);
          setOcrProgress(0);
          setOcrStatus('');
        }, 2000);
      } else {
        setOcrStatus('No new schedule entries found (duplicates may have been skipped).');
      }
    } catch (error) {
      console.error('AI Error:', error);
      setOcrStatus(error instanceof Error ? error.message : 'Error processing image. Please try again.');
    } finally {
      setIsProcessingOCR(false);
      // Reset file input
      if (ocrFileInputRef.current) {
        ocrFileInputRef.current.value = '';
      }
    }
  };

  const filteredEvents = calendarEvents.filter(event =>
    event.title.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
    event.attendees.some(a => a.toLowerCase().includes(eventSearchQuery.toLowerCase()))
  );

  return (

    <div className="min-h-screen bg-red-700">


      {/* Transparent Header on Red */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 py-5">

        <div className="max-w-7xl mx-auto flex items-center justify-between sm:relative">
          {/* Logo - Left (hidden on mobile) */}
          <span className="font-bold text-base tracking-tight text-white hidden sm:block sm:flex-shrink-0">BSCS Calendar</span>

          {/* Tab Navigation - Centered on desktop, flex on mobile */}
          <div className="flex items-center gap-2 sm:gap-8 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            <button
              onClick={() => setActiveTab('create')}
              className={`tab-link-hero text-[10px] sm:text-sm whitespace-nowrap ${activeTab === 'create' ? 'tab-link-hero-active' : ''}`}
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`tab-link-hero text-[10px] sm:text-sm whitespace-nowrap ${activeTab === 'manage' ? 'tab-link-hero-active' : ''}`}
            >
              Manage
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`tab-link-hero text-[10px] sm:text-sm whitespace-nowrap ${activeTab === 'schedule' ? 'tab-link-hero-active' : ''}`}
            >
              Schedule
            </button>
          </div>

          {/* Auth - Right */}
          <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
            {session ? (
              <>
                <span className="text-sm text-white/60 hidden sm:block">{session.email}</span>
                <button
                  onClick={handleDisconnect}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xsgt font-semibold rounded-full transition-all border border-white/20"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={isConnecting}
                className={`${isMobileView ? 'h-[36px] w-[80px]' : 'h-[36px] w-[100px]'}  px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xs font-semibold rounded-full transition-all border border-white/20 disabled:opacity-50`}
              >
                {isConnecting ? '...' : 'Sign In'}
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
          <Snowfall
            // Controls the number of snowflakes that are created (default 150)
            snowflakeCount={200}

          ></Snowfall>
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
            <div
              className={`animate-slide-up ${isMobileView ? 'fixed inset-0 top-14 z-40 bg-red-900/95' : 'glass-container'}`}
              style={{ maxWidth: isMobileView ? '100%' : '900px', paddingTop: isMobileView ? '10px' : '80px' }}
            >
              {!session ? (
                <div className={`${isMobileView ? 'mx-4 mt-8 bg-black/30 backdrop-blur-sm rounded-2xl p-8 border border-white/10 text-center' : 'glass-panel p-12 max-w-md mx-auto text-center'}`}>
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
                <div className={`w-full mx-auto ${isMobileView ? 'h-full p-4 pt-2 overflow-y-auto flex flex-col pb-20' : 'glass-panel p-5 w-full max-w-4xl'}`}>
                  {/* Header with search, view toggle, and refresh */}
                  <div className="mb-4">
                    {/* Calendar Navigation for calendar view - full width on mobile */}
                    {viewMode === 'calendar' && (
                      <div className={`flex items-center justify-between mb-3 ${isMobileView ? 'gap-2' : 'gap-3'}`}>
                        <button
                          onClick={prevMonth}
                          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={goToToday}
                            className="px-3 py-1.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          >
                            Today
                          </button>
                          <span className="text-white font-semibold">
                            {formatMonthYear(currentMonth)}
                          </span>
                        </div>
                        <button
                          onClick={nextMonth}
                          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2 items-center">
                      {/* Search - only show in list view */}
                      {viewMode === 'list' && (
                        <div className="flex-1 relative">
                          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                          </svg>
                          <input
                            type="text"
                            value={eventSearchQuery}
                            onChange={(e) => setEventSearchQuery(e.target.value)}
                            placeholder="Search events..."
                            className={`input-glass w-full ${isMobileView ? 'pl-9 py-2.5 text-sm' : 'pl-11'}`}
                          />
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
                        <div className={`space-y-2 ${isMobileView ? 'overflow-y-auto flex-1' : 'max-h-[350px] overflow-y-auto'}`}>
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
                    <div className={`calendar-grid ${isMobileView ? 'flex-1 flex flex-col overflow-hidden' : ''}`}>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-1 mb-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} className={`text-center font-semibold text-white/50 py-1 ${isMobileView ? 'text-[10px]' : 'text-xs'}`}>
                            {isMobileView ? day.charAt(0) : day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar grid - flex-1 to fill remaining height */}
                      <div className={`grid grid-cols-7 gap-1 ${isMobileView ? 'flex-1' : ''}`} style={isMobileView ? { gridAutoRows: '1fr' } : undefined}>
                        {getCalendarDays(currentMonth).map((date, index) => (
                          <div
                            key={index}
                            className={`${isMobileView ? '' : 'min-h-[80px]'} p-1 rounded-lg transition-all ${date
                              ? isToday(date)
                                ? 'bg-white/20 border border-white/40'
                                : 'bg-white/5 hover:bg-white/10'
                              : 'bg-transparent'
                              }`}
                          >
                            {date && (
                              <>
                                <div className={`${isMobileView ? 'text-[10px]' : 'text-xs'} font-medium mb-0.5 ${isToday(date) ? 'text-white' : 'text-white/60'
                                  }`}>
                                  {date.getDate()}
                                </div>
                                <div className={`space-y-0.5 overflow-hidden ${isMobileView ? 'flex-1' : 'max-h-[56px]'}`}>
                                  {getEventsForDate(date).slice(0, isMobileView ? 2 : 3).map((event) => (
                                    <button
                                      key={event.id}
                                      onClick={() => openEditModal(event)}
                                      className={`w-full text-left px-1 py-0.5 rounded ${isMobileView ? 'text-[8px]' : 'text-[10px]'} truncate transition-all hover:opacity-80 ${event.isAllDay
                                        ? 'bg-amber-500/30 text-amber-200'
                                        : 'bg-blue-500/30 text-blue-200'
                                        }`}
                                      title={event.title}
                                    >
                                      {isMobileView ? event.title.substring(0, 4) + (event.title.length > 4 ? '...' : '') : event.title}
                                    </button>
                                  ))}
                                  {getEventsForDate(date).length > (isMobileView ? 2 : 3) && (
                                    <p className={`${isMobileView ? 'text-[8px]' : 'text-[10px]'} text-white/40 px-1`}>
                                      +{getEventsForDate(date).length - (isMobileView ? 2 : 3)} more
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Event count */}
                      <p className="text-center text-white/40 text-xs mt-4">
                        {calendarEvents.length} event{calendarEvents.length !== 1 ? 's' : ''} total
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Schedule Tab Glass Container */}
          {activeTab === 'schedule' && (
            <div
              className={`animate-slide-up ${isMobileView ? 'fixed inset-0 top-14 z-40 bg-red-900/95' : 'glass-container'}`}
              style={{ maxWidth: isMobileView ? '100%' : '1400px', paddingTop: isMobileView ? '10px' : '80px' }}
            >
              <div className={`w-full mx-auto ${isMobileView ? 'h-full p-4 pt-2 overflow-hidden flex flex-col' : 'glass-panel p-3 sm:p-5 '}`}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-white/80 hidden sm:block" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <line x1="9" y1="4" x2="9" y2="10" />
                      <line x1="15" y1="4" x2="15" y2="10" />
                    </svg>
                    <div>
                      <h3 className="font-semibold text-white text-sm py-2">My Class Schedule</h3>
                      {/* <p className="text-xs text-white/50 mt-0.5 hidden sm:block">Click on a time slot to add a class</p> */}
                      {/* <p className="text-xs text-white/50 mt-0.5 sm:hidden">Tap & hold to select time range</p> */}
                    </div>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                    {/* Import from Image button */}
                    <button
                      onClick={() => setShowOCRModal(true)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xs font-semibold rounded-full transition-all border border-white/20"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        <path d="M12 11V8m0 0l-2 2m2-2l2 2" />
                      </svg>
                      <span className="hidden sm:inline">Import from Image</span>
                      <span className="sm:hidden truncate">Import</span>
                    </button>
                    {scheduleEntries.length > 0 && (
                      <button
                        onClick={() => setShowExportModal(true)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-xs font-semibold rounded-full transition-all border border-white/20"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">Save as PNG</span>
                        <span className="sm:hidden truncate">Save</span>
                      </button>
                    )}
                    {scheduleEntries.length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to clear all ${scheduleEntries.length} classes from your schedule?`)) {
                            setScheduleEntries([]);
                            localStorage.removeItem('classSchedule');
                          }
                        }}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] sm:text-xs font-semibold rounded-full transition-all border border-red-500/30"
                      >
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span className="hidden sm:inline">Clear</span>
                        <span className="sm:hidden truncate">Clear</span>
                      </button>
                    )}
                    <button
                      onClick={() => openScheduleModal()}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 bg-red-500/50 hover:bg-red-500/60 text-white text-[10px] sm:text-xs font-semibold rounded-full transition-all border border-white/20"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="hidden sm:inline">Add Class</span>
                      <span className="sm:hidden truncate">Add</span>
                    </button>
                  </div>
                </div>

                {/* Mobile Day Selector */}
                {isMobileView && (
                  <div className="mb-4">
                    <div className="grid grid-cols-7 gap-1 w-full">
                      {DAYS.map(day => {
                        const dayEntries = scheduleEntries.filter(e => e.day === day);
                        return (
                          <button
                            key={day}
                            onClick={() => setSelectedMobileDay(day)}
                            className={`py-2 px-1 rounded-lg text-[10px] sm:text-xs font-medium transition-all relative ${selectedMobileDay === day
                              ? 'bg-white/20 text-white'
                              : 'bg-white/5 text-white/60 active:bg-white/10'
                              }`}
                          >
                            {day.slice(0, 3)}
                            {dayEntries.length > 0 && (
                              <span className="absolute -top-1 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[9px] rounded-full flex items-center justify-center">
                                {dayEntries.length}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Swipe hint */}
                    {/* <p className="text-center text-[9px] text-white/30 mt-1">← Swipe to change days →</p> */}
                  </div>
                )}

                {/* Drag hint */}
                {isDragging && dragStart && dragEnd && (
                  <div className="text-center text-xs text-white/70 py-2 mb-2 bg-blue-500/20 rounded-lg animate-pulse">
                    📌 {formatTimeLabel(TIME_SLOTS[Math.min(dragStart.timeIndex, dragEnd.timeIndex)])} - {formatTimeLabel(TIME_SLOTS[Math.max(dragStart.timeIndex, dragEnd.timeIndex) + 1] || '19:00')}
                  </div>
                )}

                {/* Schedule Grid */}
                <div
                  className="select-none"
                  onMouseUp={handleDragEnd}
                  onTouchEnd={handleDragEnd}
                  onMouseLeave={() => {
                    if (isDragging) {
                      setIsDragging(false);
                      setDragStart(null);
                      setDragEnd(null);
                    }
                  }}
                >
                  {/* Desktop View - Full Week */}
                  {!isMobileView && (
                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="min-w-[900px]">
                        {/* Schedule Grid Container - Single CSS Grid for proper row spanning */}
                        <div
                          className="max-h-[550px] overflow-y-auto scrollbar-hide"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '60px repeat(7, 1fr)',
                            gridTemplateRows: `auto repeat(${TIME_SLOTS.length}, minmax(24px, auto))`,
                            gap: '2px',
                          }}
                        >
                          {/* Header Row */}
                          <div className="sticky top-0 z-10 "></div>
                          {DAYS.map(day => (
                            <div key={day} className="sticky top-0 z-10  p-1.5 text-center text-xs font-semibold text-white/80">
                              {day}
                            </div>
                          ))}

                          {/* Time Slots and Day Cells */}
                          {TIME_SLOTS.map((time, timeIndex) => (
                            <Fragment key={time}>
                              {/* Time Label */}
                              <div
                                key={`time-${time}`}
                                className="p-1 text-[10px] text-white/60 text-right flex items-center justify-end pr-2"
                                style={{ gridColumn: 1, gridRow: timeIndex + 2 }}
                              >
                                {time.endsWith(':00') ? formatTimeLabel(time) : ''}
                              </div>

                              {/* Day Cells */}
                              {DAYS.map((day, dayIndex) => {
                                const entry = getScheduleEntry(day, time);
                                const isStart = isSlotStart(day, time);

                                // Skip cells that are covered by a multi-slot entry
                                if (entry && !isStart) {
                                  return null;
                                }

                                if (entry && isStart) {
                                  const span = getSlotSpan(entry);
                                  return (
                                    <div
                                      key={`${day}-${time}`}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => openEditScheduleModal(entry)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          openEditScheduleModal(entry);
                                        }
                                      }}
                                      className="relative p-1.5 rounded-lg text-left transition-all hover:opacity-80 group cursor-pointer"
                                      style={{
                                        gridColumn: dayIndex + 2,
                                        gridRow: `${timeIndex + 2} / span ${span}`,
                                        backgroundColor: `${entry.color}40`,
                                        borderLeft: `3px solid ${entry.color}`,
                                      }}
                                    >
                                      <p className="text-[10px] font-semibold text-white truncate">{entry.subject}</p>
                                      {entry.room && (
                                        <p className="text-[9px] text-white/60 truncate">{entry.room}</p>
                                      )}
                                      <p className="text-[9px] text-white/50 mt-0.5">
                                        {formatTimeLabel(entry.startTime)} - {formatTimeLabel(entry.endTime)}
                                      </p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm(`Delete "${entry.subject}"?`)) {
                                            handleDeleteScheduleEntry(entry.id);
                                          }
                                        }}
                                        className="absolute top-0.5 right-0.5 p-0.5 text-white/40 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-all"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                          <path d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  );
                                }

                                // Empty cell
                                const isSelected = isInDragRange(day, timeIndex);
                                return (
                                  <div
                                    key={`${day}-${time}`}
                                    data-day={day}
                                    data-time-index={timeIndex}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleDragStart(day, timeIndex);
                                    }}
                                    onMouseEnter={() => handleDragMove(day, timeIndex)}
                                    onTouchStart={(e) => {
                                      e.preventDefault();
                                      handleDragStart(day, timeIndex);
                                    }}
                                    onTouchMove={(e) => {
                                      const touch = e.touches[0];
                                      const element = document.elementFromPoint(touch.clientX, touch.clientY);
                                      const targetDay = element?.getAttribute('data-day');
                                      const targetTimeIndex = element?.getAttribute('data-time-index');
                                      if (targetDay && targetTimeIndex) {
                                        handleDragMove(targetDay, parseInt(targetTimeIndex));
                                      }
                                    }}
                                    className={`p-1 rounded transition-all cursor-pointer touch-none ${isSelected
                                      ? 'bg-blue-500/40 border border-blue-400/60'
                                      : time.endsWith(':00')
                                        ? 'bg-white/5 hover:bg-white/20'
                                        : 'bg-white/[0.02] hover:bg-white/20'
                                      }`}
                                    style={{
                                      gridColumn: dayIndex + 2,
                                      gridRow: timeIndex + 2,
                                    }}
                                  />
                                );
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mobile View - Single Day */}
                  {isMobileView && (
                    <div
                      className="touch-pan-y flex flex-col h-full"
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        (e.currentTarget as HTMLElement).dataset.touchStartX = touch.clientX.toString();
                      }}
                      onTouchEnd={(e) => {
                        const touchStartX = parseFloat((e.currentTarget as HTMLElement).dataset.touchStartX || '0');
                        const touchEndX = e.changedTouches[0].clientX;
                        const diff = touchEndX - touchStartX;

                        if (Math.abs(diff) > 50) {
                          const currentIndex = DAYS.indexOf(selectedMobileDay);
                          if (diff > 0 && currentIndex > 0) {
                            setSelectedMobileDay(DAYS[currentIndex - 1]);
                          } else if (diff < 0 && currentIndex < DAYS.length - 1) {
                            setSelectedMobileDay(DAYS[currentIndex + 1]);
                          }
                        }
                      }}
                    >
                      {/* Current Day Header */}
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => {
                            const currentIndex = DAYS.indexOf(selectedMobileDay);
                            if (currentIndex > 0) setSelectedMobileDay(DAYS[currentIndex - 1]);
                          }}
                          disabled={DAYS.indexOf(selectedMobileDay) === 0}
                          className="p-2 text-white/60 hover:text-white disabled:opacity-30 transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                        </button>
                        <h4 className="text-white font-semibold ">{selectedMobileDay}</h4>
                        <button
                          onClick={() => {
                            const currentIndex = DAYS.indexOf(selectedMobileDay);
                            if (currentIndex < DAYS.length - 1) setSelectedMobileDay(DAYS[currentIndex + 1]);
                          }}
                          disabled={DAYS.indexOf(selectedMobileDay) === DAYS.length - 1}
                          className="p-2 text-white/60 hover:text-white disabled:opacity-30 transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>

                      {/* Time Slots for Selected Day */}
                      <div className="flex-1 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                        {TIME_SLOTS.map((time, timeIndex) => {
                          const entry = getScheduleEntry(selectedMobileDay, time);
                          const isStart = isSlotStart(selectedMobileDay, time);
                          const isSelected = isInDragRange(selectedMobileDay, timeIndex);

                          if (entry && !isStart) {
                            return null;
                          }

                          if (entry && isStart) {
                            const span = getSlotSpan(entry);
                            return (
                              <div
                                key={time}
                                className="flex gap-2"
                              >
                                <div className="w-14 text-[10px] text-white/60 text-right pt-2 flex-shrink-0">
                                  {formatTimeLabel(time)}
                                </div>
                                <button
                                  onClick={() => openEditScheduleModal(entry)}
                                  className="flex-1 relative p-2 rounded-xl text-left transition-all active:scale-[0.98]"
                                  style={{
                                    backgroundColor: `${entry.color}40`,
                                    borderLeft: `4px solid ${entry.color}`,
                                    minHeight: `${span * 44}px`
                                  }}
                                >
                                  <p className="text-sm font-semibold text-white">{entry.subject}</p>
                                  {entry.room && (
                                    <p className="text-xs text-white/60 flex items-center gap-1 mt-1">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                      </svg>
                                      {entry.room}
                                    </p>
                                  )}
                                  <p className="text-xs text-white/70 mt-1">
                                    {formatTimeLabel(entry.startTime)} - {formatTimeLabel(entry.endTime)}
                                  </p>
                                </button>
                              </div>
                            );
                          }

                          // Empty slot - Tap to add class
                          return (
                            <div
                              key={time}
                              className="flex gap-2"
                            >
                              <div className="w-14 text-[10px] text-white/60 text-right pt-2 flex-shrink-0">
                                {time.endsWith(':00') ? formatTimeLabel(time) : ''}
                              </div>
                              <button
                                onClick={() => {
                                  // Pre-fill with 1-hour duration
                                  const startHour = parseInt(time.split(':')[0]);
                                  const startMin = time.split(':')[1];
                                  const endHour = Math.min(startHour + 1, 19);
                                  const endTime = `${endHour.toString().padStart(2, '0')}:${startMin}`;
                                  setScheduleForm({
                                    subject: '',
                                    room: '',
                                    day: selectedMobileDay,
                                    startTime: time,
                                    endTime: endTime,
                                    color: '#3b82f6'
                                  });
                                  setEditingScheduleEntry(null);
                                  setShowScheduleModal(true);
                                }}
                                className={`flex-1 p-3 rounded-xl transition-all text-left ${time.endsWith(':00')
                                  ? 'bg-white/5 active:bg-white/20 active:scale-[0.98]'
                                  : 'bg-white/[0.02] active:bg-white/20 active:scale-[0.98]'
                                  }`}
                                style={{ minHeight: '36px' }}
                              >
                                {time.endsWith(':00')
                                  // <span className="text-[9px] text-white/20">+ Tap to add</span>
                                }
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Instructions - Desktop only */}
                <div className="hidden sm:flex items-center justify-center gap-4 mt-4 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    Click &amp; drag to select time range
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 4v16m8-8H4" />
                    </svg>
                    Click a cell for single slot
                  </span>
                </div>

                {/* Entry count */}
                <p className="text-center text-white/40 text-xs mt-3">
                  {scheduleEntries.length} class{scheduleEntries.length !== 1 ? 'es' : ''} scheduled
                  {isMobileView && scheduleEntries.filter(e => e.day === selectedMobileDay).length > 0 && (
                    <span> • {scheduleEntries.filter(e => e.day === selectedMobileDay).length} on {selectedMobileDay}</span>
                  )}
                </p>
              </div>
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
          <div className="relative w-full max-w-lg  backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl animate-slide-up">
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

      {/* Schedule Entry Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeScheduleModal}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md  backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">
                {editingScheduleEntry ? 'Edit Class' : 'Add New Class'}
              </h2>
              <button
                onClick={closeScheduleModal}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              {/* Subject Name */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Subject / Course Name</label>
                <input
                  type="text"
                  value={scheduleForm.subject}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, subject: e.target.value })}
                  className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all"
                  placeholder="e.g., CMSC 128 - Software Engineering"
                />
              </div>

              {/* Room */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Room / Classroom</label>
                <input
                  type="text"
                  value={scheduleForm.room}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })}
                  className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm placeholder-white/50 focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all"
                  placeholder="e.g., Room 301, ICS Bldg"
                />
              </div>

              {/* Day Selection */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Day</label>
                <select
                  value={scheduleForm.day}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, day: e.target.value })}
                  className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all [color-scheme:dark]"
                >
                  {DAYS.map(day => (
                    <option key={day} value={day} className="bg-red-800 text-white">{day}</option>
                  ))}
                </select>
              </div>

              {/* Time Selection - Native time inputs for flexibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    min="07:00"
                    max="19:00"
                    className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all [color-scheme:dark] appearance-none"
                    style={{ minHeight: '48px' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-2">End Time</label>
                  <input
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    min={scheduleForm.startTime}
                    max="20:00"
                    className="w-full px-4 py-3 bg-white/15 border border-white/25 rounded-xl text-white text-sm focus:outline-none focus:border-white/50 focus:bg-white/20 transition-all [color-scheme:dark] appearance-none"
                    style={{ minHeight: '48px' }}
                  />
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULE_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, color })}
                      className={`w-8 h-8 rounded-lg transition-all ${scheduleForm.color === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-red-800'
                        : 'hover:scale-110'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-5 border-t border-white/10">
              <div>
                {editingScheduleEntry && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${editingScheduleEntry.subject}"?`)) {
                        handleDeleteScheduleEntry(editingScheduleEntry.id);
                        closeScheduleModal();
                      }
                    }}
                    className="px-4 py-2 text-red-300 hover:text-red-200 hover:bg-red-500/20 text-sm font-medium rounded-lg transition-all"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeScheduleModal}
                  className="px-5 py-2.5 text-white/80 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveScheduleEntry}
                  disabled={!scheduleForm.subject.trim()}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 bg-red-500/50 hover:bg-red-500/60 text-white text-[10px] sm:text-xs font-semibold rounded-full transition-all border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingScheduleEntry ? 'Save Changes' : 'Add Class'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Schedule Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isExporting && setShowExportModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl animate-slide-up bg-black/40 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Save as PNG
              </h2>
              <button
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 overflow-y-auto">
              {/* Orientation Selector */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  onClick={() => setExportOrientation('landscape')}
                  disabled={isExporting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${exportOrientation === 'landscape'
                    ? 'bg-white text-red-700'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                >
                  <svg className="w-4 h-3" viewBox="0 0 16 12">
                    <rect x="0.5" y="0.5" width="15" height="11" rx="1" stroke="currentColor" fill="none" strokeWidth="1" />
                  </svg>
                  Landscape
                </button>
                <button
                  onClick={() => setExportOrientation('portrait')}
                  disabled={isExporting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${exportOrientation === 'portrait'
                    ? 'bg-white text-red-700'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                >
                  <svg className="w-3 h-4" viewBox="0 0 12 16">
                    <rect x="0.5" y="0.5" width="11" height="15" rx="1" stroke="currentColor" fill="none" strokeWidth="1" />
                  </svg>
                  Portrait
                </button>
              </div>

              {/* Customization Options */}
              <div className="bg-white/5 rounded-xl p-4 mb-4 space-y-4">
                {/* Title Input */}
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-2">Title</label>
                  <input
                    type="text"
                    value={exportTitle}
                    onChange={(e) => setExportTitle(e.target.value)}
                    placeholder="My Class Schedule"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-white/40 transition-all"
                  />
                </div>

                {/* Theme Selector */}
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-2">Theme</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'red', color: '#991b1b', label: 'Red' },
                      { id: 'blue', color: '#1e40af', label: 'Blue' },
                      { id: 'green', color: '#166534', label: 'Green' },
                      { id: 'purple', color: '#6b21a8', label: 'Purple' },
                      { id: 'dark', color: '#1f2937', label: 'Dark' },
                    ].map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => setExportTheme(theme.id as 'red' | 'blue' | 'green' | 'purple' | 'dark')}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${exportTheme === theme.id ? 'border-white scale-110' : 'border-transparent hover:border-white/50'
                          }`}
                        style={{ background: theme.color }}
                        title={theme.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Toggle Options */}
                <div className="grid grid-cols-5 gap-2">
                  <button
                    onClick={() => setShowTimeLabels(!showTimeLabels)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${showTimeLabels ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'
                      }`}
                  >
                    Time
                  </button>
                  <button
                    onClick={() => setShowRoomInfo(!showRoomInfo)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${showRoomInfo ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'
                      }`}
                  >
                    Room
                  </button>
                  <button
                    onClick={() => setShowFooter(!showFooter)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${showFooter ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'
                      }`}
                  >
                    Footer
                  </button>
                  <button
                    onClick={() => setHideEmptyCells(!hideEmptyCells)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${hideEmptyCells ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'
                      }`}
                  >
                    No Empty
                  </button>
                  <button
                    onClick={() => setAutoFitTime(!autoFitTime)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${autoFitTime ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50'
                      }`}
                    title="Hide time rows outside your schedule range"
                  >
                    Fit Time
                  </button>
                </div>

                {/* Day Selection */}
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-2">Visible Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => {
                      const code = day === 'Thursday' ? 'Th' : day === 'Sunday' ? 'Su' : day.charAt(0);
                      const isVisible = visibleDays.includes(day);
                      return (
                        <button
                          key={day}
                          onClick={() => toggleVisibleDay(day)}
                          className={`h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-all border ${isVisible
                            ? 'bg-white text-red-900 border-white'
                            : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
                            }`}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Watermark Input */}
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-2">Watermark Text (Bottom)</label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="BSCS CALENDAR"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-white/40 transition-all"
                  />
                  <p className="text-[10px] text-white/40 mt-1">Leave empty to hide watermark</p>
                </div>
              </div>

              {/* Preview Container */}
              <div className="flex justify-center">
                <div
                  className="rounded-lg shadow-lg overflow-hidden transition-all duration-300"
                  style={{
                    width: exportOrientation === 'landscape' ? '100%' : '60%',
                    maxWidth: exportOrientation === 'landscape' ? '560px' : '280px',
                    aspectRatio: exportOrientation === 'landscape' ? '3/2' : '2/3',
                    background: exportTheme === 'red' ? 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #7f1d1d 100%)'
                      : exportTheme === 'blue' ? 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1e3a5f 100%)'
                        : exportTheme === 'green' ? 'linear-gradient(135deg, #14532d 0%, #166534 50%, #14532d 100%)'
                          : exportTheme === 'purple' ? 'linear-gradient(135deg, #4c1d95 0%, #6b21a8 50%, #4c1d95 100%)'
                            : 'linear-gradient(135deg, #1f2937 0%, #111827 50%, #1f2937 100%)',
                  }}
                >
                  <div className="w-full h-full p-3 flex flex-col relative">
                    {/* Watermark */}
                    {watermarkText && (
                      <div
                        className="absolute left-0 right-0 w-full text-left font-black text-white/[0.05] uppercase pointer-events-none select-none"
                        style={{
                          bottom: '6px',
                          fontSize: exportOrientation === 'landscape' ? '32px' : '32px',
                          letterSpacing: '0.1em',
                          lineHeight: 1,
                        }}
                      >
                        {watermarkText}
                      </div>
                    )}

                    {/* Preview Title */}
                    <h3 className="text-[10px] font-bold text-white text-center mb-2 truncate px-2 relative z-10">{exportTitle || 'My Class Schedule'}</h3>

                    {/* Preview Grid */}
                    {(() => {
                      // Use filtered time slots for preview when autoFitTime is enabled
                      const previewTimeSlots = autoFitTime ? getFilteredTimeSlots(scheduleEntries, TIME_SLOTS) : TIME_SLOTS;
                      return (
                        <div
                          className="flex-1 overflow-hidden"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: showTimeLabels ? `28px repeat(${visibleDays.length}, 1fr)` : `repeat(${visibleDays.length}, 1fr)`,
                            gridTemplateRows: `auto repeat(${previewTimeSlots.length}, 1fr)`,
                            gap: '1px',
                          }}
                        >
                          {/* Header */}
                          {showTimeLabels && <div></div>}
                          {visibleDays.map(day => (
                            <div
                              key={day}
                              className="text-[5px] text-white/80 text-center bg-white/10 rounded-sm py-0.5 font-medium"
                            >
                              {day.slice(0, 3)}
                            </div>
                          ))}

                          {/* Time slots preview - 30 min resolution */}
                          {previewTimeSlots.map((time, rowIndex) => (
                            <Fragment key={time}>
                              {/* Time label - only show for full hours */}
                              {showTimeLabels && (
                                <div
                                  key={`time-${time}`}
                                  className="text-[4px] text-white/40 text-right pr-1 flex items-center justify-end"
                                  style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
                                >
                                  {time.endsWith(':00') ? formatTimeLabel(time).replace(' ', '') : ''}
                                </div>
                              )}

                              {/* Day cells */}
                              {visibleDays.map((day, dayIndex) => {
                                const entry = scheduleEntries.find(e => {
                                  if (e.day !== day) return false;
                                  const entryStart = parseInt(e.startTime.replace(':', ''));
                                  const entryEnd = parseInt(e.endTime.replace(':', ''));
                                  const slotTime = parseInt(time.replace(':', ''));

                                  // Check if slot is within entry duration
                                  // For 30-min slots: current slot starts at time, ends at time+30
                                  // So we check if time >= entryStart and time < entryEnd
                                  return slotTime >= entryStart && slotTime < entryEnd;
                                });

                                // Exact start match check
                                const isStart = scheduleEntries.some(e => e.day === day && e.startTime === time);

                                if (entry && !isStart) return null;

                                if (entry && isStart) {
                                  const startMinutes = parseInt(entry.startTime.split(':')[0]) * 60 + parseInt(entry.startTime.split(':')[1]);
                                  const endMinutes = parseInt(entry.endTime.split(':')[0]) * 60 + parseInt(entry.endTime.split(':')[1]);
                                  // Span is in 30-minute units
                                  const spanSlots = Math.ceil((endMinutes - startMinutes) / 30);

                                  return (
                                    <div
                                      key={`${day}-${time}`}
                                      className="rounded-sm overflow-hidden p-0.5"
                                      style={{
                                        gridColumn: showTimeLabels ? dayIndex + 2 : dayIndex + 1,
                                        gridRow: `${rowIndex + 2} / span ${spanSlots}`,
                                        backgroundColor: `${entry.color}50`,
                                        borderLeft: `2px solid ${entry.color}`,
                                        zIndex: 10
                                      }}
                                    >
                                      <p className="text-[4px] font-bold text-white leading-tight" style={{ wordWrap: 'break-word' }}>
                                        {entry.subject}
                                      </p>
                                      {entry.room && (
                                        <p className="text-[3px] text-white/70 leading-tight truncate">
                                          {entry.room.replace('SECTION & ROOM #', '').trim()}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }

                                // Empty cell (optional background) - hide if setting enabled
                                if (hideEmptyCells) return null;

                                return (
                                  <div
                                    key={`${day}-${time}`}
                                    style={{
                                      gridColumn: showTimeLabels ? dayIndex + 2 : dayIndex + 1,
                                      gridRow: rowIndex + 2,
                                      // Only show lines for hours
                                      borderTop: time.endsWith(':00') ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                    }}
                                  />
                                );
                              })
                              }
                            </Fragment>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Preview Footer */}
                    {showFooter && (
                      <p className="text-[5px] text-white/40 text-center mt-2 relative z-10">
                        {scheduleEntries.length} class{scheduleEntries.length !== 1 ? 'es' : ''} scheduled
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Resolution info */}
              <p className="text-xs text-white/50 text-center mt-3">
                {exportOrientation === 'landscape' ? '1200 × 800' : '800 × 1200'} pixels • High Quality (2x)
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 flex-shrink-0">
              <button
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
                className="px-5 py-2.5 text-white/80 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExportSchedule}
                disabled={isExporting}
                className="px-6 py-2.5 bg-white text-red-700 font-bold text-sm rounded-full hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PNG
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )
      }

      {/* OCR Import Modal */}
      {
        showOCRModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-red-900/95 to-red-950/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg border border-white/10 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-sm">Import Schedule from Image</h3>
                    <p className="text-white/50 text-xs">Upload your class schedule image for OCR</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowOCRModal(false);
                    setOcrPreviewImage(null);
                    setOcrProgress(0);
                    setOcrStatus('');
                  }}
                  disabled={isProcessingOCR}
                  className="text-white/50 hover:text-white transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 overflow-y-auto">
                {/* Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${isProcessingOCR
                    ? 'border-white/20 bg-white/5'
                    : 'border-white/30 hover:border-white/50 hover:bg-white/5 cursor-pointer'
                    }`}
                  onClick={() => !isProcessingOCR && ocrFileInputRef.current?.click()}
                >
                  <input
                    ref={ocrFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleOCRUpload}
                    className="hidden"
                    disabled={isProcessingOCR}
                  />

                  {ocrPreviewImage ? (
                    <div className="space-y-4">
                      <img
                        src={ocrPreviewImage}
                        alt="Schedule preview"
                        className="max-h-48 mx-auto rounded-lg object-contain"
                      />
                      {isProcessingOCR && (
                        <div className="space-y-2">
                          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-white h-full rounded-full transition-all duration-300"
                              style={{ width: `${ocrProgress}%` }}
                            />
                          </div>
                          <p className="text-white/70 text-sm">{ocrStatus}</p>
                        </div>
                      )}
                      {!isProcessingOCR && ocrStatus && (
                        <p className={`text-sm ${ocrStatus.includes('Successfully') ? 'text-green-400' : 'text-amber-400'}`}>
                          {ocrStatus}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <svg className="w-12 h-12 mx-auto text-white/40 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-white font-medium mb-2">Click to upload schedule image</p>
                      <p className="text-white/50 text-sm">or drag and drop</p>
                      <p className="text-white/40 text-xs mt-4">Supports JPG, PNG, WEBP</p>
                    </>
                  )}
                </div>

                {/* Instructions */}
                <div className="mt-4 p-4 bg-white/5 rounded-xl">
                  <h4 className="text-white/80 font-semibold text-xs mb-2">Supported Format</h4>
                  <p className="text-white/50 text-xs">
                    Upload an image of your schedule table with columns like:
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {['SUBJECT CODE', 'SUBJECT NAME', 'SCHEDULE'].map(col => (
                      <span key={col} className="px-2 py-1 bg-white/10 rounded text-[10px] text-white/70">
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-white/40 text-[10px] mt-3">
                    Schedule format: "M 7:00-10:00 AM", "TTh 1:00-2:30 PM", etc.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowOCRModal(false);
                    setOcrPreviewImage(null);
                    setOcrProgress(0);
                    setOcrStatus('');
                  }}
                  disabled={isProcessingOCR}
                  className="px-5 py-2.5 text-white/80 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {ocrStatus.includes('Successfully') ? 'Done' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Footer with Privacy & Terms Links */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 px-6 py-3 bg-linear-to-t from-red-900/80 to-transparent pointer-events-none">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 pointer-events-auto">
          <Link
            href="/privacy"
            className="text-white/50 hover:text-white/80 text-xs font-medium transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="text-white/30">•</span>
          <Link
            href="/terms"
            className="text-white/50 hover:text-white/80 text-xs font-medium transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </footer>

      <Analytics />
    </div >


  );
}
