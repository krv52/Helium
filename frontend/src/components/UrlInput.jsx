import { useState } from 'react';

function UrlInput({ onAnalyze, isLoading }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onAnalyze(url);
  };

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <input
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Paste a URL"
        aria-label="Media URL"
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Analyzing...' : 'Analyze'}
      </button>
    </form>
  );
}

export default UrlInput;
