import { HistoryRecord } from '../types';

function getStorageKey(userEmail?: string): string {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  return cleanEmail ? `neuroagent_history_${cleanEmail}` : 'neuroagent_history_guest';
}

export async function fetchHistory(userEmail?: string): Promise<HistoryRecord[]> {
  // Clear any obsolete unpartitioned dummy storage
  try {
    localStorage.removeItem('neuroagent_upload_history');
  } catch (e) {}

  const storageKey = getStorageKey(userEmail);

  try {
    const url = userEmail ? `/api/history?email=${encodeURIComponent(userEmail)}` : '/api/history';
    const res = await fetch(url, {
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.history)) {
        // Persist to user-scoped cache
        saveLocalHistory(data.history, userEmail);
        return data.history;
      }
    }
  } catch (err) {
    console.warn('Backend /api/history fetch error, reading user cache:', err);
  }

  // Return user-scoped cached history (empty array if new user)
  return getLocalHistory(userEmail);
}

export function getLocalHistory(userEmail?: string): HistoryRecord[] {
  try {
    const storageKey = getStorageKey(userEmail);
    const data = localStorage.getItem(storageKey);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to parse history from localStorage', e);
  }
  return [];
}

export function saveLocalHistory(records: HistoryRecord[], userEmail?: string): void {
  try {
    const storageKey = getStorageKey(userEmail);
    localStorage.setItem(storageKey, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save history to localStorage', e);
  }
}

export async function addHistoryRecord(record: HistoryRecord, userEmail?: string): Promise<void> {
  const current = getLocalHistory(userEmail);
  const updated = [record, ...current.filter(r => r.id !== record.id && r.filename !== record.filename)];
  saveLocalHistory(updated, userEmail);

  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...record, userEmail }),
    });
  } catch (err) {
    // Non-fatal, local storage has it
  }
}

export async function deleteHistoryRecord(id: string, userEmail?: string): Promise<void> {
  const current = getLocalHistory(userEmail);
  const updated = current.filter(r => r.id !== id);
  saveLocalHistory(updated, userEmail);

  try {
    await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch (err) {
    // Non-fatal
  }
}
