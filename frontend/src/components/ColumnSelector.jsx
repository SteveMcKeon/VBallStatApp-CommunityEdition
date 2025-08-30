import { useState, useRef, useEffect } from 'react';
const ColumnSelector = ({ columns, visibleColumns, toggleColumn }) => {
  const [open, setOpen] = useState(false);
  const selectorRef = useRef();
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <div className="relative" ref={selectorRef}>
      <button
        type="button"
        className="w-full cursor-pointer border border-black p-2 text-left bg-white rounded hover:border-gray-400 text-sm focus:outline-none focus:ring-1 focus:border-blue-500 focus:ring-blue-500 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {columns
          .filter(c => visibleColumns[c.key]?.visible)
          .map(c => c.label)
          .join(', ') || 'None Selected'}
      </button>
      {open && (
        <div className="absolute z-10 bg-white border border-gray-300 rounded-md shadow mt-1 w-full max-h-60 overflow-y-auto">
          {columns.map(({ key, label, disabled }) => (
            <label
              key={key}
              className={`flex items-center space-x-2 px-2 text-base rounded cursor-pointer transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'bg-white hover:bg-gray-100'
                }`}
            >
              <input
                type="checkbox"
                checked={visibleColumns[key]?.visible || false}
                onChange={() => {
                  if (!disabled) toggleColumn(key);
                }}
                disabled={disabled}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
export default ColumnSelector;