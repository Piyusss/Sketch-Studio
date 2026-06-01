import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';

export function UserMenu({ size = 30 }: { size?: number }) {
  const { user, signOut } = useAuthStore();
  const reset = useWorkspaceStore((s) => s.reset);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleSignOut() {
    signOut();
    reset();
    navigate('/');
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={user.name}
        style={{
          width: size, height: size, borderRadius: '50%',
          padding: 0, border: '2px solid #E4E4E7',
          overflow: 'hidden', cursor: 'pointer',
          background: '#6366F1', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {user.picture ? (
          <img src={user.picture} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: size * 0.38, fontWeight: 600, color: '#fff', userSelect: 'none' }}>{initials}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: size + 8, right: 0,
          background: '#fff', border: '1px solid #E4E4E7',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          minWidth: 200, zIndex: 500,
          fontFamily: 'Inter, system-ui, sans-serif',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #F4F4F5' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{user.name}</div>
            <div style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>{user.email}</div>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: '100%', padding: '10px 14px', border: 'none',
              background: 'transparent', cursor: 'pointer',
              textAlign: 'left', fontSize: 13, color: '#EF4444',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
