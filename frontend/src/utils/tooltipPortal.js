import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

const TooltipPortal = ({ children }) => {
  const [tooltipContainer, setTooltipContainer] = useState(null);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '99999';
    document.body.appendChild(el);
    setTooltipContainer(el);

    return () => {
      document.body.removeChild(el);
    };
  }, []);

  if (!tooltipContainer) return null;
  return createPortal(children, tooltipContainer);
};

export default TooltipPortal;
