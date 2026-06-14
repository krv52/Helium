function InfoModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">About Helium</p>
            <h2 id="info-modal-title">Media downloads powered by yt-dlp</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close info">
            x
          </button>
        </div>

        <div className="modal-grid">
          <article>
            <h3>FAQ</h3>
            <p>Paste a supported URL, analyze it, choose a mode and download format.</p>
          </article>
          <article>
            <h3>Future updates</h3>
            <p>Local files, ffprobe metadata, FFmpeg conversion and batch tools are planned.</p>
          </article>
          <article>
            <h3>Supported websites</h3>
            <p>Helium follows yt-dlp support, including YouTube, SoundCloud and many others.</p>
          </article>
          <article>
            <h3>Links</h3>
            <p>
              <a href="https://github.com/krv52/Helium" target="_blank" rel="noreferrer">GitHub</a>
{/*              <span> / </span>
              <a href="https://github.com/sponsors" target="_blank" rel="noreferrer">Donate</a> */}
            </p>
          </article>
          <article>
            <h3>Version</h3>
            <p>Helium UI prototype 0.1.0</p>
          </article>
          <article>
            <h3>Changelog</h3>
            <p>Reserved for release notes and upgrade history.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

export default InfoModal;
