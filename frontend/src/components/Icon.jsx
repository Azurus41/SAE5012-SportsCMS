// Icônes exportées de la maquette Figma (src/assets/figma).
const files = import.meta.glob('../assets/figma/*.svg', { eager: true, import: 'default' });
const ICONS = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.svg', ''), url]),
);

const SIZES = { 'chevron-down': 14, 'chevron-up': 14, 'grip-vertical': 14, 'link-small': 16, 'image-plus': 22 };

export default function Icon({ name, size, className = '', label }) {
  const s = size || SIZES[name] || 18;
  return (
    <img
      src={ICONS[name]}
      width={s}
      height={s}
      className={`icon ${className}`}
      alt={label || ''}
      aria-hidden={label ? undefined : true}
    />
  );
}
