import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// NOTE: intentionally NOT using <React.StrictMode> — the chart code is
// imperative (createChart/intervals) and StrictMode's double-invoke in dev
// would double-mount charts. Re-add once effects are StrictMode-safe.
createRoot(document.getElementById('root')).render(<App />)
