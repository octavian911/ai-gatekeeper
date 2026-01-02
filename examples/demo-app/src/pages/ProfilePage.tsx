import { useSearchParams } from 'react-router-dom';
import { User, Mail, MapPin, Calendar } from 'lucide-react';

export function ProfilePage() {
  const [searchParams] = useSearchParams();
  const isRegression = searchParams.get('regression') === 'true';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Profile</h1>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl text-primary-foreground">
            {isRegression ? '?' : 'JD'}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{isRegression ? 'CHANGED NAME' : 'John Doe'}</h2>
            <p className="text-muted-foreground">Software Engineer</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value="john@example.com" />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value="San Francisco, CA" />
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="Joined" value="January 2024" />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}
