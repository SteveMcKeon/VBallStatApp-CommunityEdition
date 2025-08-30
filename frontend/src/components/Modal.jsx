import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
const Modal = ({
  isOpen,
  onClose,
  children,
  closeOnBackdrop = true,
  closeOnEsc = true,
  contentClassName,
  closeXLeft = false,
}) => {
  const overlayRef = useRef(null);
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation?.();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isOpen, closeOnEsc, onClose]);
  if (!isOpen) return null;
  const handleBackdropPointerDown = (e) => {
    if (!closeOnBackdrop) return;
    if (e.target === overlayRef.current) onClose?.();
  };
  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md bg-black/10"
      role="dialog"
      aria-modal="true"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        className={contentClassName ?? "nice-scroll bg-white rounded-xl shadow-xl p-6 relative w-full max-w-lg"}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={`absolute top-3 ${closeXLeft ? 'left-3' : 'right-3'} rounded-md hover:bg-gray-200 transition-colors w-8 h-8 flex items-center justify-center cursor-pointer`}
           aria-label="Close"
        >
          <span className="text-gray-500 hover:text-black">✕</span>
        </button>
        {children}
      </div>
    </div>
  );
  return createPortal(modal, document.body);
};
export default Modal;
