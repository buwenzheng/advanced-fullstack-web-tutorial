import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { searchCurriculum } from './search';

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const hits = useMemo(() => searchCurriculum(query), [query]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`search-hit-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const pick = (to: string) => {
    setQuery('');
    close();
    inputRef.current?.blur();
    navigate(to);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!hits.length) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((prev) => (prev + delta + hits.length) % hits.length);
      return;
    }
    if (event.key === 'Enter') {
      const target = hits[active] ?? hits[0];
      if (!target) return;
      event.preventDefault();
      pick(target.to);
      return;
    }
    if (event.key === 'Escape') {
      close();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="topbar__search" ref={rootRef}>
      <svg className="topbar__search-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="5.5" /><path d="M13 13l4 4" />
      </svg>
      <input
        id="search-input"
        ref={inputRef}
        type="search"
        placeholder="搜索知识点、阶段、项目或 AI 主题…"
        autoComplete="off"
        aria-label="搜索课程内容"
        aria-expanded={open}
        aria-controls="search-results"
        role="combobox"
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `search-hit-${active}` : undefined}
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(Boolean(next.trim()));
          setActive(-1);
        }}
        onFocus={() => {
          if (query) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="search-results" id="search-results" role="listbox" hidden={!open}>
        {open && hits.length === 0 ? (
          <div className="search-empty">没有匹配的课程内容</div>
        ) : (
          hits.map((hit, index) => (
            <Link
              key={`${hit.type}-${hit.to}`}
              id={`search-hit-${index}`}
              className={`search-hit${index === active ? ' is-active' : ''}`}
              to={hit.to}
              role="option"
              aria-selected={index === active}
              onClick={(event) => {
                event.preventDefault();
                pick(hit.to);
              }}
            >
              <strong>{hit.title}</strong>
              <span>{hit.sub}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
