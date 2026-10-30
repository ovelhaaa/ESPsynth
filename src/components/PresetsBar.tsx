import React, { useState, useEffect } from 'react';
import { Play, Square, Music, Sparkles, Plus, Trash2, Download, Upload, Bookmark } from 'lucide-react';
import { VoiceConfig } from './VoicePanel';
import { MasterConfig } from './MasterPanel';

export interface PresetDef {
  id: string;
  name: string;
  description: string;
  exampleRef: string;
  category?: 'official' | 'user';
  voiceConfig?: Partial<VoiceConfig>;
  masterConfig?: Partial<MasterConfig>;
}

export const OFFICIAL_PRESETS: PresetDef[] = [
  {
    id: 'poly_chords',
    name: '01: Polyphonic Chords',
    description: '4-Voice warm Saw pad (Cm7 - Abmaj7 - Bb - Gm7)',
    exampleRef: 'First Steps/01_PolyphonicChords.ino',
    category: 'official',
  },
  {
    id: 'arp_bass',
    name: '02: Arp & Sub-Bass',
    description: 'Zero-Branch PolyBLEP AA_Saw 16th-note arpeggiator + Deep Sub-Bass',
    exampleRef: 'First Steps/02_ArpAndBassline.ino',
    category: 'official',
  },
  {
    id: 'moog_lead',
    name: '03: Moog Lead & Modular FX',
    description: 'Dual detuned AA_Saw lead routed to Bus 1 Resonant Biquad Filter',
    exampleRef: 'First Steps/03_MoogLead_ModularFX.ino',
    category: 'official',
  },
  {
    id: 'hammond_leslie',
    name: '04: Hammond B3 & Leslie DSP',
    description: 'Vintage 9-drawbar tonewheel organ through rotary cabinet modulation',
    exampleRef: 'ESP32Synth_Patches.hpp (HammondB3 + DSP_HammondLeslie)',
    category: 'official',
  },
  {
    id: 'eks_guitar',
    name: '05: Karplus-Strong Guitar',
    description: 'Physical modeling plucked string with Global Pedalboard Overdrive',
    exampleRef: 'ESP32Synth_Patches.hpp (EKS_Guitar + DSP_Pedalboard)',
    category: 'official',
  },
  {
    id: 'fm_synth',
    name: '06: PolyBLEP 2-Op FM',
    description: '2-Operator FM synthesis engine with carrier/modulator ratio',
    exampleRef: 'ESP32Synth_Patches.hpp (FM_Custom)',
    category: 'official',
  },
  {
    id: 'chiptune',
    name: '07: 8-Bit Chiptune',
    description: 'PWM Pulse wave (12.5% duty) + Noise snare + 6-bit Bitcrush',
    exampleRef: 'Demos/Tricks & Bitcrush',
    category: 'official',
  },
];

interface PresetsBarProps {
  currentPresetId: string;
  isPlayingDemo: boolean;
  currentVoiceConfig: VoiceConfig;
  currentMasterConfig: MasterConfig;
  onSelectPreset: (preset: PresetDef) => void;
  onToggleDemo: () => void;
}

const STORAGE_KEY = 'esp32synth_user_presets_v1';

export const PresetsBar: React.FC<PresetsBarProps> = ({
  currentPresetId,
  isPlayingDemo,
  currentVoiceConfig,
  currentMasterConfig,
  onSelectPreset,
  onToggleDemo,
}) => {
  const [userPresets, setUserPresets] = useState<PresetDef[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'official' | 'user'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');

  // Load user presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setUserPresets(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load user presets from localStorage', e);
    }
  }, []);

  const saveUserPresets = (presets: PresetDef[]) => {
    setUserPresets(presets);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  const handleCreateUserPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const newPreset: PresetDef = {
      id: `user_${Date.now()}`,
      name: newPresetName.trim(),
      description: newPresetDesc.trim() || 'Custom user timbre',
      exampleRef: 'User Timbre Library',
      category: 'user',
      voiceConfig: { ...currentVoiceConfig },
      masterConfig: { ...currentMasterConfig },
    };

    const updated = [newPreset, ...userPresets];
    saveUserPresets(updated);
    setIsSaving(false);
    setNewPresetName('');
    setNewPresetDesc('');
    onSelectPreset(newPreset);
  };

  const handleDeleteUserPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = userPresets.filter((p) => p.id !== id);
    saveUserPresets(updated);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(userPresets, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', 'esp32synth_user_presets.json');
    dlAnchorElem.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          const merged = [...parsed, ...userPresets];
          saveUserPresets(merged);
        }
      } catch (err) {
        alert('Invalid JSON file format for presets.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const allPresets = [...OFFICIAL_PRESETS, ...userPresets];
  const displayedPresets = allPresets.filter((p) => {
    if (activeTab === 'official') return p.category === 'official';
    if (activeTab === 'user') return p.category === 'user';
    return true;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl">
      {/* Header, Categories and Top Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            Timbre Library & Preset Manager
          </h2>

          {/* Filter Tabs */}
          <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800 text-[11px] font-mono ml-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2 py-0.5 rounded cursor-pointer transition ${
                activeTab === 'all' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({allPresets.length})
            </button>
            <button
              onClick={() => setActiveTab('official')}
              className={`px-2 py-0.5 rounded cursor-pointer transition ${
                activeTab === 'official' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Official C++ ({OFFICIAL_PRESETS.length})
            </button>
            <button
              onClick={() => setActiveTab('user')}
              className={`px-2 py-0.5 rounded cursor-pointer transition ${
                activeTab === 'user' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              User Timbres ({userPresets.length})
            </button>
          </div>
        </div>

        {/* User Presets Action Buttons & Demo Player */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSaving(!isSaving)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono flex items-center gap-1 transition cursor-pointer"
            title="Save current sound design as a preset"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Save Timbre</span>
          </button>

          {userPresets.length > 0 && (
            <button
              onClick={handleExportJSON}
              className="p-1 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded transition cursor-pointer"
              title="Download user presets as JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <label
            className="p-1 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded transition cursor-pointer flex items-center"
            title="Import user presets JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            onClick={onToggleDemo}
            className={`px-3 py-1 rounded text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow ${
              isPlayingDemo
                ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isPlayingDemo ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Demo</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Preset Demo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Current Sound Dialog Form */}
      {isSaving && (
        <form
          onSubmit={handleCreateUserPreset}
          className="bg-slate-950 border border-emerald-500/50 rounded-lg p-3 flex flex-wrap items-center gap-2 animate-in fade-in"
        >
          <Bookmark className="w-4 h-4 text-emerald-400 shrink-0" />
          <input
            type="text"
            required
            placeholder="Timbre Name (e.g. Acid 303 Bass)"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 flex-1 min-w-[160px]"
          />
          <input
            type="text"
            placeholder="Short Description (e.g. Resonant pluck with fast decay)"
            value={newPresetDesc}
            onChange={(e) => setNewPresetDesc(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500 flex-2 min-w-[200px]"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded cursor-pointer transition shadow"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsSaving(false)}
            className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs font-mono cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
        {displayedPresets.map((preset) => {
          const isSelected = preset.id === currentPresetId;
          const isUser = preset.category === 'user';
          return (
            <div
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`p-2.5 rounded-lg text-left transition-all border cursor-pointer flex flex-col justify-between gap-1.5 group relative ${
                isSelected
                  ? 'bg-emerald-950/70 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-xs font-mono font-bold truncate ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>
                  {preset.name}
                </span>
                <div className="flex items-center gap-1">
                  {isSelected && <Music className="w-3 h-3 text-emerald-400 shrink-0" />}
                  {isUser && (
                    <button
                      onClick={(e) => handleDeleteUserPreset(preset.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition cursor-pointer"
                      title="Delete custom timbre"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] leading-tight text-slate-400 line-clamp-2">
                {preset.description}
              </p>
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-0.5">
                <span className="truncate">{preset.exampleRef}</span>
                {isUser && <span className="text-emerald-400/80 font-semibold">[User]</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
