import { ChevronLeft } from './Icons'

// Round back arrow shown only on small screens (hidden on desktop by CSS)
export default function BackButton({ onClick, label = 'Back to chats' }) {
  return (
    <button type="button" className="back-btn" aria-label={label} title={label} onClick={onClick}>
      <ChevronLeft size={26} />
    </button>
  )
}
