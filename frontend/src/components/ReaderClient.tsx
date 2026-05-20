'use client';

import { useState, useEffect } from 'react';

type FontFamily = 'default' | 'serif' | 'sans' | 'mono';

interface Settings {
  fontSize: number;
  theme: 'white' | 'sepia' | 'dark';
  fontFamily: FontFamily;
}

var SETTINGS_KEY = 'readerSettings';
var DEFAULT_SETTINGS: Settings = { fontSize: 18, theme: 'white', fontFamily: 'default' };

var themeStyles: Record<string, { bg: string; text: string }> = {
  white: { bg: '#ffffff', text: '#111827' },
  sepia: { bg: '#fef3c7', text: '#78350f' },
  dark: { bg: '#111827', text: '#f3f4f6' },
};

var fontStacks: Record<FontFamily, string> = {
  default: 'inherit',
  serif: 'Georgia, "Times New Roman", Times, serif',
  sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"Courier New", Courier, monospace',
};

var fontLabels: Record<FontFamily, string> = {
  default: 'Default',
  serif: 'Serif',
  sans: 'Sans',
  mono: 'Mono',
};

export default function ReaderClient({ children }: { children: React.ReactNode }) {
  var [settings, setSettings] = useState(DEFAULT_SETTINGS);
  var [open, setOpen] = useState(false);

  useEffect(function() {
    try {
      var saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        setSettings({
          fontSize: parsed.fontSize || 18,
          theme: parsed.theme || 'white',
          fontFamily: parsed.fontFamily || 'default',
        });
      }
    } catch (e) { /* ignore */ }
  }, []);

  function updateSettings(newSettings: Settings) {
    setSettings(newSettings);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings)); } catch (e) { /* ignore */ }
  }

  var theme = themeStyles[settings.theme] || themeStyles.white;
  var fontStack = fontStacks[settings.fontFamily] || fontStacks.default;

  return (
    <div>
      {/* Settings toggle */}
      <div className="mb-4">
        <button
          onClick={function() { setOpen(!open); }}
          className="text-sm px-3 py-1 border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          {open ? 'Hide Settings' : 'Settings'}
        </button>

        {open && (
          <div className="mt-3 p-4 border rounded-lg bg-white flex flex-wrap gap-6 items-center dark:bg-gray-900 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Font Size:</span>
              <button
                onClick={function() { updateSettings({ ...settings, fontSize: Math.max(14, settings.fontSize - 2) }); }}
                className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >-</button>
              <span className="text-sm w-8 text-center">{settings.fontSize}</span>
              <button
                onClick={function() { updateSettings({ ...settings, fontSize: Math.min(24, settings.fontSize + 2) }); }}
                className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >+</button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Theme:</span>
              {(['white', 'sepia', 'dark'] as const).map(function(t) {
                var s = themeStyles[t];
                return (
                  <button
                    key={t}
                    onClick={function() { updateSettings({ ...settings, theme: t }); }}
                    className={'px-3 py-1 border rounded text-sm capitalize ' + (settings.theme === t ? 'ring-2 ring-blue-500' : 'hover:bg-gray-100')}
                    style={{ backgroundColor: s.bg, color: s.text }}
                  >{t}</button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Font:</span>
              {(['default', 'serif', 'sans', 'mono'] as const).map(function(f) {
                return (
                  <button
                    key={f}
                    onClick={function() { updateSettings({ ...settings, fontFamily: f }); }}
                    className={'px-3 py-1 border rounded text-sm ' + (settings.fontFamily === f ? 'ring-2 ring-blue-500' : 'hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800')}
                    style={{ fontFamily: fontStacks[f] }}
                  >{fontLabels[f]}</button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Apply settings to children via wrapper */}
      <div style={{ fontSize: settings.fontSize + 'px', lineHeight: '1.8', fontFamily: fontStack }}>
        <style>{
          '[data-chapter-content] { background-color: ' + theme.bg + '; color: ' + theme.text + '; }'
        }</style>
        {children}
      </div>
    </div>
  );
}
