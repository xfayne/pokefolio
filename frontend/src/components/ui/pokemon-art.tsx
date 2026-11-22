import { useState } from 'react';
import { cn } from '@/lib/utils';

type ArtSize = 'thumbnail' | 'detail' | 'zoom';
type ImagePhase = 'loading' | 'ready' | 'error';
type ImageState = { source: string | undefined; phase: ImagePhase; fallback: boolean };

/** Preserve local/non-PNG art while using the provider's hi-res file for full-card views. */
export function highResolutionCardImage(src: string): string {
  return /_hires\.png(?:[?#]|$)/i.test(src) ? src : src.replace(/\.png(?=[?#]|$)/i, '_hires.png');
}

export function PokemonArt({ src, alt, size = 'thumbnail', className }: { src?: string | undefined; alt: string; size?: ArtSize; className?: string }) {
  const large = size !== 'thumbnail';
  const preferred = src && large ? highResolutionCardImage(src) : src;
  const [saved, setSaved] = useState<ImageState>({ source: preferred, phase: 'loading', fallback: false });
  // Immediately reset the visual state if a list reuses this component for another card.
  const state: ImageState = saved.source === preferred ? saved : { source: preferred, phase: 'loading', fallback: false };
  const phase: ImagePhase = !src ? 'error' : state.phase;
  const active = state.fallback ? src : preferred;
  const markReady = () => setSaved({ source: preferred, phase: 'ready', fallback: state.fallback });
  const markError = () => {
    if (!state.fallback && preferred !== src && src) setSaved({ source: preferred, phase: 'loading', fallback: true });
    else setSaved({ source: preferred, phase: 'error', fallback: state.fallback });
  };
  return <div data-image-state={phase} className={cn('pokemon-art', size === 'detail' ? 'pokemon-art-large card-art-large mx-auto w-[min(58vw,15rem)] aspect-square' : size === 'zoom' ? 'pokemon-art-zoom mx-auto w-[min(90vw,30rem)] max-w-full aspect-[63/88]' : 'pokemon-art-thumbnail size-13 shrink-0', className)}>
    <span className="pokemon-art-window" data-loading={phase === 'loading'}>
      {src && phase !== 'error' && <img key={active} src={active} alt={alt} loading={large ? 'eager' : 'lazy'} fetchPriority={large ? 'high' : undefined} decoding="async" width="245" height="342" className={cn('h-full w-full', size === 'zoom' ? 'object-contain' : 'object-cover')} onLoad={markReady} onError={markError} />}
      {phase === 'error' && <span role="img" aria-label={alt} className="pokemon-art-fallback">✦</span>}
    </span>
  </div>;
}
