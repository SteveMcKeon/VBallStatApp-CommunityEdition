import { useEffect } from 'react';
import { createPortal } from 'react-dom';
const Toast = ({ message, show, duration = 5000, onClose, type = 'success' }) => {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [show, duration, onClose]);
  if (!show) return null;
  const typeStyles = {
    success: 'border-green-700 bg-green-700',
    error: 'border-red-700 bg-red-700',
    neutral: 'border-yellow-600 bg-yellow-500 text-black'
  };
  const node = (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex justify-center pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md p-1 text-center md:w-auto md:text-justify">
        <div
          className={`px-3 py-2 rounded-lg inline-flex flex-row border text-white gap-2 pointer-events-auto cursor-pointer select-none ${typeStyles[type]}`}
          onClick={onClose}
          tabIndex={0}
          aria-label="Dismiss notification"
        >
          <div className="flex-1 justify-center gap-2">
            <div className="text-center whitespace-pre-wrap">{message}</div>
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
};
export default Toast;
