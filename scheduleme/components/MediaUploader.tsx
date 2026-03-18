// components/MediaUploader.tsx — drag-drop image + video uploader for business dashboard
import { useState, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

interface Props {
  businessId: string;
  currentImages: string[];
  currentVideo?: string | null;
  onUpdate: (images: string[], video: string | null) => void;
  dm?: boolean;
}

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function MediaUploader({ businessId, currentImages, currentVideo, onUpdate, dm }: Props) {
  const [images, setImages] = useState<string[]>(currentImages);
  const [video, setVideo] = useState<string | null>(currentVideo || null);
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const imgInputRef = useRef<HTMLInputElement>(null);
  const vidInputRef = useRef<HTMLInputElement>(null);

  const bg = dm ? '#171717' : 'white';
  const border = dm ? '#262626' : '#e5e7eb';
  const text2 = dm ? '#9ca3af' : '#6b7280';

  async function uploadFile(file: File, type: 'image' | 'video') {
    setError('');
    setUploading(type);
    setProgress(0);

    const supabase = getSupabase();
    // Refresh session to ensure token is not expired
    const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
    const activeSession = session || (await supabase.auth.getSession()).data.session;
    if (!activeSession) { setError('Session expired — please refresh the page and try again.'); setUploading(null); return; }

    // Convert file to base64
    const fileData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const interval = setInterval(() => setProgress(p => Math.min(p + 8, 85)), 200);

    try {
      const res = await fetch('/api/upload-media', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeSession.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_id: businessId,
          media_type: type,
          file_data: fileData,
          file_type: file.type,
          file_name: file.name,
        }),
      });
      clearInterval(interval);
      setProgress(100);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed'); return; }

      if (type === 'image') {
        const newImages = [...images.filter(u => u !== data.url), data.url].slice(0, 6);
        setImages(newImages);
        onUpdate(newImages, video);
      } else {
        setVideo(data.url);
        onUpdate(images, data.url);
      }
    } catch { setError('Upload failed. Please try again.'); clearInterval(interval); }
    finally { setUploading(null); setTimeout(() => setProgress(0), 600); }
  }

  async function deleteMedia(url: string, type: 'image' | 'video') {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.refreshSession();
    const activeSession = session || (await supabase.auth.getSession()).data.session;
    if (!activeSession) return;

    const res = await fetch('/api/delete-media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeSession.access_token}` },
      body: JSON.stringify({ business_id: businessId, url, media_type: type }),
    });
    if (!res.ok) return;

    if (type === 'image') {
      const newImages = images.filter(u => u !== url);
      setImages(newImages);
      onUpdate(newImages, video);
    } else {
      setVideo(null);
      onUpdate(images, null);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('video/')) uploadFile(file, 'video');
    else if (file.type.startsWith('image/')) uploadFile(file, 'image');
    else setError('Only images (JPG, PNG, WebP) and videos (MP4, MOV) are supported');
  }, [images, video]);

  return (
    <div className="space-y-5">
      {/* Photos section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#171717' }}>Photos</p>
            <p className="text-xs" style={{ color: text2 }}>First photo is your cover. Up to 6 photos.</p>
          </div>
          <button onClick={() => imgInputRef.current?.click()}
            disabled={uploading === 'image' || images.length >= 6}
            className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
            style={{ background: 'rgba(10,132,255,0.1)', color: '#0A84FF' }}>
            + Add Photo
          </button>
        </div>

        {/* Drop zone + image grid */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className="rounded-2xl border-2 border-dashed transition-all p-3 min-h-[120px]"
          style={{ borderColor: dragOver ? '#0A84FF' : border, background: dragOver ? 'rgba(10,132,255,0.05)' : 'transparent' }}>

          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg className="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: text2 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-sm font-medium" style={{ color: text2 }}>Drag photos here or click Add Photo</p>
              <p className="text-xs mt-1" style={{ color: dm ? '#6b7280' : '#a3a3a3' }}>JPG, PNG, WebP up to 8MB</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, i) => (
                <div key={url} className="relative group rounded-xl overflow-hidden" style={{ aspectRatio: '1' }}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && (
                    <div className="absolute top-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-md"
                      style={{ background: '#0A84FF', color: 'white' }}>Cover</div>
                  )}
                  <button onClick={() => deleteMedia(url, 'image')}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <button onClick={() => imgInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed flex items-center justify-center transition-colors"
                  style={{ aspectRatio: '1', borderColor: border }}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: text2 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploading === 'image' && progress > 0 && (
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: border }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: '#0A84FF' }} />
          </div>
        )}
      </div>

      {/* Video section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold" style={{ color: dm ? '#f3f4f6' : '#171717' }}>Promo Video</p>
            <p className="text-xs" style={{ color: text2 }}>Optional. Plays in your business profile. MP4 or MOV up to 100MB.</p>
          </div>
          {!video && (
            <button onClick={() => vidInputRef.current?.click()}
              disabled={uploading === 'video'}
              className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-40"
              style={{ background: 'rgba(10,132,255,0.1)', color: '#0A84FF' }}>
              + Add Video
            </button>
          )}
        </div>

        {video ? (
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', background: '#0a0a0a' }}>
            <video src={video} controls className="w-full h-full object-contain" />
            <button onClick={() => deleteMedia(video, 'video')}
              className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.7)' }}>
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button onClick={() => vidInputRef.current?.click()} disabled={uploading === 'video'}
            onDrop={onDrop} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            className="w-full rounded-2xl border-2 border-dashed py-8 flex flex-col items-center gap-2 transition-all disabled:opacity-50"
            style={{ borderColor: dragOver ? '#0A84FF' : border }}>
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: text2 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            {uploading === 'video' ? (
              <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: border }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: '#0A84FF' }} />
              </div>
            ) : (
              <p className="text-sm" style={{ color: text2 }}>Drag video here or click Add Video</p>
            )}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      {/* Hidden file inputs */}
      <input ref={imgInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'image'); e.target.value = ''; }} />
      <input ref={vidInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'video'); e.target.value = ''; }} />
    </div>
  );
}
