'use client';

import { useState, useEffect } from 'react';

export default function DarkModeToggle() {
  var [dark, setDark] = useState(false);

  useEffect(function() {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    var next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('darkMode', String(next)); } catch(e) {}
  }

  return (
    <button
      onClick={toggle}
      className="text-lg px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
