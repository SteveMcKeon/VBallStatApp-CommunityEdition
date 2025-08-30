import { BrowserRouter as Router } from 'react-router-dom';
import { SidebarProvider } from './components/SidebarContext';
import AppRoutes from './AppRoutes';
const App = () => (
  <Router>
    <SidebarProvider>
      <AppRoutes />
    </SidebarProvider>
  </Router>
);
export default App;