import { useEffect, useState } from 'react';
import DownloadPanel from './components/DownloadPanel.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import InfoModal from './components/InfoModal.jsx';
import LocalFilePanel from './components/LocalFilePanel.jsx';
import MediaCard from './components/MediaCard.jsx';
import UrlInput from './components/UrlInput.jsx';
import { sanitizeMediaUrl } from './utils/urlSanitizer.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const HISTORY_KEY = 'helium-history';

function App() {
  const [media, setMedia] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceMode, setSourceMode] = useState('url');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  useEffect(() => {
    const storedHistory = window.localStorage.getItem(HISTORY_KEY);

    if (storedHistory) {
      setHistory(JSON.parse(storedHistory));
    }
  }, []);

  const saveHistoryItem = (item) => {
    setHistory((currentHistory) => {
      const nextHistory = [
        {
          url: item.url,
          title: item.title,
          timestamp: new Date().toISOString(),
        },
        ...currentHistory.filter((entry) => entry.url !== item.url),
      ].slice(0, 10);

      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
      return nextHistory;
    });
  };

  const handleAnalyze = async (url) => {
    const trimmedUrl = sanitizeMediaUrl(url);

    setError('');
    setMedia(null);

    if (!trimmedUrl) {
      setError('Paste a URL first.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/info?url=${encodeURIComponent(trimmedUrl)}`,
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Server returned an error.');
      }

      const data = await response.json();
      setMedia(data);
      setSourceUrl(trimmedUrl);
      saveHistoryItem({ url: trimmedUrl, title: data.title });
    } catch (requestError) {
      setError(
        requestError.message ||
          'Could not analyze this link. Check the backend and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">He</span>
          <div>
            <span className="brand-name">Helium</span>
            <p className="brand-subtitle">yt-dlp powered media downloader</p>
          </div>
        </div>

        <button
          className="info-button"
          type="button"
          aria-label="Open Helium information"
          onClick={() => setIsInfoOpen(true)}
        >
          i
        </button>
      </header>

      <section className="tool-layout">
        <section className="source-card" aria-label="Source input">
          <div className="source-tabs" role="tablist" aria-label="Source type">
            <button
              className={sourceMode === 'url' ? 'source-tab active' : 'source-tab'}
              type="button"
              role="tab"
              onClick={() => setSourceMode('url')}
            >
              URL
            </button>
            <button
              className={sourceMode === 'file' ? 'source-tab active' : 'source-tab'}
              type="button"
              role="tab"
              onClick={() => setSourceMode('file')}
            >
              Local file
            </button>
          </div>

          {sourceMode === 'url' ? (
            <UrlInput onAnalyze={handleAnalyze} isLoading={isLoading} />
          ) : (
            <LocalFilePanel
              apiBaseUrl={API_BASE_URL}
              onError={setError}
              onAnalyzed={(data) => {
                setMedia(data);
                setSourceUrl('');
                setError('');
              }}
            />
          )}
        </section>

        {error && <p className="message error">{error}</p>}
        {isLoading && <p className="message loading">Analyzing media...</p>}
      </section>

      <HistoryPanel items={history} onSelect={handleAnalyze} />

      {media && (
        <section className="workspace-stack" aria-label="Media download workspace">
          <MediaCard media={media} />
          {media.source_kind !== 'file' && (
            <DownloadPanel
              sourceUrl={sourceUrl}
              apiBaseUrl={API_BASE_URL}
              availableModes={media.available_modes}
              onDownloaded={() => saveHistoryItem({ url: sourceUrl, title: media.title })}
            />
          )}
        </section>
      )}

      {isInfoOpen && <InfoModal onClose={() => setIsInfoOpen(false)} />}
    </main>
  );
}

export default App;
