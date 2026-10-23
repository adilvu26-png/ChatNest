import { useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import ChatWindow from '../components/ChatWindow'
import AIChat from '../components/AIChat'
import EmptyState from '../components/EmptyState'
import '../styles-pro.css'

export default function Home() {
  const { chatId } = useParams()
  return (
    <div className={'shell' + (chatId ? ' open' : '')}>
      <Sidebar activeId={chatId} />
      {chatId === 'ai'
        ? <AIChat key="ai" />
        : chatId
          ? <ChatWindow key={chatId} chatId={chatId} />
          : <EmptyState />}
    </div>
  )
}
