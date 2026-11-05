import ChartBlock from '../charts/ChartBlock.jsx';
import RichText from './RichText.jsx';

export function headingId(block) {
  return `section-${block.id}`;
}

// Rendu d'un bloc d'article en lecture (page article et aperçu de l'éditeur).
export default function BlockView({ block, datasets, media }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(4, Math.max(2, block.level || 2))}`;
      return (
        <Tag id={headingId(block)} className={`block-heading level-${block.level || 2}`}>
          {block.text}
        </Tag>
      );
    }
    case 'text':
      return <RichText text={block.text} className="block-text" />;
    case 'quote':
      return (
        <blockquote className="pull-quote">
          <p>{block.text}</p>
          {block.cite && <cite>{block.cite}</cite>}
        </blockquote>
      );
    case 'image': {
      const m = media?.find((x) => x.id === block.mediaId);
      if (!m) return <p className="muted small">Image introuvable dans la médiathèque.</p>;
      return (
        <figure className="block-image">
          <img src={m.url} alt={block.alt ?? m.alt ?? ''} width={m.width} height={m.height} loading="lazy" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    }
    case 'chart':
      return <ChartBlock spec={block} datasets={datasets} />;
    default:
      return null;
  }
}
