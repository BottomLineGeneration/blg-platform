import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import BLGPlatform from './BLG_Platform_v5.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BLGPlatform />
  </StrictMode>,
)
