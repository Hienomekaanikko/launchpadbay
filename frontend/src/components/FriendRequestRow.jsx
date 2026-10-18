import FormButton from './FormButton.jsx'

export default function FriendRequestRow({ username, onAcceptClick, onRejectClick }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] hover:bg-white/10 transition-colors">
      <span className="text-white text-sm font-sans flex-1 min-w-0 truncate">{username}</span>
      <FormButton type="button" className="px-2 py-1" onClick={() => onAcceptClick(username)}>Accept</FormButton>
      <FormButton type="button" className="px-2 py-1" onClick={() => onRejectClick(username)}>Reject</FormButton>
    </div>
  )
}
