import React, { useState } from 'react';
import { useNormalizationData, TeamData } from '../hooks/useNormalizationData';
import { Trash2, Edit2, Plus, X, Check } from '../components/icons';

const TeamAliasManager: React.FC = () => {
  const { teams, addTeam, updateTeam, removeTeam } = useNormalizationData();
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [formData, setFormData] = useState<TeamData>({
    canonical: '',
    sport: 'NBA',
    abbreviations: [],
    aliases: []
  });
  
  const [newAbbr, setNewAbbr] = useState('');
  const [newAlias, setNewAlias] = useState('');
  
  const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'UFC', 'PGA', 'Soccer', 'Tennis', 'Other'];
  
  const startEdit = (team: TeamData) => {
    setEditingTeam(team.canonical);
    setFormData({ ...team });
    setNewAbbr('');
    setNewAlias('');
  };
  
  const cancelEdit = () => {
    setEditingTeam(null);
    setIsAdding(false);
    setFormData({ canonical: '', sport: 'NBA', abbreviations: [], aliases: [] });
    setNewAbbr('');
    setNewAlias('');
  };
  
  const saveTeam = () => {
    if (!formData.canonical.trim()) {
      alert('Canonical name is required');
      return;
    }
    
    if (isAdding) {
      if (addTeam(formData)) {
        cancelEdit();
      } else {
        alert('Team already exists');
      }
    } else if (editingTeam) {
      updateTeam(editingTeam, formData);
      cancelEdit();
    }
  };
  
  const addAbbreviation = () => {
    if (newAbbr.trim() && !formData.abbreviations.includes(newAbbr.trim())) {
      setFormData({
        ...formData,
        abbreviations: [...formData.abbreviations, newAbbr.trim()]
      });
      setNewAbbr('');
    }
  };
  
  const removeAbbreviation = (abbr: string) => {
    setFormData({
      ...formData,
      abbreviations: formData.abbreviations.filter(a => a !== abbr)
    });
  };
  
  const addAlias = () => {
    if (newAlias.trim() && !formData.aliases.includes(newAlias.trim())) {
      setFormData({
        ...formData,
        aliases: [...formData.aliases, newAlias.trim()]
      });
      setNewAlias('');
    }
  };
  
  const removeAlias = (alias: string) => {
    setFormData({
      ...formData,
      aliases: formData.aliases.filter(a => a !== alias)
    });
  };
  
  const teamsBySport = teams.reduce((acc, team) => {
    if (!acc[team.sport]) acc[team.sport] = [];
    acc[team.sport].push(team);
    return acc;
  }, {} as Record<string, TeamData[]>);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Teams & Aliases</h3>
        <button
          onClick={() => {
            setIsAdding(true);
            setFormData({ canonical: '', sport: 'NBA', abbreviations: [], aliases: [] });
          }}
          className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team</span>
        </button>
      </div>
      
      {(isAdding || editingTeam) && (
        <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Canonical Name *</label>
              <input
                type="text"
                value={formData.canonical}
                onChange={(e) => setFormData({ ...formData, canonical: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
                placeholder="e.g., Phoenix Suns"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sport *</label>
              <select
                value={formData.sport}
                onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
              >
                {sports.map(sport => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Abbreviations</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newAbbr}
                onChange={(e) => setNewAbbr(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAbbreviation()}
                className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
                placeholder="e.g., PHO, PHX"
              />
              <button
                onClick={addAbbreviation}
                className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.abbreviations.map(abbr => (
                <span
                  key={abbr}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                >
                  <span>{abbr}</span>
                  <button onClick={() => removeAbbreviation(abbr)} className="hover:text-blue-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Aliases</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAlias()}
                className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
                placeholder="e.g., Suns, PHO Suns, Phoenix"
              />
              <button
                onClick={addAlias}
                className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.aliases.map(alias => (
                <span
                  key={alias}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs"
                >
                  <span>{alias}</span>
                  <button onClick={() => removeAlias(alias)} className="hover:text-green-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md hover:bg-neutral-400 dark:hover:bg-neutral-600"
            >
              Cancel
            </button>
            <button
              onClick={saveTeam}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Save
            </button>
          </div>
        </div>
      )}
      
      <div className="max-h-96 overflow-y-auto space-y-4">
        {Object.entries(teamsBySport).sort().map(([sport, sportTeams]) => (
          <div key={sport}>
            <h4 className="font-bold text-neutral-800 dark:text-neutral-200 mb-2">{sport}</h4>
            <div className="space-y-2">
              {sportTeams.map(team => (
                <div
                  key={team.canonical}
                  className="flex justify-between items-start p-3 bg-white dark:bg-neutral-800 rounded-md"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-900 dark:text-white">{team.canonical}</div>
                    {team.abbreviations.length > 0 && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        <span className="font-medium">Abbr:</span> {team.abbreviations.join(', ')}
                      </div>
                    )}
                    {team.aliases.length > 0 && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        <span className="font-medium">Aliases:</span> {team.aliases.slice(0, 5).join(', ')}
                        {team.aliases.length > 5 && ` (+${team.aliases.length - 5} more)`}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEdit(team)}
                      className="text-primary-500 hover:text-primary-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${team.canonical}?`)) {
                          removeTeam(team.canonical);
                        }
                      }}
                      className="text-danger-500 hover:text-danger-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamAliasManager;
