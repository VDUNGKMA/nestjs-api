// src/utils/date-utils.ts
import { addHours } from 'date-fns';

export function formatVietnamTime(utcDate: Date): string {
  return addHours(utcDate, 7).toISOString().replace('Z', '+07:00');
}
