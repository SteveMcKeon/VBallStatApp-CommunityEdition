import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
const TEXT_OPERATORS = [
  { label: "Contains", value: "contains" },
  { label: "Does not contain", value: "not_contains" },
  { label: "Equals", value: "equals" },
  { label: "Does not equal", value: "not_equals" },
  { label: "Begins with", value: "starts_with" },
  { label: "Ends with", value: "ends_with" },
  { label: "Blank", value: "blank" },
  { label: "Not blank", value: "not_blank" },
];
const NUMERIC_OPERATORS = [
  { label: "Equals", value: "equals" },
  { label: "Does not equal", value: "not_equals" },
  { label: "Greater than", value: "gt" },
  { label: "Greater than or equal to", value: "gte" },
  { label: "Less than", value: "lt" },
  { label: "Less than or equal to", value: "lte" },
  { label: "Between", value: "between" },
  { label: "Blank", value: "blank" },
  { label: "Not blank", value: "not_blank" },
];
const SortableFilterHeader = ({
  columnKey,
  label,
  sortConfig,
  onSortChange,
  columnType,
  filterValue,
  onFilterChange,
  isFilterable = true,
  width,
  minWidth = 60,
  onResize,
  onAutoFit,
  isLastColumn,
  minFlexWidth,
  portalEl
}) => {
  const px = (v) => (v ? parseFloat(v) || 0 : 0);
  const headerIntrinsicMin = (th) => {
    if (!th) return minWidth;
    const thCS = getComputedStyle(th);
    const thExtra = px(thCS.paddingLeft) + px(thCS.paddingRight) + px(thCS.borderLeftWidth) + px(thCS.borderRightWidth);
    const btn = th.querySelector('button');
    if (!btn) return Math.max(minWidth, Math.ceil(thExtra));
    const clone = btn.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.whiteSpace = 'nowrap';
    clone.style.width = 'max-content';
    clone.classList?.remove('truncate');
    clone.classList?.remove('w-full');
    th.appendChild(clone);
    const labelW = Math.ceil(clone.getBoundingClientRect().width);
    th.removeChild(clone);
    return Math.max(minWidth, labelW + Math.ceil(thExtra));
  };
  const firstInputRef = useRef(null);
  const isFilterableType = (type) =>
    ['text', 'numeric', 'int', 'int2', 'int4', 'int8', 'float', 'float4', 'float8'].includes(type);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  useEffect(() => {
    if (showFilterMenu && firstInputRef.current) {
      firstInputRef.current.focus();
      firstInputRef.current.select?.();
    }
  }, [showFilterMenu]);
  const wrapperRef = useRef(null);
  const defaultOperator = isFilterableType(columnType) && columnType !== 'text' ? 'equals' : 'contains';

  const effectiveFilter = React.useMemo(() => {
    const hasActive =
      filterValue &&
      Array.isArray(filterValue.conditions) &&
      filterValue.conditions.length > 0;
    return hasActive
      ? filterValue
      : { conditions: [{ operator: defaultOperator, value: '' }] };
  }, [filterValue, defaultOperator]);
  const filterBtnRef = useRef(null);
  const isFilterActive = () =>
    effectiveFilter.conditions.some(({ operator, value }) => {
      if (['blank', 'not_blank'].includes(operator)) return true;
      if (operator === 'between') {
        return value?.min?.toString().trim() !== '' || value?.max?.toString().trim() !== '';
      }
      return value?.toString().trim() !== '';
    });
  useEffect(() => {
    const handlePointerDown = (event) => {
      const onMenu = wrapperRef.current?.contains(event.target);
      const onThisFilterBtn = filterBtnRef.current?.contains(event.target);
      if (!onMenu && !onThisFilterBtn) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, []);
  useEffect(() => {
    const handleCloseAll = () => setShowFilterMenu(false);
    window.addEventListener('closeAllFilters', handleCloseAll);
    return () => window.removeEventListener('closeAllFilters', handleCloseAll);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showFilterMenu) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowFilterMenu(false);
      } else if (e.key === 'Enter') {
        e.stopPropagation();
        setShowFilterMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilterMenu]);
  const toggleSort = () => {
    onSortChange((prev) => {
      if (prev.key === columnKey) {
        if (prev.direction === 'asc') return { key: columnKey, direction: 'desc' };
        if (prev.direction === 'desc') return { key: 'import_seq', direction: 'asc' };
      }
      return { key: columnKey, direction: 'asc' };
    });
  };
  const isSorted = sortConfig.key === columnKey;
  const updateCondition = (idx, key, val) => {
    const updatedConditions = [...effectiveFilter.conditions];
    updatedConditions[idx] = { ...updatedConditions[idx], [key]: val };
    onFilterChange(columnKey, {
      ...effectiveFilter,
      conditions: updatedConditions
    });
  };
  const addCondition = () => {
    if (effectiveFilter.conditions.length >= 10) return;
    const operator = columnType === 'text' ? 'contains' : 'equals';
    const newConditions = [
      ...effectiveFilter.conditions,
      { logic: 'AND', operator, value: '' }
    ];
    onFilterChange(columnKey, {
      ...effectiveFilter,
      conditions: newConditions
    });
    setTimeout(() => {
      if (wrapperRef.current) {
        const inputs = wrapperRef.current.querySelectorAll('input[type="number"], input[type="text"]');
        const lastInput = inputs[inputs.length - 1];
        lastInput?.focus();
        lastInput?.select?.();
      }
    }, 0);
  };
  const removeCondition = (idx) => {
    const newConditions = effectiveFilter.conditions.filter((_, i) => i !== idx);
    onFilterChange(columnKey, {
      ...effectiveFilter,
      conditions: newConditions.length ? newConditions : [{ operator: 'contains', value: '' }]
    });
  };
  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new Event('db_col_resize_start'));
    const startX = e.clientX;
    const th = e.currentTarget.closest('th');
    const startWidth = width ?? th.getBoundingClientRect().width;
    const flexTh = th.parentElement.querySelector('th[data-flex="true"]');
    const flexWidth = flexTh ? Math.round(flexTh.getBoundingClientRect().width) : 0;
    const maxGrow = Math.max(0, flexWidth - minFlexWidth);
    const hardMin = headerIntrinsicMin(th);
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      const unclamped = Math.round(startWidth + delta);
      const upperBound = startWidth + maxGrow;
      const next = Math.min(upperBound, Math.max(hardMin, unclamped));
      onResize?.(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.dispatchEvent(new Event('db_col_resize_end'));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const thRef = useRef(null);
  const [menuFixedStyle, setMenuFixedStyle] = useState({});
  const computeFixedPos = () => {
    if (!thRef.current) return {};
    const thRect = thRef.current.getBoundingClientRect();
    const tableEl = thRef.current.closest('table');
    const tableRect = tableEl ? tableEl.getBoundingClientRect() : { left: 0, right: window.innerWidth };
    const menuWidth = (wrapperRef.current && wrapperRef.current.offsetWidth) || 224;
    const gutter = 8;
    const wouldOverflowRight = thRect.right > menuWidth;
    let left = wouldOverflowRight
      ? Math.min(thRect.right - menuWidth, tableRect.right - menuWidth - gutter)
      : Math.max(thRect.left, tableRect.left + gutter);
    const top = thRect.bottom + 4;
    return { position: 'fixed', top, left, right: 'auto', bottom: 'auto' };
  };
  useLayoutEffect(() => {
    if (!showFilterMenu) return;
    const update = () => setMenuFixedStyle(computeFixedPos());
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showFilterMenu]);
  return (
    <th
      ref={thRef}
      data-key={columnKey}
      data-flex={isLastColumn ? 'true' : 'false'}
      className="group relative px-2 py-1 text-sm font-medium text-gray-800 bg-gray-100 border-b border-gray-300"
      style={width ? { width, maxWidth: width, minWidth } : { minWidth }}
      aria-sort={isSorted ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className="relative text-center w-full overflow-hidden">
        <button
          onClick={toggleSort}
          className="w-full truncate pr-8 pl-5 cursor-pointer hover:bg-gray-200/60"
        >
          <span className="absolute left-1 text-xs text-center pointer-events-none select-none">
            {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '\u00A0'}
          </span>
          {label}
        </button>
        {isFilterable && isFilterableType(columnType) && (
          <button
            ref={filterBtnRef}
            onClick={() => {
              const shouldOpen = !showFilterMenu;
              window.dispatchEvent(new Event('closeAllFilters'));
              setShowFilterMenu(shouldOpen);
            }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer
        ${isFilterActive() ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700'
                : 'text-gray-500 hover:text-black hover:bg-gray-300'}`}
            title="Filter"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 4h18M6 10h12M10 16h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {isFilterActive() && (
              <span className="absolute top-[2px] right-[2px] w-1.5 h-1.5 bg-blue-500 rounded-full" />
            )}
          </button>
        )}
      </div>
      {!isLastColumn && (
        <div
          onMouseDown={startDrag}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const th = e.currentTarget.closest('th');
            const before = Math.round(th.getBoundingClientRect().width);
            window.dispatchEvent(new Event('db_col_resize_start'));
            onAutoFit?.();
            const waitUntilWidthChanges = (tries = 16) => {
              if (tries <= 0) return window.dispatchEvent(new Event('db_col_resize_end'));
              requestAnimationFrame(() => {
                const now = Math.round(th.getBoundingClientRect().width);
                if (now !== before) {
                  window.dispatchEvent(new Event('db_col_resize_end'));
                } else {
                  waitUntilWidthChanges(tries - 1);
                }
              });
            };
            waitUntilWidthChanges();
          }}
          className="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none bg-gray-300/70 hover:bg-gray-400"
          title="Drag to resize. Dbl click to auto-fit."
        />
      )}
      {showFilterMenu && isFilterableType(columnType) && (
        (portalEl ? createPortal(
          <div
            ref={wrapperRef}
            className="z-[9999] bg-white border border-gray-300 shadow-lg rounded-md p-2 w-56 space-y-2 max-h-96 overflow-y-auto"
            style={menuFixedStyle}
          >
            {effectiveFilter.conditions.map((condition, idx) => {
              const OPERATORS = columnType === 'text' ? TEXT_OPERATORS : NUMERIC_OPERATORS;
              return (
                <div key={idx} className="space-y-1 pt-1 border-t border-gray-200">
                  {idx > 0 && (
                    <div className="flex justify-center gap-4 pb-1">
                      {['AND', 'OR'].map((logic) => (
                        <label key={logic} className="inline-flex items-center gap-1 text-sm">
                          <input
                            type="radio"
                            name={`logic-${columnKey}-${idx}`} // Unique per condition
                            checked={condition.logic === logic}
                            onChange={() => updateCondition(idx, 'logic', logic)}
                          />
                          {logic}
                        </label>
                      ))}
                    </div>
                  )}
                  <select
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    value={condition.operator}
                    onChange={(e) => {
                      updateCondition(idx, 'operator', e.target.value);
                      setTimeout(() => {
                        if (idx === 0 && firstInputRef.current) {
                          firstInputRef.current.focus();
                          firstInputRef.current.select?.();
                        }
                      }, 0);
                    }}
                  >
                    {OPERATORS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {!['blank', 'not_blank'].includes(condition.operator) && (
                    <>
                      {condition.operator === 'between' ? (
                        <div className="flex gap-1">
                          <input
                            ref={idx === 0 ? firstInputRef : null}
                            type="number"
                            className="w-1/2 border border-gray-300 rounded px-2 py-1 text-sm"
                            value={condition.value?.min ?? ''}
                            placeholder="Min"
                            onChange={(e) =>
                              updateCondition(idx, 'value', {
                                ...condition.value,
                                min: e.target.value
                              })
                            }
                          />
                          <input
                            type="number"
                            className="w-1/2 border border-gray-300 rounded px-2 py-1 text-sm"
                            value={condition.value?.max ?? ''}
                            placeholder="Max"
                            onChange={(e) =>
                              updateCondition(idx, 'value', {
                                ...condition.value,
                                max: e.target.value
                              })
                            }
                          />
                        </div>
                      ) : (
                        <input
                          ref={idx === 0 ? firstInputRef : null}
                          type={columnType === 'text' ? 'text' : 'number'}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          value={condition.value ?? ''}
                          placeholder="Filter value"
                          onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                        />
                      )}
                    </>
                  )}
                  {effectiveFilter.conditions.length > 1 && (
                    <button
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => removeCondition(idx)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )
            })}
            {effectiveFilter.conditions.length < 10 && (
              <button
                onClick={addCondition}
                className="w-full text-sm text-blue-600 hover:underline mt-2"
              >
                + Add Condition
              </button>
            )}
            <button
              onClick={() => {
                onFilterChange(columnKey, null);
                setShowFilterMenu(false);
              }}
              className="mt-2 w-full text-xs text-gray-600 hover:text-red-600"
            >
              Clear Filter
            </button>
          </div>,
          document.body
        ) : null)
      )}
    </th>
  );
};
export default SortableFilterHeader;
