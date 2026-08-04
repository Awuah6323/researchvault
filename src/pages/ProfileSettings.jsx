import React, { useState } from 'react';
import { User, Shield, Download, Upload, Check } from 'lucide-react';
import { storage } from '../services/storage';

export default function ProfileSettings({ userProfile, onSaveProfile, resources, onImportBackup, onLogout }) {
  const [name, setName] = useState(userProfile?.name || '');
  const [institution, setInstitution] = useState(userProfile?.institution || '');
  const [fieldOfStudy, setFieldOfStudy] = useState(userProfile?.fieldOfStudy || '');
  const [interests, setInterests] = useState(userProfile?.researchInterests || '');
  const [savedMsg, setSavedMsg] = useState('');
  const [importStatus, setImportStatus] = useState('');

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
            setTimeout(() => setImportStatus(''), 4000);
          }
        } else {
          alert('Invalid backup file format. Expected a JSON list of research papers.');
        }
      } catch (err) {
        alert('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
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
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Academic Institution / University</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Field of Study</label>
            <input
              type="text"
              value={fieldOfStudy}
              onChange={(e) => setFieldOfStudy(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Research Interests</label>
            <textarea
              rows={2}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />
          </div>

          {savedMsg && (
            <div style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={16} /> {savedMsg}
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

      {/* Data Export & Backup Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>Library Data Backup & Export</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Export your complete paper catalog, notes, and citations as a JSON file, or restore a backup.</p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleExportBackup} className="btn-secondary">
            <Download size={18} />
            <span>Export Library JSON</span>
          </button>

          <label className="btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} />
            <span>Restore Backup JSON</span>
            <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
        </div>

        {importStatus && (
          <div style={{ marginTop: '12px', color: 'var(--secondary)', fontWeight: 700, fontSize: '0.85rem' }}>
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
}

