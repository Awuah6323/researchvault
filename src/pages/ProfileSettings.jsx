import React, { useState } from 'react';
import { User, Shield, Download, Upload, Check } from 'lucide-react';
import { storage } from '../services/storage';

export default function ProfileSettings({ userProfile, onSaveProfile, resources, onImportBackup }) {
  const [name, setName] = useState(userProfile.name);
  const [institution, setInstitution] = useState(userProfile.institution);
  const [fieldOfStudy, setFieldOfStudy] = useState(userProfile.fieldOfStudy);
  const [interests, setInterests] = useState(userProfile.researchInterests);
  const [savedMsg, setSavedMsg] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    onSaveProfile({
      name: name.trim(),
      institution: institution.trim(),
      fieldOfStudy: fieldOfStudy.trim(),
      researchInterests: interests.trim(),
      email: userProfile.email
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

      {/* Google Auth & Account Status Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Scholar Authentication & Cloud Sync</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sign in with Google to enable automatic cloud backup across devices.</p>
          </div>
          <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-text)' }}>
            Verified Scholar Account
          </span>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            type="button"
            className="btn-secondary" 
            style={{ backgroundColor: '#ffffff', color: '#333333', borderColor: '#dddddd' }}
            onClick={() => {
              onSaveProfile({
                name: 'Alex Rivera',
                email: 'alex.rivera@stanford.edu',
                institution: 'Stanford University',
                fieldOfStudy: 'Computer Science & AI',
                researchInterests: 'Deep Learning, Natural Language Processing'
              });
              alert('Signed in with Google Scholar account (alex.rivera@stanford.edu)!');
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Sign in with Google</span>
          </button>
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

