import { useEffect, useRef, useState } from 'react';
import { formatFileSize } from '../utils/formatters.js';

const supportedExtensions = [
  'mp4',
  'mkv',
  'webm',
  'mov',
  'avi',
  'mp3',
  'wav',
  'flac',
  'm4a',
  'jpg',
  'png',
  'webp',
];

function LocalFilePanel({ apiBaseUrl = '', onAnalyzed, onError }) {
  const inputRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    setIsAnalyzing(true);
    onError('');

    try {
      const response = await fetch(`${apiBaseUrl}/file/info`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Could not inspect this file.');
      }

      const data = await response.json();
      onAnalyzed(data);
    } catch (error) {
      onError(error.message || 'Could not inspect this file.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);

    if (!files.length) {
      return;
    }

    setQueue(files);
    analyzeFile(files[0]);
  };

  useEffect(() => {
    const handlePaste = (event) => {
      const files = Array.from(event.clipboardData?.files || []);

      if (files.length) {
        addFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  return (
    <div
      className={isDragging ? 'file-dropzone active' : 'file-dropzone'}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".mp4,.mkv,.webm,.mov,.avi,.mp3,.wav,.flac,.m4a,.jpg,.png,.webp"
        onChange={(event) => addFiles(event.target.files)}
      />

      <div className="dropzone-copy">
        <strong>{isAnalyzing ? 'Inspecting file...' : 'Drop media file here'}</strong>
        <p>Choose file, drag and drop, or paste from your clipboard.</p>
        <button
          className="tiny-button"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isAnalyzing}
        >
          Choose file
        </button>
      </div>

      <div className="supported-formats">
        <span>Supported formats</span>
        <div className="metadata-badges">
          {supportedExtensions.map((extension) => (
            <span key={extension}>{extension.toUpperCase()}</span>
          ))}
        </div>
      </div>

      {queue.length > 0 && (
        <div className="file-queue">
          <span>Queue</span>
          {queue.map((file) => (
            <div key={`${file.name}-${file.size}`} className="file-queue-item">
              <strong>{file.name}</strong>
              <small>{formatFileSize(file.size)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LocalFilePanel;
