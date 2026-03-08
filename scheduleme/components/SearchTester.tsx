// components/SearchTester.tsx
import { useState } from 'react';
import type { BusinessResult } from '../pages/api/search';

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

const SERVICE_OPTIONS = [
  '', 'plumbing', 'hvac', 'electrical', 'cleaning',
  'landscaping', 'automotive', 'pest_control', 'salon',
];

export default function SearchTester() {
  const [lat, setLat]           = useState('30.2672');
  const [lng, setLng]           = useState('-97.7431');
  const [service, setService]   = useState('');
  const [term, setTerm]         = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [radius, setRadius]     = useState('25');
  const [results, setResults]   = useState<BusinessResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          service: service || undefined,
          term: term || undefined,
          price_max: priceMax ? parseInt(priceMax) : undefined,
          radius: parseFloat(radius),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Search failed');
      setResults(json.data ?? []);
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">
        Geo Search Tester
      </h1>

      {/* Controls */}
      <div className="card p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Latitude</label>
            <input
              type="number" step="any"
              value={lat} onChange={e => setLat(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Longitude</label>
            <input
              type="number" step="any"
              value={lng} onChange={e => setLng(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Radius (miles)</label>
            <input
              type="number" min="1" max="100"
              value={radius} onChange={e => setRadius(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Service</label>
            <select
              value={service} onChange={e => setService(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
            >
              {SERVICE_OPTIONS.map(s => (
                <option key={s} value={s}>{s || 'Any service'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Search term</label>
            <input
              type="text" placeholder="e.g. emergency plumber"
              value={term} onChange={e => setTerm(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Max price tier</label>
            <select
              value={priceMax} onChange={e => setPriceMax(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
            >
              <option value="">Any</option>
              <option value="1">$ only</option>
              <option value="2">$$ or less</option>
              <option value="3">$$$ or less</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSearch} disabled={loading} className="btn-primary px-8 py-2.5 disabled:opacity-50">
            {loading ? 'Searching…' : 'Search'}
          </button>
          <button onClick={useMyLocation} className="text-sm text-accent hover:underline">
            Use my location
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <p className="text-sm text-neutral-500 mb-4">
          {results.length === 0
            ? 'No businesses found. Try increasing the radius or changing the filters.'
            : `${results.length} business${results.length !== 1 ? 'es' : ''} found`}
        </p>
      )}

      <div className="space-y-3">
        {results.map((b) => (
          <div key={b.id} className="card p-5 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-neutral-900 truncate">{b.name}</h3>
                {b.price_tier && (
                  <span className="text-xs text-neutral-400 font-medium">{PRICE_LABELS[b.price_tier]}</span>
                )}
                {b.rating != null && (
                  <span className="text-xs text-amber-500 font-semibold">★ {b.rating}</span>
                )}
              </div>
              {b.address && (
                <p className="text-sm text-neutral-500 mb-1">{b.address}</p>
              )}
              {b.description && (
                <p className="text-sm text-neutral-600 line-clamp-2">{b.description}</p>
              )}
              {b.service_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {b.service_tags.map(tag => (
                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent/8 text-accent text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-lg font-bold text-accent">{b.distance_miles} mi</p>
              {b.calendly_url && (
                <a
                  href={b.calendly_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs btn-primary px-3 py-1.5"
                >
                  Book
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
