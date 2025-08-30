import { Routes, Route } from 'react-router-dom';
import MainPage from './components/Routes/MainPage';
import NotFound from './components/Routes/NotFound';
import TeamGameView from './components/Routes/TeamGameView';
import StatsSummary from './components/Routes/StatsSummary';
const AppRoutes = () => {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<MainPage />}>
          <Route index element={ <TeamGameView /> } />
          <Route path="stats/team" element={<StatsSummary scope="team" />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
};
export default AppRoutes;
