import { useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
  { name: 'Apr', value: 800 },
  { name: 'May', value: 500 },
];

export function DashboardPage() {
  const [searchParams] = useSearchParams();
  const isRegression = searchParams.get('regression') === 'true';

  const chartData = isRegression 
    ? data.map(d => ({ ...d, value: d.value + Math.random() * 200 }))
    : data;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <StatCard title="Total Users" value="1,234" change="+12%" regression={isRegression} />
        <StatCard title="Revenue" value="$45.2K" change="+8%" regression={isRegression} />
        <StatCard title="Active Sessions" value="89" change="-3%" regression={isRegression} />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Monthly Overview</h2>
        <div className="chart" data-gate-tag="chart">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, regression }: { title: string; value: string; change: string; regression: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-bold">{regression ? '???' : value}</p>
      <p className="mt-1 text-sm text-green-600">{change}</p>
    </div>
  );
}
