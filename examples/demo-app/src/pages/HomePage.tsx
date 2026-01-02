import { useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function HomePage() {
  const [searchParams] = useSearchParams();
  const isRegression = searchParams.get('regression') === 'true';

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to AI Output Gate
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Visual regression testing to prevent UI drift from AI-generated code
          {isRegression && ' (WITH INTENTIONAL CHANGES)'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <FeatureCard
          title="Deterministic"
          description="Fixed viewport, disabled animations, blocked external resources"
          regression={isRegression}
        />
        <FeatureCard
          title="Strict Thresholds"
          description="0.1% pixel diff threshold with tag-based overrides"
          regression={isRegression}
        />
        <FeatureCard
          title="Evidence Pack"
          description="Screenshots, diffs, hashes, and HTML reports in one zip"
          regression={isRegression}
        />
      </div>

      <div className="text-center">
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90">
          Get Started
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, regression }: { title: string; description: string; regression: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {regression ? description.toUpperCase() : description}
      </p>
    </div>
  );
}
