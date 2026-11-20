import { useState } from 'react';
import { cn } from '@/lib/utils';

export function PokemonArt({ src, alt, size = 'thumbnail', className }: { src?: string | undefined; alt: string; size?: 'thumbnail' | 'detail'; className?: string }) {
  const [failed, setFailed] = useState(false);
  const large = size === 'detail';
  return <div className={cn(large ? 'card-art-large mx-auto w-[min(58vw,15rem)] aspect-square pokemon-art-large' : 'size-13 shrink-0', 'pokemon-art', className)}>
    <span className="pokemon-art-window">{src && !failed ? <img src={src} alt={alt} loading={large ? 'eager' : 'lazy'} width="245" height="342" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <span aria-hidden className="flex h-full items-center justify-center text-blue-700">?</span>}</span>
  </div>;
}
