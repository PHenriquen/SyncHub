import { Activity, Command, Search, Settings } from 'lucide-react';
import Link from 'next/link';

export function Topbar() {
  return (
    <header className="topbar">
      <label className="search-box">
        <Search size={15} />
        <input aria-label="Search Synchub" placeholder="Search projects, tasks and synchronized events..." disabled />
        <Command size={13} />
      </label>
      <div className="topbar-actions">
        <span className="network-status"><i /><Activity size={13} /> Synchub Network</span>
        <Link className="icon-button" aria-label="Workspace settings" href="/settings"><Settings size={16} /></Link>
      </div>
    </header>
  );
}
