export default function DarkModeInit() {
  var script = `
    (function() {
      try {
        if (localStorage.getItem('darkMode') === 'true') {
          document.documentElement.classList.add('dark');
        }
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
