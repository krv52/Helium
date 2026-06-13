import { useEffect, useMemo, useState } from 'react';

const formatOptions = {
  video: ['mp4', 'webm'],
  audio: ['mp3', 'm4a'],
  thumbnail: ['jpg', 'webp', 'original'],
};

const qualityOptions = [
  { value: 'best', label: 'Best available' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' },
  { value: 'worst', label: 'Lowest size' },
];
const modeLabels = {
  video: 'Video',
  audio: 'Audio',
  thumbnail: 'Thumbnail',
};

const presets = [
  { label: 'Best Video', mode: 'video', format: 'mp4', quality: 'best' },
  { label: 'MP3', mode: 'audio', format: 'mp3', quality: 'best' },
  { label: 'Thumbnail', mode: 'thumbnail', format: 'jpg', quality: 'best' },
  { label: 'Mobile', mode: 'video', format: 'mp4', quality: '720' },
  { label: 'Small Size', mode: 'video', format: 'mp4', quality: 'worst' },
];

function filenameFromDisposition(disposition) {
  const fallback = 'helium-download';

  if (!disposition) {
    return fallback;
  }

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallback;
}

function DownloadPanel({
  sourceUrl,
  apiBaseUrl = '',
  availableModes = ['video'],
  onDownloaded,
}) {
  const initialMode = availableModes[0] || 'audio';
  const [mode, setMode] = useState(initialMode);
  const [format, setFormat] = useState(formatOptions[initialMode]?.[0] || '');
  const [quality, setQuality] = useState('best');
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const normalizedModes = useMemo(
    () => availableModes.filter((item) => formatOptions[item]),
    [availableModes],
  );
  const availableFormats = formatOptions[mode] || [];
  const showQuality = mode === 'video';
  const availablePresets = presets.filter((preset) =>
    normalizedModes.includes(preset.mode),
  );

  useEffect(() => {
    if (!normalizedModes.includes(mode)) {
      setMode(normalizedModes[0] || 'audio');
    }
  }, [mode, normalizedModes]);

  useEffect(() => {
    const nextFormats = formatOptions[mode] || [];

    if (!nextFormats.includes(format)) {
      setFormat(nextFormats[0] || '');
    }
  }, [mode]);

  const downloadUrl = useMemo(() => {
    const params = new URLSearchParams({
      url: sourceUrl,
      mode,
      format,
    });

    if (showQuality) {
      params.set('quality', quality);
    }

    return `${apiBaseUrl}/download?${params.toString()}`;
  }, [apiBaseUrl, format, mode, quality, showQuality, sourceUrl]);

  const handleDownload = async () => {
    setError('');
    setIsDownloading(true);

    try {
      const response = await fetch(downloadUrl);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Download failed.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filenameFromDisposition(
        response.headers.get('content-disposition'),
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      onDownloaded?.();
    } catch (downloadError) {
      setError(downloadError.message || 'Download failed.');
    } finally {
      setIsDownloading(false);
    }
  };

  const applyPreset = (preset) => {
    setMode(preset.mode);
    setFormat(preset.format);
    setQuality(preset.quality);
    setError('');
  };

  return (
    <section className="app-card download-panel" aria-label="Download options">
      <div className="section-heading">
        <p className="eyebrow">Download Options</p>
        <h2>Choose output settings</h2>
      </div>

      <div className="preset-grid" aria-label="Quick action presets">
        {availablePresets.map((preset) => (
          <button
            key={preset.label}
            className="preset-button"
            type="button"
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="control-grid">
        <label className="field-group">
          <span>Output type</span>
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            {normalizedModes.map((option) => (
              <option key={option} value={option}>
                {modeLabels[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Container</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            {availableFormats.map((option) => (
              <option key={option} value={option}>
                {option.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        {showQuality && (
          <label className="field-group">
            <span>Quality</span>
            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value)}
            >
              {qualityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="download-action">
        <div>
          <p className="action-title">Ready to download</p>
          <p className="action-copy">
            Your download will start with the selected format and quality.
          </p>
        </div>

        <button
          className="download-button"
          type="button"
          onClick={handleDownload}
          disabled={isDownloading || !format}
        >
          {isDownloading ? 'Downloading...' : 'Download'}
        </button>
      </div>

      {error && <p className="message error download-error">{error}</p>}
    </section>
  );
}

export default DownloadPanel;
