import { LuChevronRight } from 'react-icons/lu';
import { Card } from './surfaces';
import { PokemonArt } from './pokemon-art';

type Item = {id:string;name:string;subtitle:string;imageUrl:string|undefined;value:string;onOpen:()=>void};
export function TopHoldings({id,title,actionLabel,onViewAll,items,empty}:{id:string;title:string;actionLabel:string;onViewAll:()=>void;items:readonly Item[];empty:string}) {
  return <section aria-labelledby={id}>
    <div className="dashboard-section-heading"><h2 id={id}>{title}</h2><button type="button" onClick={onViewAll}>{actionLabel}<LuChevronRight aria-hidden/></button></div>
    <Card className="dashboard-holdings">{items.length?<ul>{items.map(item=><li key={item.id}><button type="button" onClick={item.onOpen} data-copy-id={item.id}>
      <PokemonArt src={item.imageUrl} alt={item.name} className="dashboard-holding-art"/>
      <span className="dashboard-holding-name"><strong>{item.name}</strong><span>{item.subtitle}</span></span><bdi>{item.value}</bdi><LuChevronRight aria-hidden/><span className="sr-only">{item.id}</span>
    </button></li>)}</ul>:<p className="dashboard-empty">{empty}</p>}</Card>
  </section>;
}
