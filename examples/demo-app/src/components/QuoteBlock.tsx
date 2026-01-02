import { useState, useEffect } from 'react';

const quotes = [
  "The only way to do great work is to love what you do. - Steve Jobs",
  "Innovation distinguishes between a leader and a follower. - Steve Jobs",
  "Stay hungry, stay foolish. - Steve Jobs",
  "Design is not just what it looks like and feels like. Design is how it works. - Steve Jobs",
  "Your time is limited, don't waste it living someone else's life. - Steve Jobs",
];

export function QuoteBlock() {
  const [quote, setQuote] = useState(quotes[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      data-testid="quote"
      className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded"
    >
      <p className="text-sm italic text-gray-700">{quote}</p>
    </div>
  );
}
