import { useSearchParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { date: '01/01', views: 120, clicks: 80 },
  { date: '01/02', views: 150, clicks: 100 },
  { date: '01/03', views: 180, clicks: 120 },
  { date: '01/04', views: 200, clicks: 150 },
  { date: '01/05', views: 170, clicks: 110 },
];

export function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const isRegression = searchParams.get('regression') === 'true';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>

      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Traffic Overview</h2>
        <div className="chart" data-gate-tag="chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="views" stroke="#3b82f6" />
              <Line type="monotone" dataKey="clicks" stroke="#10b981" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
