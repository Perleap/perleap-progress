import './dev/suppressViteHmrLogSpam';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import App from './App.tsx';
import './index.css';
import i18n from './i18n/config';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- root element guaranteed in index.html
createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>
);
