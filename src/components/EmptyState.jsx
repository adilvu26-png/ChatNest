// Shown on desktop/tablet when no chat is open (like WhatsApp Web). Hidden on phones by CSS.
export default function EmptyState() {
  return (
    <div className="empty empty-pro">
      <svg className="empty-art" viewBox="0 0 320 240" role="img" aria-label="Chat illustration">
        <ellipse cx="160" cy="214" rx="118" ry="12" fill="currentColor" opacity=".08" />
        <rect x="46" y="28" width="228" height="156" rx="14" fill="var(--panel)" stroke="var(--brand)" strokeWidth="3" />
        <rect x="46" y="28" width="228" height="22" rx="14" fill="var(--brand)" opacity=".16" />
        <circle cx="62" cy="39" r="3.5" fill="var(--brand)" /><circle cx="75" cy="39" r="3.5" fill="var(--brand)" opacity=".6" /><circle cx="88" cy="39" r="3.5" fill="var(--brand)" opacity=".3" />
        <rect x="64" y="66" width="104" height="30" rx="12" fill="var(--theirs)" stroke="var(--line)" />
        <rect x="76" y="76" width="64" height="5" rx="2.5" fill="var(--mute)" opacity=".5" /><rect x="76" y="85" width="40" height="5" rx="2.5" fill="var(--mute)" opacity=".35" />
        <rect x="152" y="106" width="104" height="30" rx="12" fill="var(--mine)" stroke="var(--line)" />
        <rect x="164" y="116" width="70" height="5" rx="2.5" fill="var(--mute)" opacity=".5" /><rect x="164" y="125" width="44" height="5" rx="2.5" fill="var(--mute)" opacity=".35" />
        <rect x="64" y="146" width="84" height="24" rx="12" fill="var(--theirs)" stroke="var(--line)" />
        <circle cx="86" cy="158" r="3" fill="var(--mute)" opacity=".6" /><circle cx="98" cy="158" r="3" fill="var(--mute)" opacity=".45" /><circle cx="110" cy="158" r="3" fill="var(--mute)" opacity=".3" />
        <rect x="132" y="184" width="56" height="9" rx="4" fill="var(--brand)" opacity=".25" />
        <rect x="108" y="193" width="104" height="8" rx="4" fill="var(--brand)" opacity=".35" />
        <g transform="translate(236 118)"><rect width="52" height="88" rx="10" fill="var(--panel)" stroke="var(--brand)" strokeWidth="3" /><rect x="18" y="6" width="16" height="4" rx="2" fill="var(--brand)" opacity=".4" />
          <rect x="8" y="22" width="30" height="14" rx="6" fill="var(--theirs)" stroke="var(--line)" /><rect x="14" y="42" width="30" height="14" rx="6" fill="var(--mine)" stroke="var(--line)" /><rect x="8" y="62" width="22" height="14" rx="6" fill="var(--theirs)" stroke="var(--line)" /></g>
      </svg>
      <h2>ChatNest for desktop</h2>
      <p>Select a chat from the list to start messaging, or open the Contacts tab to add someone new for a one-to-one conversation.</p>
    </div>
  )
}
