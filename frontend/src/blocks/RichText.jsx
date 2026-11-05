// Mise en forme légère des blocs texte : **gras**, *italique*, [lien](https://…), listes « - ».
// Rendu en éléments React (jamais de HTML injecté) pour éviter toute faille XSS.

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text, keyPrefix) {
  return String(text)
    .split(INLINE)
    .filter((part) => part !== '')
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) {
        const safe = /^(https?:|mailto:|\/)/i.test(link[2]) ? link[2] : '#';
        const external = /^https?:/i.test(safe);
        return (
          <a key={key} href={safe} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {link[1]}
          </a>
        );
      }
      return part;
    });
}

export default function RichText({ text, className = '' }) {
  const paragraphs = String(text || '').split(/\n{2,}/);
  return paragraphs.map((para, pi) => {
    const lines = para.split('\n');
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
      return (
        <ul key={pi} className={className}>
          {lines.map((l, li) => (
            <li key={li}>{inline(l.replace(/^\s*[-•]\s+/, ''), `${pi}-${li}`)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={pi} className={className}>
        {lines.map((l, li) => (
          <span key={li}>
            {li > 0 && <br />}
            {inline(l, `${pi}-${li}`)}
          </span>
        ))}
      </p>
    );
  });
}
