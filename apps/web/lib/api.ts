const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai-output-gate-d5c156k82vjumvf6738g.api.lp.dev';

export interface Run {
  id: number;
  pullRequest: number;
  commit: string;
  branch: string;
  status: "passed" | "failed" | "in_progress";
  timestamp: Date;
}

export interface Baseline {
  screenId: string;
  name: string;
  url: string;
  hash: string;
  tags?: string[];
}

export async function fetchRuns(): Promise<Run[]> {
  const res = await fetch(`${API_BASE_URL}/runs`, {
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch runs');
  }
  
  const data = await res.json();
  return data.runs.map((run: any) => ({
    ...run,
    timestamp: new Date(run.timestamp),
  }));
}

export async function fetchRun(id: number): Promise<Run> {
  const res = await fetch(`${API_BASE_URL}/runs/${id}`, {
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error('Failed to fetch run');
  }
  
  const data = await res.json();
  return {
    ...data,
    timestamp: new Date(data.timestamp),
  };
}

export async function fetchBaselines(): Promise<Baseline[]> {
  const res = await fetch('/baselines/manifest.json');
  
  if (!res.ok) {
    throw new Error('Failed to fetch baselines');
  }
  
  const data = await res.json();
  return data.baselines;
}
