import { useId, type ReactNode } from 'react';
import frame from './pokedex-frame.svg?raw';
// Three views of the approved vector artwork: end caps keep their proportions,
// while only the straight side walls stretch to the available viewport height.
function slice(id:string,viewBox:string,stretch=false) {
  return frame.replace(/id="([^"]+)"/g,(_,key:string)=>`id="${id}-${key}"`)
    .replace(/url\(#([^)]+)\)/g,(_,key:string)=>`url(#${id}-${key})`)
    .replace('width="432" height="700"', 'width="100%" height="100%"')
    .replace('viewBox="0 0 432 700"',`viewBox="${viewBox}" preserveAspectRatio="${stretch?'none':'xMidYMid meet'}"`)
    .replace('role="img"','aria-hidden="true"')
    .replace('<g filter=', '<g class="pokedex-lens" filter=')
    .replace('<circle cx="157"','<circle class="pokedex-green" cx="157"')
    .replace('<circle cx="184"','<circle class="pokedex-yellow" cx="184"');
}
export function PokedexFrame({children,status}:{children:ReactNode;status:'idle'|'busy'|'complete'|'error'}) {
  const id=useId().replace(/:/g,'');
  return <section className="pokedex-frame" data-status={status} aria-label="Pokédex">
    <div className="pokedex-top" aria-hidden dangerouslySetInnerHTML={{__html:slice(`${id}-top`,'0 0 432 140')}} />
    <div className="pokedex-middle" aria-hidden dangerouslySetInnerHTML={{__html:slice(`${id}-middle`,'0 140 432 480',true)}} />
    <div className="pokedex-display">{children}</div>
    <div className="pokedex-bottom" aria-hidden dangerouslySetInnerHTML={{__html:slice(`${id}-bottom`,'0 620 432 80')}} />
  </section>;
}
