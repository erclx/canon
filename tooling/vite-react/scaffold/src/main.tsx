import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app.tsx'

const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
