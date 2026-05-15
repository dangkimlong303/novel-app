'use client';

import { useState } from 'react';

export default function ShareButton() {
  var [copied, setCopied] = useState(false);

  function handleShare() {
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function() {
        setCopied(true);
        setTimeout(function() { setCopied(false); }, 2000);
      });
    } else {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <button
      onClick={handleShare}
      className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base border rounded hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
