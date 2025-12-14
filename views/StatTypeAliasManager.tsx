import React, { useState } from 'react';
import { useNormalizationData, StatTypeData } from '../hooks/useNormalizationData';
import { Trash2, Edit2, Plus, X } from '../components/icons';

const StatTypeAliasManager: React.FC = () => {
  const { statTypes, addStatType, updateStatType, removeStatType } = useNormalizationData();
  const [editingStatType, setEditingStatType] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const [formData, setFormData] = useState<StatTypeData>({
    canonical: '',
    sport: 'NBA',
    description: '',
    aliases: []
  });
  
  const [newAlias, setNewAlias] = useState('');
  
  const sports = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'UFC', 'PGA', 'Soccer', 'Tennis', 'Other'];
  
  const startEdit = (statType: StatTypeData) => {
    setEditingStatType(statType.canonical);
    setFormData({ ...statType });
    setNewAlias('');
  };
  
  const cancelEdit = () => {
    setEditingStatType(null);
    setIsAdding(false);
    setFormData({ canonical: '', sport: 'NBA', description: '', aliases: [] });
    setNewAlias('');
  };
  
  const saveStatType = () => {
    if (!formData.canonical.trim()) {
      alert('Canonical code is required');
      return;
    }
    
    if (isAdding) {
      if (addStatType(formData)) {
        cancelEdit();
      } else {
        alert('Stat type already exists for this sport');
      }
    } else if (editingStatType) {
      updateStatType(editingStatType, formData);
      cancelEdit();
    }
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
  
  const statTypesBySport = statTypes.reduce((acc, statType) => {
    if (!acc[statType.sport]) acc[statType.sport] = [];
    acc[statType.sport].push(statType);
    return acc;
  }, {} as Record<string, StatTypeData[]>);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Stat Types & Aliases</h3>
        <button
          onClick={() => {
            setIsAdding(true);
            setFormData({ canonical: '', sport: 'NBA', description: '', aliases: [] });
          }}
          className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Stat Type</span>
        </button>
      </div>
      
      {(isAdding || editingStatType) && (
        <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Canonical Code *</label>
              <input
                type="text"
                value={formData.canonical}
                onChange={(e) => setFormData({ ...formData, canonical: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
                placeholder="e.g., Pts, Reb, 3pt"
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
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
              placeholder="e.g., Points, Rebounds, Made Threes"
            />
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
                placeholder="e.g., Points, PTS, pts"
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
              onClick={saveStatType}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Save
            </button>
          </div>
        </div>
      )}
      
      <div className="max-h-96 overflow-y-auto space-y-4">
        {Object.entries(statTypesBySport).sort().map(([sport, sportStatTypes]) => (
          <div key={sport}>
            <h4 className="font-bold text-neutral-800 dark:text-neutral-200 mb-2">{sport}</h4>
            <div className="space-y-2">
              {sportStatTypes.map(statType => (
                <div
                  key={`${statType.canonical}-${statType.sport}`}
                  className="flex justify-between items-start p-3 bg-white dark:bg-neutral-800 rounded-md"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-neutral-900 dark:text-white">{statType.canonical}</div>
                    {statType.description && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {statType.description}
                      </div>
                    )}
                    {statType.aliases.length > 0 && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        <span className="font-medium">Aliases:</span> {statType.aliases.slice(0, 5).join(', ')}
                        {statType.aliases.length > 5 && ` (+${statType.aliases.length - 5} more)`}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => startEdit(statType)}
                      className="text-primary-500 hover:text-primary-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${statType.canonical}?`)) {
                          removeStatType(statType.canonical);
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

export default StatTypeAliasManager;
