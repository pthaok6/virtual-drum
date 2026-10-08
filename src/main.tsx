import { LanguageProvider } from './i18n/LanguageProvider';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {BrowserRouter} from 'react-router-dom';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider><BrowserRouter><App /></BrowserRouter></LanguageProvider>
  </StrictMode>,
);
