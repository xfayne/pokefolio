import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PokemonArt, highResolutionCardImage } from './pokemon-art';

it('requests high-resolution artwork immediately while preserving the compact detail frame', () => {
  const src = 'https://images.pokemontcg.io/gym2/12.png';
  expect(highResolutionCardImage(src)).toBe('https://images.pokemontcg.io/gym2/12_hires.png');
  expect(highResolutionCardImage('https://images.pokemontcg.io/gym2/12_hires.png')).toBe('https://images.pokemontcg.io/gym2/12_hires.png');
  expect(highResolutionCardImage('/assets/ancient-mew.jpg')).toBe('/assets/ancient-mew.jpg');
  const view = render(<PokemonArt src={src} alt="Misty's Golduck" size="detail" />);
  const art = view.container.querySelector('.pokemon-art')!;
  expect(art).toHaveAttribute('data-image-state', 'loading');
  expect(art.querySelector('.pokemon-art-window')).toHaveAttribute('data-loading', 'true');
  const image = screen.getByRole('img', { name: "Misty's Golduck" });
  expect(image).toHaveAttribute('src', 'https://images.pokemontcg.io/gym2/12_hires.png');
  expect(image).toHaveClass('object-cover');
  expect(art).toHaveClass('aspect-square');
  fireEvent.load(image);
  expect(art).toHaveAttribute('data-image-state', 'ready');
  view.rerender(<PokemonArt src={src} alt="Misty's Golduck" size="zoom" />);
  expect(view.container.querySelector('.pokemon-art-zoom')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: "Misty's Golduck" })).toHaveClass('object-contain');
});

it('reserves a shimmer while loading thumbnails, and resets when the image changes', () => {
  const view = render(<PokemonArt src="/first.png" alt="First" />);
  expect(view.container.querySelector('.pokemon-art-window')).toHaveAttribute('data-loading', 'true');
  fireEvent.load(screen.getByRole('img', { name: 'First' }));
  expect(view.container.querySelector('.pokemon-art')).toHaveAttribute('data-image-state', 'ready');
  view.rerender(<PokemonArt src="/second.png" alt="Second" />);
  expect(view.container.querySelector('.pokemon-art')).toHaveAttribute('data-image-state', 'loading');
  expect(screen.getByRole('img', { name: 'Second' })).toHaveAttribute('src', '/second.png');
});

it('falls back from unavailable hi-res to standard image and then an accessible error glyph', () => {
  const view = render(<PokemonArt src="/sample.png" alt="Sample" size="detail" />);
  fireEvent.error(screen.getByRole('img', { name: 'Sample' }));
  expect(screen.getByRole('img', { name: 'Sample' })).toHaveAttribute('src', '/sample.png');
  expect(view.container.querySelector('.pokemon-art')).toHaveAttribute('data-image-state', 'loading');
  fireEvent.error(screen.getByRole('img', { name: 'Sample' }));
  expect(view.container.querySelector('.pokemon-art')).toHaveAttribute('data-image-state', 'error');
  expect(screen.getByRole('img', { name: 'Sample' })).toHaveTextContent('✦');
  expect(view.container.querySelector('img')).toBeNull();
});
