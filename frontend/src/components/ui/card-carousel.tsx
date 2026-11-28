import { useId, type ReactNode } from 'react';
import { LuChevronRight } from 'react-icons/lu';
import { PokemonArt } from './pokemon-art';
import { Card } from './surfaces';

type CarouselItem = Readonly<{
  id: string;
  name: string;
  imageUrl: string | undefined;
  caption: ReactNode;
  showName?: boolean;
  onOpen: () => void;
}>;

export function CardCarousel({ title, actionLabel, onAction, items, empty }: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  items: readonly CarouselItem[];
  empty: ReactNode;
}) {
  const id = useId();
  const scrollable = items.length > 3;
  return <Card className="card-carousel" aria-labelledby={id}>
    <div className="dashboard-section-heading">
      <h2 id={id}>{title}</h2>
      <button type="button" onClick={onAction}>{actionLabel}<LuChevronRight aria-hidden /></button>
    </div>
    {items.length ? <ul className="card-carousel-track" data-scrollable={scrollable || undefined}
      aria-labelledby={id} tabIndex={scrollable ? 0 : undefined}>
      {items.map(item => <li key={item.id}>
        <button type="button" data-copy-id={item.id} onClick={item.onOpen}>
          <div aria-hidden={item.showName || undefined}>
            <PokemonArt src={item.imageUrl} alt={item.name} className="card-carousel-art" />
          </div>
          {item.showName && <strong>{item.name}</strong>}
          <span className={item.showName ? 'card-carousel-detail' : undefined}>{item.caption}</span>
          <span className="sr-only">{item.id}</span>
        </button>
      </li>)}
    </ul> : <p className="dashboard-empty">{empty}</p>}
  </Card>;
}
