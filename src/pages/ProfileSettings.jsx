import React, { useState } from 'react';
import { User, Shield, Download, Upload, Check } from 'lucide-react';
import { storage } from '../services/storage';
import { useToast, useAnnounce } from '../components/FeedbackProvider';

export default function ProfileSettings({ userProfile, onSaveProfile, resources, onImportBackup, onLogout, onOpenInstallPwa, isStandalone }) {
  const [name, setName] = useState(userProfile?.name || '');
  const [institution, setInstitution] = useState(userProfile?.institution || '');
  const [fieldOfStudy, setFieldOfStudy] = useState(userProfile?.fieldOfStudy || '');
  const [interests, setInterests] = useState(userProfile?.researchInterests || '');
  const [savedMsg, setSavedMsg] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const notify = useToast();
  const announce = useAnnounce();

  const handleSave = (e) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim(),
      institution: institution.trim(),
      fieldOfStudy: fieldOfStudy.trim(),
      researchInterests: interests.trim(),
      email: userProfile?.email || 'user@researchvault.app',
      isAuthenticated: true
    });
    setSavedMsg('Profile updated successfully!');
    announce('Profile updated successfully.');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleExportBackup = () => {
    const jsonStr = JSON.stringify(resources, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ResearchVault_Library_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          if (onImportBackup) {
            onImportBackup(parsed);
            setImportStatus(`Successfully restored ${parsed.length} papers!`);
            announce(`Successfully restored ${parsed.length} papers from backup.`);
            setTimeout(() => setImportStatus(''), 4000);
          }
        } else {
          // Was a window.alert(): blocking, unstyled, and unreliable in an
          // installed iOS PWA.
          notify({
            message: 'That file isn’t a ResearchVault backup. Expected a JSON file containing a list of papers.',
            tone: 'error'
          });
        }
      } catch (err) {
        notify({
          message: 'Could not read that backup file — the JSON appears to be corrupted.',
          tone: 'error'
        });
      }
    };
    reader.onerror = () => {
      notify({ message: 'Could not read that file from disk. Please try again.', tone: 'error' });
    };
    reader.readAsText(file);
    // Allow re-selecting the same file after a failed import.
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800 }}>Profile & Preferences</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Manage academic profile credentials, cloud sync, and local data persistence.</p>
      </div>

      {/* Account Status Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Active Scholar Session</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Logged in as {userProfile?.email || 'Scholar'}</p>
          </div>
          <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-text)' }}>
            Authenticated Session
          </span>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          {onLogout && (
            <button 
              type="button"
              className="btn-secondary" 
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              onClick={onLogout}
            >
              Log Out Account
            </button>
          )}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Academic Profile</h3>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label htmlFor="profile-name" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Full Name</label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />
          </div>

          <div>
            <label htmlFor="profile-institution" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Academic Institution / University</label>
            <input
              id="profile-institution"
              type="text"
              autoComplete="organization"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />
          </div>

          <div>
            <label htmlFor="profile-field-of-study" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Field of Study</label>
            <input
              id="profile-field-of-study"
              type="text"
              value={fieldOfStudy}
              onChange={(e) => setFieldOfStudy(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />
          </div>

          <div>
            <label htmlFor="profile-interests" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Research Interests</label>
            <textarea
              id="profile-interests"
              rows={2}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />
          </div>

          {savedMsg && (
            <div role="status" style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} aria-hidden="true" /> {savedMsg}
            </div>
          )}

          <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
            Save Changes
          </button>
        </form>
      </div>

      {/* Real-time Cloud Vault Synchronization Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Cross-Device Cloud Vault Sync</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Automatically syncs papers, notes, reading progress, and folders across PC and phone.</p>
          </div>
          <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            Active Cloud Sync
          </span>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn-primary"
            onClick={async () => {
              const success = await storage.pullCloudVault();
              setSavedMsg(success ? 'Cloud library updated from server!' : 'Synced local data with Cloud Vault!');
              setTimeout(() => setSavedMsg(''), 4000);
            }}
          >
            <span>Sync Account Vault Now</span>
          </button>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Last Synced: <strong>{storage.getLastSyncTime()}</strong>
          </div>
        </div>
      </div>

      {/* PWA App Installation Card */}
      {!isStandalone && onOpenInstallPwa && (
        <div className="glass-card-accent" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Install Mobile & Desktop App</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Install ResearchVault on your phone, tablet, or PC for fast offline reading and home screen access.
            </p>
          </div>
          <button
            onClick={onOpenInstallPwa}
            style={{
              padding: '10px 20px',
              borderRadius: '14px',
              background: 'var(--gradient-glow)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
            }}
          >
            <Download size={18} style={{ strokeWidth: 2.5 }} />
            <span>Install App</span>
          </button>
        </div>
      )}

      {/* Data Export & Backup Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Library Data Backup & Export</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Export your complete paper catalog, notes, and citations as a JSON file, or restore a backup.</p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={handleExportBackup} className="btn-secondary">
            <Download size={18} aria-hidden="true" />
            <span>Export Library JSON</span>
          </button>

          <label htmlFor="restore-backup-file" className="btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} aria-hidden="true" />
            <span>Restore Backup JSON</span>
            {/* .sr-only, not display:none — a display:none input is removed from
                the tab order, so this was unreachable by keyboard. */}
            <input id="restore-backup-file" type="file" accept=".json" onChange={handleImportFile} className="sr-only" />
          </label>
        </div>

        {importStatus && (
          <div role="status" style={{ marginTop: '12px', color: 'var(--secondary)', fontWeight: 700, fontSize: '0.85rem' }}>
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
}

