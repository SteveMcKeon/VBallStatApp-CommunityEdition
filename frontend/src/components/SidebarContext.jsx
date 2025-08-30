import { createContext, useContext, useRef } from 'react';
const SidebarContext = createContext({
  registerToggle: () => { },
  toggleSidebar: () => { },
});
export const SidebarProvider = ({ children }) => {
  const toggleRef = useRef(null);
  const registerToggle = (fn) => {
    toggleRef.current = fn;
  };
  const toggleSidebar = () => {
    if (toggleRef.current) toggleRef.current();
  };
  return (
    <SidebarContext.Provider value={{ registerToggle, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};
export const useSidebar = () => useContext(SidebarContext);
