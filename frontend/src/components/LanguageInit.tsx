export default function LanguageInit() {
  var script = `
    (function() {
      try {
        var lang = localStorage.getItem('readerLanguage') || 'en';
        document.documentElement.setAttribute('data-lang', lang);
      } catch(e) {
        document.documentElement.setAttribute('data-lang', 'en');
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
