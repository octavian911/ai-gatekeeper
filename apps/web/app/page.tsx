import Link from 'next/link';
import { PlayCircle, Image } from 'lucide-react';

export default function Home() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">AI Output Gate</h1>
        <p className="text-lg text-gray-600 mb-8">
          Visual regression testing and AI output validation platform
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/runs"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <PlayCircle className="text-blue-600" size={32} />
              <h2 className="text-xl font-semibold">Gate Runs</h2>
            </div>
            <p className="text-gray-600">
              View all gate runs with status, timestamps, and pass/fail counts
            </p>
          </Link>
          
          <Link
            href="/baselines"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <Image className="text-green-600" size={32} />
              <h2 className="text-xl font-semibold">Baselines</h2>
            </div>
            <p className="text-gray-600">
              Browse baseline screenshots and configurations
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
