/**
 * Global Date & Time Formatter Utility for Aquzio ERP.
 * Converts UTC timestamps to the company's configured timezone and formats them accordingly.
 */

// Helper to get preferences with fallbacks
export const getCompanyPrefs = () => {
  const timeZone = localStorage.getItem('company_timezone') || 'Asia/Kolkata';
  const dateFormat = localStorage.getItem('company_date_format') || 'dd MMM yyyy';
  const timeFormat = localStorage.getItem('company_time_format') || '12h';
  return { timeZone, dateFormat, timeFormat };
};

// Update preferences in local cache
export const setCompanyPrefs = (prefs: { timeZone?: string; dateFormat?: string; timeFormat?: string }) => {
  if (prefs.timeZone) localStorage.setItem('company_timezone', prefs.timeZone);
  if (prefs.dateFormat) localStorage.setItem('company_date_format', prefs.dateFormat);
  if (prefs.timeFormat) localStorage.setItem('company_time_format', prefs.timeFormat);
};

/**
 * Parses a UTC string or Date object and converts it to the target company timezone.
 */
export const toCompanyDate = (utcDate: Date | string | null | undefined): Date | null => {
  if (!utcDate) return null;
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  if (isNaN(d.getTime())) return null;

  const { timeZone } = getCompanyPrefs();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    });
    const parts = formatter.formatToParts(d);
    
    // Extract parts to construct the local date correctly
    let year = d.getUTCFullYear();
    let month = d.getUTCMonth();
    let day = d.getUTCDate();
    let hour = d.getUTCHours();
    let minute = d.getUTCMinutes();
    let second = d.getUTCSeconds();

    parts.forEach(p => {
      const val = parseInt(p.value, 10);
      if (p.type === 'year') year = val;
      else if (p.type === 'month') month = val - 1; // Month is 0-indexed in JS Date constructor
      else if (p.type === 'day') day = val;
      else if (p.type === 'hour') {
        hour = val;
      }
      else if (p.type === 'minute') minute = val;
      else if (p.type === 'second') second = val;
    });

    // Handle PM adjustment if the hour part was formatted as 12-hour AM/PM
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value;
    if (dayPeriod === 'PM' && hour < 12) hour += 12;
    if (dayPeriod === 'AM' && hour === 12) hour = 0;

    return new Date(year, month, day, hour, minute, second);
  } catch (err) {
    console.error('Timezone conversion error:', err);
    return d; // Fallback to UTC date if timezone is invalid
  }
};

/**
 * Formats a UTC date to the company's date format (e.g. "04 Aug 2026").
 */
export const formatDate = (utcDate: Date | string | null | undefined): string => {
  if (!utcDate) return '—';
  const localDate = toCompanyDate(utcDate);
  if (!localDate) return '—';

  const { dateFormat } = getCompanyPrefs();
  const day = String(localDate.getDate()).padStart(2, '0');
  const year = localDate.getFullYear();
  
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesLong = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const monthShort = monthNamesShort[localDate.getMonth()];
  const monthLong = monthNamesLong[localDate.getMonth()];
  const monthNum = String(localDate.getMonth() + 1).padStart(2, '0');

  // Simple token replacement
  let format = dateFormat
    .replace('dd', day)
    .replace('d', String(localDate.getDate()))
    .replace('yyyy', String(year))
    .replace('yy', String(year).substring(2))
    .replace('MMMM', monthLong)
    .replace('MMM', monthShort)
    .replace('MM', monthNum)
    .replace('M', String(localDate.getMonth() + 1))
    // Also support uppercase equivalents for safety
    .replace('DD', day)
    .replace('D', String(localDate.getDate()))
    .replace('YYYY', String(year))
    .replace('YY', String(year).substring(2));

  return format;
};

/**
 * Formats a UTC date to the company's time format (e.g. "02:16 PM" or "14:16").
 */
export const formatTime = (utcDate: Date | string | null | undefined): string => {
  if (!utcDate) return '—';
  const localDate = toCompanyDate(utcDate);
  if (!localDate) return '—';

  const { timeFormat } = getCompanyPrefs();
  const hours = localDate.getHours();
  const minutes = String(localDate.getMinutes()).padStart(2, '0');

  if (timeFormat === '24h') {
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  } else {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${String(displayHours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
};

/**
 * Formats a UTC date to both date and time (e.g. "04 Aug 2026 02:16 PM").
 */
export const formatDateTime = (utcDate: Date | string | null | undefined): string => {
  if (!utcDate) return '—';
  return `${formatDate(utcDate)} ${formatTime(utcDate)}`;
};

/**
 * Formats a ledger transaction entry date and time consistently in the company's configured timezone.
 *
 * Rules:
 * - Uses the company's configured timezone ('company_timezone' or 'Asia/Kolkata').
 * - Preserves the business date from transactionDate.
 * - Extracts the true occurrence time:
 *   - If transactionDate has a non-midnight time, formats that time.
 *   - If transactionDate was midnight UTC (date-only) but was recorded on the same day as createdAt,
 *     extracts the time from createdAt (the actual saved system occurrence time).
 *   - If it is a historical/backdated transaction without any time recorded, returns '—' instead of false '05:30 AM'.
 */
export const formatLedgerDateTime = (
  transactionDateStr: string | null | undefined,
  createdAtStr?: string | null | undefined
): { dayStr: string; timeStr: string } => {
  if (!transactionDateStr && !createdAtStr) {
    return { dayStr: '—', timeStr: '' };
  }

  const primaryDateStr = transactionDateStr || createdAtStr!;
  const dayStr = formatDate(primaryDateStr);

  const parseUtc = (s: string) => {
    const normalized = s.endsWith('Z') || s.includes('+') ? s : `${s}Z`;
    return new Date(normalized);
  };

  const rawTxDate = transactionDateStr ? parseUtc(transactionDateStr) : null;
  const hasTxTime =
    rawTxDate &&
    !isNaN(rawTxDate.getTime()) &&
    (rawTxDate.getUTCHours() !== 0 || rawTxDate.getUTCMinutes() !== 0 || rawTxDate.getUTCSeconds() !== 0);

  if (hasTxTime) {
    return { dayStr, timeStr: formatTime(transactionDateStr) };
  }

  if (createdAtStr) {
    const rawCreatedDate = parseUtc(createdAtStr);
    if (!isNaN(rawCreatedDate.getTime())) {
      const sameDay =
        !rawTxDate ||
        (rawTxDate.getUTCFullYear() === rawCreatedDate.getUTCFullYear() &&
          rawTxDate.getUTCMonth() === rawCreatedDate.getUTCMonth() &&
          rawTxDate.getUTCDate() === rawCreatedDate.getUTCDate());

      if (sameDay) {
        return { dayStr, timeStr: formatTime(createdAtStr) };
      }
    }
  }

  return { dayStr, timeStr: '—' };
};

