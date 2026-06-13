export function hasValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds,
    ).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return null;
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 || value >= 1000 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatBitrate(kbps) {
  if (!Number.isFinite(kbps)) {
    return null;
  }

  return `${Math.round(kbps)} kbps`;
}

export function formatUploadDate(value) {
  if (!/^\d{8}$/.test(String(value))) {
    return null;
  }

  const source = String(value);
  const date = new Date(
    Number(source.slice(0, 4)),
    Number(source.slice(4, 6)) - 1,
    Number(source.slice(6, 8)),
  );

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function compactUrl(value) {
  if (!hasValue(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, '')}${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

export function formatTimestamp(value) {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
