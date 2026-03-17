// components/FeedbackModal.tsx — sincere early-stage feedback form
import { useState } from 'react';
import { useDm } from '../lib/DarkModeContext';

interface Props { onClose: () => void; }

const TOPICS = ['Bug / something broken', 'Design / UI issue', 'Missing feature', 'Confusing flow', 'General feedback'];

export default function FeedbackModal({ onClose }: Props) {
  const { dm } = useDm();
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, message, email }),
      });
      setDone(true);
    } catch { setDone(true); }
    finally { setSubmitting(false); }
  }

  const bg = dm ? '#171717' : 'white';
  const border = dm ? '#262626' : '#f0f0f0';
  const text1 = dm ? '#f3f4f6' : '#171717';
  const text2 = dm ? '#9ca3af' : '#6b7280';
  const inputBg = dm ? '#0d0d0d' : '#f9fafb';
  const inputBorder = dm ? '#262626' : '#e5e7eb';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-3xl shadow-2xl animate-fade-up"
        style={{ background: bg, border: `1px solid ${border}` }}>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(10,132,255,0.12)' }}>
              <svg className="h-7 w-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-lg font-black mb-2" style={{ color: text1, letterSpacing: '-0.02em' }}>Thank you — seriously.</p>
            <p className="text-sm leading-relaxed mb-6" style={{ color: text2 }}>
              We read every single piece of feedback. It directly shapes what we build next.
            </p>
            <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-bold"
              style={{ background: '#0A84FF', color: 'white' }}>
              Close
            </button>
          </div>
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-accent mb-1">We want to hear from you</p>
                <p className="text-lg font-black" style={{ color: text1, letterSpacing: '-0.02em' }}>Share your feedback</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: text2 }}>
                  ScheduleMe is early. Your feedback directly shapes what we build.
                </p>
              </div>
              <button onClick={onClose} className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 ml-3"
                style={{ background: dm ? '#262626' : '#f5f5f5', color: text2 }}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Topic pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TOPICS.map(t => (
                <button key={t} onClick={() => setTopic(t === topic ? '' : t)}
                  className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
                  style={{
                    background: topic === t ? '#0A84FF' : (dm ? '#1a1a1a' : '#f5f5f5'),
                    color: topic === t ? 'white' : text2,
                    borderColor: topic === t ? '#0A84FF' : inputBorder,
                  }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Message */}
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind — be as specific as you want. We actually read these."
              rows={4}
              maxLength={1000}
              className="w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent mb-3"
              style={{ background: inputBg, borderColor: inputBorder, color: text1 }}
            />

            {/* Optional email */}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your email (optional — if you want a reply)"
              className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-accent mb-4"
              style={{ background: inputBg, borderColor: inputBorder, color: text1 }}
            />

            <button onClick={submit} disabled={!message.trim() || submitting}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: message.trim() ? '#0A84FF' : (dm ? '#262626' : '#e5e7eb'), color: message.trim() ? 'white' : text2 }}>
              {submitting ? 'Sending…' : 'Send Feedback'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
