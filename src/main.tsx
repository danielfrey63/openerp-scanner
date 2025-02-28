import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { OpenERPProvider } from './context/OpenERPContext'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OpenERPProvider>
      <RouterProvider router={router} />
    </OpenERPProvider>
  </React.StrictMode>
)