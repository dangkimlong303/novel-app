'use client';

export interface Settings {
  fontSize: number;
  theme: 'white' | 'sepia' | 'dark';
}

const themes = {
  white: { bg: 'bg-white', text: 'text-gray-900' },
  sepia: { bg: 'bg-amber-50', text: 'text-amber-900' },
  dark: { bg: 'bg-gray-900', text: 'text-gray-100' },
};

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  open: boolean;
  onToggle: () => void;
}

export function getThemeClasses(theme: Settings['theme']) {
  return themes[theme];
}

export default function ReaderSettings({ settings, onChange, open, onToggle }: Props) {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
      >
        {open ? 'Hide Settings' : 'Settings'}
      </button>

      {open && (
        <div className="mt-3 p-4 border rounded-lg bg-white flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Font Size:</span>
            <button
              onClick={() => onChange({ ...settings, fontSize: Math.max(14, settings.fontSize - 2) })}
              className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100"
            >
              -
            </button>
            <span className="text-sm w-8 text-center">{settings.fontSize}</span>
            <button
              onClick={() => onChange({ ...settings, fontSize: Math.min(24, settings.fontSize + 2) })}
              className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Theme:</span>
            {(['white', 'sepia', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onChange({ ...settings, theme: t })}
                className={`px-3 py-1 border rounded text-sm capitalize ${
                  settings.theme === t ? 'ring-2 ring-blue-500' : 'hover:bg-gray-100'
                } ${themes[t].bg} ${themes[t].text}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
