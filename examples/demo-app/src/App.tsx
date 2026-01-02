import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ScreenPage } from './pages/ScreenPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {Array.from({ length: 20 }, (_, i) => (
            <Route
              key={i + 1}
              path={`screen-${String(i + 1).padStart(2, '0')}`}
              element={<ScreenPage screenNumber={i + 1} />}
            />
          ))}
          <Route index element={<ScreenPage screenNumber={1} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
