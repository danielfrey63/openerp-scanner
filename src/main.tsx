import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes.js'
import { OpenERPProvider } from '@/context/OpenERPContext.js'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OpenERPProvider>
      <RouterProvider router={router} />
    </OpenERPProvider>
  </React.StrictMode>
)