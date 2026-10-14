import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function InventoryActions({ children }: { children: ReactNode }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const dismiss = () => panel.current?.hidePopover();
    window.addEventListener('resize', dismiss);
    const scroll = (event: Event) => {
      if (event.target !== panel.current) dismiss();
    };
    window.addEventListener('scroll', scroll, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', scroll, true);
    };
  }, []);
  return <>
    <button type="button" className="inventory-actions-trigger" aria-expanded={open} aria-controls={id} onClick={event => {
      const menu = panel.current;
      if (!menu) return;
      if (menu.matches(':popover-open')) { menu.hidePopover(); return; }
      const anchor = event.currentTarget.getBoundingClientRect();
      menu.showPopover();
      const bounds = menu.getBoundingClientRect();
      const below = anchor.bottom + 8;
      const top = below + bounds.height <= window.innerHeight - 8 ? below : Math.max(8, anchor.top - bounds.height - 8);
      menu.style.top = `${top}px`;
      menu.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
    }}>Ações <span aria-hidden="true">{open ? '⌃' : '⌄'}</span></button>
    <div ref={panel} id={id} popover="auto" className="inventory-actions-list inventory-actions-popover" onToggle={event => setOpen(event.newState === 'open')} onClick={event => {
      if ((event.target as HTMLElement).closest('a,button')) panel.current?.hidePopover();
    }}>{children}</div>
  </>;
}
