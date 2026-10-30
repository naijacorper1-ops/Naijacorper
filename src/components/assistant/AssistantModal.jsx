import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles } from 'lucide-react'
import Modal from '../ui/Modal'
import { useApp } from '../../context/AppContext'
import { assistantSuggestions, assistantAnswers } from '../../data/mock'

function answerFor(q) {
  const t = q.toLowerCase()
  if (t.includes('camp') || t.includes('take') || t.includes('pack')) return assistantAnswers.camp
  if (t.includes('relocat')) return assistantAnswers.relocation
  if (t.includes('cds')) return assistantAnswers.cds
  if (t.includes('document') || t.includes('need')) return assistantAnswers.documents
  return assistantAnswers.default
}

export default function AssistantModal() {
  const { assistantOpen, setAssistantOpen } = useApp()
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Hi 👋 I'm the NaijaCorper Assistant. Ask me anything about NYSC — camp, relocation, CDS, documents and more." },
  ])
  const [input, setInput] = useState('')
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  if (!assistantOpen) return null

  const send = (q) => {
    const question = (q ?? input).trim()
    if (!question) return
    setMessages(prev => [...prev, { from: 'me', text: question }])
    setInput('')
    setTimeout(() => {
      setMessages(prev => [...prev, { from: 'bot', text: answerFor(question) }])
    }, 500)
  }

  return (
    <Modal title="" onClose={() => setAssistantOpen(false)} wide>
      <div className="assistant">
        <div className="assistant__head">
          <span className="assistant__badge"><Bot size={20} /></span>
          <div>
            <span className="assistant__title">NaijaCorper Assistant</span>
            <span className="assistant__sub"><Sparkles size={12} /> NYSC & service-year helper</span>
          </div>
        </div>

        <div className="assistant__thread">
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble--${m.from === 'me' ? 'me' : 'bot'}`}>
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {messages.length <= 1 && (
          <div className="assistant__chips">
            {assistantSuggestions.map(s => (
              <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}

        <div className="assistant__input">
          <input
            placeholder="Ask about NYSC…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className="btn btn--primary btn--sm" onClick={() => send()} aria-label="Send">
            <Send size={16} />
          </button>
        </div>
        <p className="assistant__disclaimer">
          Community guidance — always confirm important details with official NYSC channels.
        </p>
      </div>
    </Modal>
  )
}
