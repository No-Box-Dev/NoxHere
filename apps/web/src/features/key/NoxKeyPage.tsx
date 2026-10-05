export default function NoxKeyPage() {
  return <section className="key-placeholder" role="status">
    <div className="key-placeholder-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="12" r="3" /><path d="M11 12h9M17 12v3M20 12v2" /></svg>
    </div>
    <h2>Organization secrets are coming soon</h2>
    <p>For now, use the NoxKey macOS app to manage your secrets securely.</p>
    <a className="button primary-button" href="https://apps.apple.com/app/noxkey/id6760210699" target="_blank" rel="noreferrer">Download NoxKey</a>
  </section>;
}
