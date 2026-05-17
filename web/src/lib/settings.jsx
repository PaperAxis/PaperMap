import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const SettingsContext = createContext({
  appName: 'PaperMap',
  logoPath: null,
  reload: () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ appName: 'PaperMap', logoPath: null });

  function reload() {
    api('/api/settings')
      .then((d) => {
        setSettings(d.settings);
        document.title = d.settings.appName || 'PaperMap';
      })
      .catch(() => {});
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <SettingsContext.Provider value={{ ...settings, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
