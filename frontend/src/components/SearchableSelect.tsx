import React, { useState, useRef, useEffect } from 'react';
import { Search, Check, X, AlertTriangle, ChevronDown } from 'lucide-react';

export interface SearchableOption {
  value: string | number;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export interface SearchableSelectProps {
  value: string | number | undefined;
  onChange: (val: any) => void;
  options: SearchableOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  hint?: string;
  icon?: React.ReactNode;
  error?: string | null;
  onSelectDisabled?: (opt: SearchableOption) => void;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Search...',
  disabled = false,
  className = '',
  label,
  hint,
  icon,
  error,
  onSelectDisabled
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  // Sync display: when dropdown closes without a new selection, restore selected label
  const displayValue = open
    ? inputVal
    : (selectedOption?.label ?? '');

  const filteredOptions = options.filter((o) => {
    if (!open) return true;
    const q = inputVal.toLowerCase();
    if (!q) return true;
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(q)) ||
      (o.badge && o.badge.toLowerCase().includes(q))
    );
  });

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setInputVal('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight when filtered options change
  useEffect(() => {
    setHighlightIdx(-1);
  }, [inputVal]);

  function handleFocus() {
    if (!disabled) {
      setOpen(true);
      setInputVal('');
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputVal(e.target.value);
    setOpen(true);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setInputVal('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleSelect(opt: SearchableOption) {
    if (opt.disabled) {
      if (onSelectDisabled) onSelectDisabled(opt);
      return;
    }
    onChange(opt.value);
    setInputVal('');
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        setInputVal('');
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && filteredOptions[highlightIdx]) {
        handleSelect(filteredOptions[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setInputVal('');
      inputRef.current?.blur();
    }
  }

  const hasConflict = Boolean(error || selectedOption?.disabled);

  return (
    <div
      ref={containerRef}
      className={`searchable-select-wrap ${className}`}
      style={{ position: 'relative', width: '100%', zIndex: open ? 60 : undefined }}
    >
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {icon}
            <span>{label}</span>
          </label>
          {hint && <span style={{ fontSize: '10px', color: 'var(--muted, #64748b)' }}>{hint}</span>}
        </div>
      )}

      {/* Single input box with inner icon controls */}
      <div
        className="searchable-select-box"
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Left search icon */}
        <span
          style={{
            position: 'absolute',
            left: '12px',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            color: open ? '#00c8d4' : 'var(--cap-text-muted, #64748b)',
            zIndex: 2,
            transition: 'color 0.18s',
          }}
        >
          <Search size={14} />
        </span>

        {/* The single main input */}
        <input
          ref={inputRef}
          type="text"
          className={`searchable-select-input ${hasConflict ? 'has-error' : ''}`}
          disabled={disabled}
          value={open ? inputVal : (selectedOption?.label ?? '')}
          placeholder={open && selectedOption ? selectedOption.label : placeholder}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onClick={() => {
            if (!disabled && !open) {
              setOpen(true);
              setInputVal('');
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            paddingLeft: '38px',
            paddingRight: selectedOption ? '56px' : '36px',
            background: hasConflict
              ? 'rgba(239, 68, 68, 0.08)'
              : 'var(--cap-input-bg, #0f172a)',
            border: hasConflict
              ? '1px solid #ef4444'
              : open
                ? '1px solid #00c8d4'
                : '1px solid var(--cap-input-border, #334155)',
            borderRadius: '9px',
            height: '42px',
            fontSize: '0.88rem',
            fontWeight: selectedOption && !open ? 600 : 400,
            color: 'var(--cap-input-text, #f8fafc)',
            outline: 'none',
            boxShadow: open ? '0 0 0 3px rgba(0, 200, 212, 0.15)' : 'none',
            cursor: disabled ? 'not-allowed' : 'text',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />

        {/* Right side controls: Clear (X) and Chevron */}
        <div
          style={{
            position: 'absolute',
            right: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            zIndex: 2,
          }}
        >
          {selectedOption && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              title="Clear selection"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: 'var(--cap-text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
              }}
            >
              <X size={13} />
            </button>
          )}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--cap-text-muted, #94a3b8)',
              padding: '2px',
            }}
            onClick={() => {
              if (!disabled) {
                if (open) {
                  setOpen(false);
                } else {
                  inputRef.current?.focus();
                  setOpen(true);
                  setInputVal('');
                }
              }
            }}
          >
            <ChevronDown
              size={14}
              style={{
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </span>
        </div>
      </div>

      {/* Field error */}
      {(error || (selectedOption?.disabled && selectedOption.disabledReason)) && (
        <div style={{ marginTop: '4px', fontSize: '11px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <AlertTriangle size={12} color="#f87171" style={{ flexShrink: 0 }} />
          <span>{error || selectedOption?.disabledReason}</span>
        </div>
      )}

      {/* Selected Option Availability Feedback */}
      {!error && !selectedOption?.disabled && selectedOption && !open && (
        <div style={{ marginTop: '4px', fontSize: '11px', color: selectedOption.badgeColor || '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Check size={12} color={selectedOption.badgeColor || '#10b981'} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{selectedOption.badge || 'SELECTED'}:</span>
          <span style={{ opacity: 0.9 }}>{selectedOption.sublabel || selectedOption.label}</span>
        </div>
      )}

      {/* Dropdown suggestions */}
      {open && (
        <div
          className="searchable-select-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--cap-card-bg, #0f172a)',
            border: '1px solid var(--cap-card-border, #334155)',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
            maxHeight: '270px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* No results */}
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
              No matches found
            </div>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: '270px', padding: '4px' }}>
              {filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isDisabled = Boolean(opt.disabled);
                const isHighlighted = idx === highlightIdx;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // prevent blur before click
                      handleSelect(opt);
                    }}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    style={{
                      width: '100%',
                      padding: '9px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '6px',
                      background: isSelected
                        ? 'rgba(2, 132, 199, 0.18)'
                        : isHighlighted
                          ? 'rgba(14, 165, 233, 0.1)'
                          : isDisabled
                            ? 'rgba(239, 68, 68, 0.06)'
                            : 'transparent',
                      color: isSelected
                        ? '#38bdf8'
                        : isDisabled
                          ? '#94a3b8'
                          : 'var(--cap-text-main, #f8fafc)',
                      border: isDisabled ? '1px dashed rgba(239, 68, 68, 0.35)' : 'none',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.75 : 1,
                      fontSize: '13px',
                      textAlign: 'left',
                      marginBottom: isDisabled ? '3px' : '0',
                      transition: 'background 0.12s',
                    }}
                    title={isDisabled ? (opt.disabledReason || 'Not available') : undefined}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{opt.label}</span>
                        {isDisabled && (
                          <span style={{ fontSize: '9px', color: '#f87171', fontWeight: 800, textTransform: 'uppercase' }}>
                            (Unavailable)
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <div style={{ fontSize: '11px', color: isDisabled ? '#f87171' : 'var(--cap-text-muted, #94a3b8)', marginTop: '2px' }}>
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: opt.badgeColor ? `${opt.badgeColor}22` : 'rgba(2, 132, 199, 0.2)',
                            color: opt.badgeColor || '#38bdf8',
                            border: opt.badgeColor ? `1px solid ${opt.badgeColor}60` : undefined,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check size={14} color="#38bdf8" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
