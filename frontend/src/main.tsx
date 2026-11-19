import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@/components/ui/button';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');
createRoot(root).render(<StrictMode><main className="mx-auto max-w-xl space-y-5 p-6"><h1 className="text-2xl font-semibold">Pokefolio</h1><p>Application foundation. Screens are coming in the next roadmap tasks.</p><Button disabled>Dashboard</Button></main></StrictMode>);
