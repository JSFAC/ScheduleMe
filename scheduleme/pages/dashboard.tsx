import BusinessNav from '../components/BusinessNav';
// pages/dashboard.tsx
import type { NextPage, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Nav from '../components/Nav';
import mockLeadsData from '../data/mockLeads.json';

interface Lead {
  leadId: string;
  name: string;
  phone: string;
  location: string;
  message: string;
  createdAt: string;
  triage: {
    service_category: string;
    urgency: 'low' | 'medium' | 'high' | 'emergency';
    estimated_cost_range: string;
    suggested_next_step: string;
    keywords: string[];
    confidence: number;
  };
  status: 'new' | 'contacted' | 'booked' | 'closed';
}

interface DashboardProps { leads: Lead[]; }

const URGENCY_STYLES: Record<Lead['triage']['urgency'], string> = {
  low: 'badge-low',
  medium: 'badge-normal',
  high: 'badge-urgent',
  emergency: 'badge-urgent',
};

const STATUS_STYLES: Record<Lead['status'], string> = {
  new: 'bg-blue-50 text-blue-700',
  contacted: 'bg-yellow-50 text-yellow-700',
  booked: 'bg-green-50 text-green-700',
  closed: 'bg-neutral-100 text-neutral-500',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatsBar({ leads }: { leads: Lead[] }) {
  const stats = [
    { label: 'Total Leads', value: leads.length },
    { label: 'New', value: leads.filter((l) => l.status === 'new').length },
    { label: 'Contacted', value: leads.filter((l) => l.status === 'contacted').length },
    { label: 'Booked', value: leads.filter((l) => l.status === 'booked').length },
    { label: 'Urgent / Emergency', value: leads.filter((l) => ['high','emergency'].includes(l.triage.urgency)).length },
  ];
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8" role="list">
      {stats.map(({ label, value }) => (
        <li key={label} className="card p-4 text-center">
          <p className="text-2xl font-bold text-neutral-900">{value}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
        </li>
      ))}
    </ul>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  return (
    <tr className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
      <td className="px-6 py-4">
        <p className="text-sm font-semibold text-neutral-900">{lead.name}</p>
        <a href={`tel:${lead.phone}`} className="text-xs text-accent hover:underline">{lead.phone}</a>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-medium text-neutral-800">{lead.triage.service_category}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{lead.location}</p>
      </td>
      <td className="px-6 py-4">
        <span className={`badge capitalize ${URGENCY_STYLES[lead.triage.urgency]}`}>{lead.triage.urgency}</span>
      </td>
      <td className="px-6 py-4 max-w-xs">
        <p className="text-xs text-neutral-500 line-clamp-2">{lead.message}</p>
      </td>
      <td className="px-6 py-4">
        <p className="text-sm font-medium text-neutral-700">{lead.triage.estimated_cost_range}</p>
      </td>
      <td className="px-6 py-4">
        <span className={`badge capitalize ${STATUS_STYLES[lead.status]}`}>{lead.status}</span>
      </td>
      <td className="px-6 py-4 text-xs text-neutral-400 whitespace-nowrap">{formatDate(lead.createdAt)}</td>
      <td className="px-6 py-4">
        <a href={`tel:${lead.phone}`} className="btn-secondary text-xs px-3 py-1.5" aria-label={`Call ${lead.name}`}>Call</a>
      </td>
    </tr>
  );
}

const Dashboard: NextPage<DashboardProps> = ({ leads }) => {
  const urgentLeads = leads.filter((l) => ['high', 'emergency'].includes(l.triage.urgency));
  return (
    <>
      <Head>
        <title>ScheduleMe — Business Dashboard</title>
        <meta name="description" content="View and manage incoming service leads." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <BusinessNav />

      <div className="min-h-screen bg-neutral-50 pt-16">
        <main className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Incoming Leads</h1>
              <p className="text-sm text-neutral-400 mt-1">AI-triaged leads sorted by most recent. Mock data.</p>
            </div>
            <Link href="/demo" className="btn-primary text-sm px-4 py-2">+ Simulate Lead</Link>
          </div>

          <StatsBar leads={leads} />

          {urgentLeads.length > 0 && (
            <div role="alert" className="mb-6 rounded-xl bg-red-50 border border-red-100 px-5 py-4 flex items-center gap-3">
              <span className="text-red-500 text-lg" aria-hidden="true">⚠️</span>
              <p className="text-sm text-red-700">
                <strong>{urgentLeads.length} urgent or emergency lead{urgentLeads.length > 1 ? 's' : ''}</strong> require{urgentLeads.length === 1 ? 's' : ''} immediate attention.
              </p>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]" aria-label="Leads table">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    {['Customer', 'Service', 'Urgency', 'Message', 'Est. Cost', 'Status', 'Time', 'Action'].map((col) => (
                      <th key={col} scope="col" className="px-6 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => <LeadRow key={lead.leadId} lead={lead} />)}
                </tbody>
              </table>
            </div>
            {leads.length === 0 && (
              <div className="py-16 text-center text-neutral-400">
                <p className="text-4xl mb-3" aria-hidden="true">📭</p>
                <p className="font-medium">No leads yet</p>
                <p className="text-sm mt-1">
                  Leads from <Link href="/demo" className="text-accent hover:underline">the intake form</Link> will appear here.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <p className="text-xs text-neutral-400">This dashboard uses mock data. Connect your DB for live leads.</p>
            <Link href="/business#pricing" className="text-xs text-accent hover:underline">Upgrade your plan →</Link>
          </div>
        </main>
      </div>
    </>
  );
};

export const getStaticProps: GetStaticProps<DashboardProps> = async () => {
  const leads = mockLeadsData as Lead[];
  return { props: { leads: [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) } };
};

export default Dashboard;
