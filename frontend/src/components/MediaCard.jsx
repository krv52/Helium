import { useMemo, useState } from 'react';
import {
  compactUrl,
  formatBitrate,
  formatDuration,
  formatFileSize,
  formatUploadDate,
  hasValue,
} from '../utils/formatters.js';

const formatLabels = {
  mp4: 'MP4',
  webm: 'WEBM',
  mkv: 'MKV',
  mov: 'MOV',
  avi: 'AVI',
  m4a: 'M4A',
  mp3: 'MP3',
  wav: 'WAV',
  flac: 'FLAC',
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WEBP',
};

function mediaTypeLabel(media) {
  if (media.preview_type === 'image') {
    return 'Image';
  }

  if (media.has_video && media.has_audio) {
    return 'Video + Audio';
  }

  if (media.has_audio && !media.has_video) {
    return 'Audio only';
  }

  if (media.has_video && !media.has_audio) {
    return 'Video only';
  }

  return 'Unknown';
}

function formatValue(value) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return value;
}

function cleanFormats(media) {
  const formats = new Set();

  (media.available_formats || []).forEach((item) => {
    const normalized = String(item).toLowerCase();

    if (formatLabels[normalized]) {
      formats.add(formatLabels[normalized]);
    }
  });

  if (media.thumbnail) {
    formats.add('Thumbnail');
  }

  return Array.from(formats);
}

function MetadataRow({ label, value, children }) {
  if (!children && !hasValue(value)) {
    return null;
  }

  return (
    <div className="metadata-row">
      <span>{label}</span>
      {children ||
        (Array.isArray(value) ? (
          <div className="metadata-badges">
            {value.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : (
          <strong>{formatValue(value)}</strong>
        ))}
    </div>
  );
}

function SourceUrlRow({ url }) {
  const [copied, setCopied] = useState(false);
  const label = compactUrl(url);

  if (!label) {
    return null;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <MetadataRow label="Source">
      <div className="url-actions">
        <strong>{label}</strong>
        <div>
          <button className="tiny-button" type="button" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy URL'}
          </button>
          <a className="tiny-button" href={url} target="_blank" rel="noreferrer">
            Open source
          </a>
        </div>
      </div>
    </MetadataRow>
  );
}

function LocalSourceRow({ path, fileType }) {
  if (!hasValue(path) && !hasValue(fileType)) {
    return null;
  }

  return (
    <>
      <MetadataRow label="Local path" value={path} />
      <MetadataRow label="File type" value={fileType} />
    </>
  );
}

function ExpandableListRow({ label, items }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!hasValue(items)) {
    return null;
  }

  return (
    <MetadataRow label={label}>
      <div className="expandable-list">
        <button
          className="tiny-button"
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {label} ({items.length})
        </button>
        {isExpanded && (
          <div className="metadata-badges">
            {items.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}
      </div>
    </MetadataRow>
  );
}

function SectionTabs({ activeSection, onChange }) {
  const sections = ['General', 'Media', 'Technical', 'Source'];

  return (
    <div className="section-tabs" role="tablist" aria-label="Advanced details sections">
      {sections.map((section) => (
        <button
          key={section}
          className={activeSection === section ? 'section-tab active' : 'section-tab'}
          type="button"
          onClick={() => onChange(section)}
        >
          {section}
        </button>
      ))}
    </div>
  );
}

function MediaCard({ media }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeSection, setActiveSection] = useState('General');

  const cleanFormatList = useMemo(() => cleanFormats(media), [media]);
  const formattedFileSize = formatFileSize(media.filesize);
  const formattedBitrate = formatBitrate(media.bitrate);
  const formattedUploadDate = formatUploadDate(media.upload_date);

  const simpleRows = [
    { label: media.source_kind === 'file' ? 'Filename' : 'Platform', value: media.source_kind === 'file' ? media.filename : media.extractor },
    { label: 'Duration', value: formatDuration(media.duration) },
    { label: 'Media type', value: mediaTypeLabel(media) },
  ];

  const sections = {
    General: [
      { label: 'Filename', value: media.filename },
      { label: 'Uploader', value: media.uploader },
      { label: 'Upload date', value: formattedUploadDate },
      { label: 'File size', value: formattedFileSize },
      { label: 'Available modes', value: media.available_modes },
    ],
    Media: [
      { label: 'Available formats', value: cleanFormatList },
      { label: 'Container', value: media.container?.toUpperCase?.() || media.container },
      { label: 'Streams', value: media.streams },
    ],
    Technical: [
      { label: 'Codecs', value: media.codecs || media.codec },
      { label: 'Bitrate', value: formattedBitrate },
      { label: 'Resolution', value: media.resolution },
      { label: 'FPS', value: media.fps },
      { label: 'Color space', value: media.color_space },
      { label: 'Audio channels', value: media.audio_channels },
      { label: 'Sample rate', value: media.sample_rate ? `${media.sample_rate} Hz` : null },
    ],
    Source: [{ label: 'Extractor', value: media.extractor }],
  };

  const activeRows = sections[activeSection].filter((row) => hasValue(row.value));
  const hasAudioStreams = hasValue(media.audio_streams);
  const hasSubtitles = hasValue(media.subtitles);
  const hasSource = hasValue(media.webpage_url) || hasValue(media.local_path);
  const hasAdvancedRows =
    activeRows.length > 0 ||
    (activeSection === 'Technical' && hasAudioStreams) ||
    (activeSection === 'Source' && (hasSource || hasSubtitles));

  return (
    <section className="app-card media-card" aria-label="Media information">
      {media.thumbnail && (
        <div className="media-preview">
          <img
            className="media-thumbnail"
            src={media.thumbnail}
            alt={media.title ? `${media.title} thumbnail` : 'Media thumbnail'}
          />
        </div>
      )}
      {!media.thumbnail && (
        <div className={`media-preview media-preview-${media.preview_type || 'unknown'}`}>
          <div className="preview-placeholder">
            <span>{media.preview_type === 'audio' ? 'Music' : 'Media'}</span>
            {media.preview_type === 'audio' && <div className="waveform-placeholder" />}
          </div>
        </div>
      )}

      <div className="media-details">
        <div className="section-heading media-heading">
          <div>
            <p className="eyebrow">Media Information</p>
            <h2>{media.title || 'Untitled media'}</h2>
          </div>

          <button
            className="mode-switch"
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            aria-pressed={showAdvanced}
          >
            Advanced details
          </button>
        </div>

        <div className="metadata-grid compact">
          {simpleRows.map((row) => (
            <MetadataRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>

        {showAdvanced && (
          <div className="advanced-panel">
            <SectionTabs activeSection={activeSection} onChange={setActiveSection} />

            {hasAdvancedRows ? (
              <div className="metadata-grid advanced-grid">
                {activeRows.map((row) => (
                  <MetadataRow key={row.label} label={row.label} value={row.value} />
                ))}
                {activeSection === 'Technical' && (
                  <ExpandableListRow label="Audio streams" items={media.audio_streams} />
                )}
                {activeSection === 'Source' && (
                  <>
                    <SourceUrlRow url={media.webpage_url} />
                    <LocalSourceRow path={media.local_path} fileType={media.file_type} />
                    <MetadataRow label="Subtitles" value={media.subtitles} />
                  </>
                )}
              </div>
            ) : (
              <p className="empty-note">No advanced metadata available yet.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default MediaCard;
