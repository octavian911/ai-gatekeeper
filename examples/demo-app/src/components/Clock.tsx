import { useState, useEffect } from 'react';

export function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div data-testid="clock" className="text-sm text-gray-600 font-mono">
      {time.toLocaleTimeString()}
    </div>
  );
}
