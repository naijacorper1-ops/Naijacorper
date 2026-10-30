import { useApp } from '../../context/AppContext'

export default function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return <div className="toast" role="status">{toast}</div>
}
