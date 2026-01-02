import { Outlet, Link, useLocation } from 'react-router-dom';
import { Clock } from './Clock';

export function Layout() {
  const location = useLocation();
  const regressionCase = import.meta.env.VITE_REGRESSION_CASE || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold text-gray-900">
                AI Output Gate Demo
                {regressionCase && (
                  <span className="ml-2 text-xs text-red-600 font-normal">
                    (Regression: {regressionCase})
                  </span>
                )}
              </h1>
            </div>
            <Clock />
          </div>
        </div>
      </nav>

      <div className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 py-3 overflow-x-auto">
            {Array.from({ length: 20 }, (_, i) => {
              const screenNum = i + 1;
              const path = `/screen-${String(screenNum).padStart(2, '0')}`;
              const isActive = location.pathname === path || (location.pathname === '/' && screenNum === 1);
              
              return (
                <Link
                  key={screenNum}
                  to={path}
                  data-testid={`nav-screen-${String(screenNum).padStart(2, '0')}`}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Screen {String(screenNum).padStart(2, '0')}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
