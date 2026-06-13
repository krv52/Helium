import { formatTimestamp } from '../utils/formatters.js';

function HistoryPanel({ items, onSelect }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="history-panel" aria-label="Recent history">
      <div className="history-header">
        <span>Recent</span>
        <strong>{items.length}</strong>
      </div>

      <div className="history-list">
        {items.map((item) => (
          <button
            key={`${item.url}-${item.timestamp}`}
            className="history-item"
            type="button"
            onClick={() => onSelect(item.url)}
          >
            <span>{item.title || item.url}</span>
            <time dateTime={item.timestamp}>{formatTimestamp(item.timestamp)}</time>
          </button>
        ))}
      </div>
    </section>
  );
}

export default HistoryPanel;
