import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/montserrat/latin-900.css';
import { App } from './App';
import { AuthProvider } from './auth';
import { ScheduleProvider } from './schedule-context';
import './styles.css';

const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ||
  '782128846272-hvq1st144odrrq2vuhdjc6gtlrrsfgbf.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <BrowserRouter>
        <AuthProvider>
          <ScheduleProvider><App /></ScheduleProvider>
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
);
