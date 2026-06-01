'use client';

import { useState, useEffect } from 'react';

type Lang = 'en' | 'vi';

export default function LanguageToggle({ hasVi }: { hasVi: boolean }) {
  var [lang, setLang] = useState<Lang>('en');

  useEffect(function() {
    var saved = document.documentElement.getAttribute('data-lang') as Lang;
    setLang(saved === 'vi' ? 'vi' : 'en');
  }, []);

  function switchTo(next: Lang) {
    setLang(next);
    document.documentElement.setAttribute('data-lang', next);
    try { localStorage.setItem('readerLanguage', next); } catch (e) { /* ignore */ }
  }

  return (
    <div className="inline-flex border rounded overflow-hidden dark:border-gray-700">
      <button
        onClick={function() { switchTo('en'); }}
        className={
          'px-3 py-1.5 text-sm ' +
          (lang === 'en'
            ? 'bg-blue-600 text-white'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800')
        }
      >
        EN
      </button>
      <button
        onClick={function() { switchTo('vi'); }}
        disabled={!hasVi}
        className={
          'px-3 py-1.5 text-sm border-l dark:border-gray-700 ' +
          (lang === 'vi'
            ? 'bg-blue-600 text-white'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed')
        }
        title={hasVi ? '' : 'Bản dịch tiếng Việt chưa có'}
      >
        VI
      </button>
    </div>
  );
}
