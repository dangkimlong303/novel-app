'use client';

import { useState, useEffect } from 'react';

interface Settings {
  fontSize: number;
  theme: 'white' | 'sepia' | 'dark';
}

var SETTINGS_KEY = 'readerSettings';
var DEFAULT_SETTINGS: Settings = { fontSize: 18, theme: 'white' };

var themeStyles: Record<string, { bg: string; text: string }> = {
  white: { bg: '#ffffff', text: '#111827' },
  sepia: { bg: '#fef3c7', text: '#78350f' },
  dark: { bg: '#111827', text: '#f3f4f6' },
};

export default function ReaderClient({ children }: { children: React.ReactNode }) {
  var [settings, setSettings] = useState(DEFAULT_SETTINGS);
  var [open, setOpen] = useState(false);

  useEffect(function() {
    try {
      var saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        setSettings({ fontSize: parsed.fontSize || 18, theme: parsed.theme || 'white' });
      }
    } catch (e) { /* ignore */ }
  }, []);

  function updateSettings(newSettings: Settings) {
    setSettings(newSettings);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings)); } catch (e) { /* ignore */ }
  }

  var theme = themeStyles[settings.theme] || themeStyles.white;

  return (
    <div>
      {/* Settings toggle */}
      <div className="mb-4">
        <button
          onClick={function() { setOpen(!open); }}
          className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
        >
          {open ? 'Hide Settings' : 'Settings'}
        </button>

        {open && (
          <div className="mt-3 p-4 border rounded-lg bg-white flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Font Size:</span>
              <button
                onClick={function() { updateSettings({ fontSize: Math.max(14, settings.fontSize - 2), theme: settings.theme }); }}
                className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100"
              >-</button>
              <span className="text-sm w-8 text-center">{settings.fontSize}</span>
              <button
                onClick={function() { updateSettings({ fontSize: Math.min(24, settings.fontSize + 2), theme: settings.theme }); }}
                className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100"
              >+</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Theme:</span>
              {['white', 'sepia', 'dark'].map(function(t) {
                var s = themeStyles[t];
                return (
                  <button
                    key={t}
                    onClick={function() { updateSettings({ fontSize: settings.fontSize, theme: t as Settings['theme'] }); }}
                    className={'px-3 py-1 border rounded text-sm capitalize ' + (settings.theme === t ? 'ring-2 ring-blue-500' : 'hover:bg-gray-100')}
                    style={{ backgroundColor: s.bg, color: s.text }}
                  >{t}</button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Apply settings to children via wrapper */}
      <div style={{ fontSize: settings.fontSize + 'px', lineHeight: '1.8' }}>
        <style>{
          '[data-chapter-content] { background-color: ' + theme.bg + '; color: ' + theme.text + '; }'
        }</style>
        {children}
      </div>
    </div>
  );
}
