import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Home } from './pages/Home';
import { Watch } from './pages/Watch';
import { Stats } from './pages/Stats';
import { Channel } from './pages/Channel';
import { History } from './pages/History';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';

export function AppRoutes() {
  return (
    <Routes>
      {/* Login is full screen, outside the app shell. */}
      <Route path="/login" element={<Login />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/watch/:videoId" element={<Watch />} />
        <Route path="/channel/:channelKey" element={<Channel />} />
        <Route path="/history" element={<History />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
