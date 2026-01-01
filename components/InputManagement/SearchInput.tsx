
import React from 'react';
import { Search } from '../../components/icons';

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ 
  value, 
  onChange, 
  placeholder = "Search...",
  className = ""
}) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-shadow"
    />
  </div>
);

export default SearchInput;
