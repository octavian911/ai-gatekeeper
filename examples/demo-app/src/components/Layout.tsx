import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, BarChart3, User, Settings } from 'lucide-react';

export function Layout() {
  const location = useLocation();
  const isRegression = new URLSearchParams(location.search).get('regression') === 'true';

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-xl font-bold">
                AI Output Gate Demo
                {isRegression && <span className="ml-2 text-xs text-destructive">(Regression Mode)</span>}
              </h1>
              <div className="flex gap-4">
                <NavLink to="/" icon={<Home className="h-4 w-4" />} label="Home" />
                <NavLink to="/dashboard" icon={<BarChart3 className="h-4 w-4" />} label="Dashboard" />
                <NavLink to="/profile" icon={<User className="h-4 w-4" />} label="Profile" />
                <NavLink to="/settings" icon={<Settings className="h-4 w-4" />} label="Settings" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}
