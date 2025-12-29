import React, { useState, useMemo, useCallback } from "react";
import { useInputs, ItemsBySport } from "../hooks/useInputs";
import { Trash2, ChevronDown, AlertTriangle } from "../components/icons";
import TeamAliasManager from "./TeamAliasManager";
import StatTypeAliasManager from "./StatTypeAliasManager";
import PlayerAliasManager from "./PlayerAliasManager";
import UnresolvedQueueManager from "./UnresolvedQueueManager";
import { getUnresolvedQueueCount } from "../services/unresolvedQueue";

const Accordion: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-6 text-left"
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${title.replace(/\s/g, "-")}`}
      >
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {title}
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1 text-sm">
            {description}
          </p>
        </div>
        <ChevronDown
          className={`w-6 h-6 text-neutral-500 transform transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div
          id={`accordion-content-${title.replace(/\s/g, "-")}`}
          className="bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-b-lg border-t border-neutral-200 dark:border-neutral-800"
        >
          {children}
        </div>
      )}
    </div>
  );
};

const SportFilterButtons: React.FC<{
  sports: string[];
  selected: string;
  onSelect: (sport: string) => void;
}> = ({ sports, selected, onSelect }) => (
  <div className="flex items-center space-x-2 flex-wrap gap-y-2 mb-4">
    <button
      onClick={() => onSelect("All")}
      className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors ${
        selected === "All"
          ? "bg-primary-600 text-white shadow"
          : "text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
      }`}
    >
      All
    </button>
    {sports.map((sport) => (
      <button
        key={sport}
        onClick={() => onSelect(sport)}
        className={`px-3 py-1.5 rounded-md font-semibold text-xs transition-colors ${
          selected === sport
            ? "bg-primary-600 text-white shadow"
            : "text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        }`}
      >
        {sport}
      </button>
    ))}
  </div>
);

const SportsbooksManager: React.FC = () => {
  const { sportsbooks, addSportsbook, removeSportsbook } = useInputs();
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    if (name && abbreviation && url) {
      if (addSportsbook({ name, abbreviation, url })) {
        setName("");
        setAbbreviation("");
        setUrl("");
      } else {
        alert(`Sportsbook "${name}" already exists.`);
      }
    }
  };

  return (
    <Accordion
      title="Sportsbooks"
      description="Manage the sportsbooks you bet on."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full Name (e.g., BetMGM)"
            className="md:col-span-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm w-full"
          />
          <input
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            placeholder="Abbr. (e.g., MGM)"
            className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm w-full"
          />
          <button
            onClick={handleAdd}
            className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary-700 disabled:bg-neutral-500"
            disabled={!name || !abbreviation || !url}
          >
            Add
          </button>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (e.g., https://betmgm.com)"
            className="col-span-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm w-full"
          />
        </div>
        <div className="max-h-60 overflow-y-auto pr-2">
          <ul className="space-y-2">
            {sportsbooks.map((book, index) => (
              <li
                key={book.name}
                className={`flex justify-between items-center p-2 rounded-md ${
                  index % 2 === 0
                    ? "bg-white dark:bg-neutral-800"
                    : "bg-neutral-50 dark:bg-neutral-800/50"
                }`}
              >
                <div>
                  <span className="font-semibold">
                    {book.name} ({book.abbreviation})
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-2">
                    {book.url}
                  </span>
                </div>
                <button
                  onClick={() => removeSportsbook(book.name)}
                  className="text-danger-500 hover:text-danger-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Accordion>
  );
};

const ListManager: React.FC<{
  title: string;
  description: string;
  items: string[];
  onAdd: (item: string) => boolean;
  onRemove: (item: string) => void;
  placeholder: string;
  canAdd?: boolean;
}> = ({
  title,
  description,
  items,
  onAdd,
  onRemove,
  placeholder,
  canAdd = true,
}) => {
  const [newItem, setNewItem] = useState("");
  const handleAdd = () => {
    if (newItem) {
      if (onAdd(newItem)) {
        setNewItem("");
      } else {
        alert(`"${newItem}" already exists.`);
      }
    }
  };
  return (
    <Accordion title={title} description={description}>
      <div className="space-y-4">
        {canAdd && (
          <div className="flex gap-4">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder={placeholder}
              className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm w-full"
            />
            <button
              onClick={handleAdd}
              className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary-700 disabled:bg-neutral-500"
              disabled={!newItem}
            >
              Add
            </button>
          </div>
        )}
        <div className="max-h-60 overflow-y-auto pr-2">
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li
                key={item}
                className={`flex justify-between items-center p-2 rounded-md ${
                  index % 2 === 0
                    ? "bg-white dark:bg-neutral-800"
                    : "bg-neutral-50 dark:bg-neutral-800/50"
                }`}
              >
                <span className="font-semibold">{item}</span>
                <button
                  onClick={() => onRemove(item)}
                  className="text-danger-500 hover:text-danger-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Accordion>
  );
};

const BetTypesManager: React.FC = () => {
  const { sports, betTypes, addBetType, removeBetType } = useInputs();
  const [selectedSport, setSelectedSport] = useState(sports[0] || "");
  const [newType, setNewType] = useState("");
  const [filterSport, setFilterSport] = useState("All");

  const handleAdd = () => {
    if (selectedSport && newType) {
      if (addBetType(selectedSport, newType)) {
        setNewType("");
      } else {
        alert(`Bet type "${newType}" already exists for ${selectedSport}.`);
      }
    }
  };

  // Fix: Add explicit return type <ItemsBySport> to useMemo to ensure correct type inference.
  const filteredBetTypes = useMemo<ItemsBySport>(() => {
    if (filterSport === "All") return betTypes;
    if (betTypes[filterSport]) {
      return { [filterSport]: betTypes[filterSport] };
    }
    return {};
  }, [betTypes, filterSport]);

  return (
    <Accordion
      title="Bet Types by Sport"
      description="Organize bet markets for accurate filtering on the dashboard."
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
          >
            {sports.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="e.g., Player Points"
            className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm w-full"
          />
          <button
            onClick={handleAdd}
            className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary-700 disabled:bg-neutral-500"
            disabled={!selectedSport || !newType}
          >
            Add
          </button>
        </div>
        <SportFilterButtons
          sports={sports}
          selected={filterSport}
          onSelect={setFilterSport}
        />
        <div className="max-h-96 overflow-y-auto pr-2 space-y-4">
          {Object.keys(filteredBetTypes).length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No items to display for this filter.
            </p>
          )}
          {/* FIX: Cast the result of Object.entries to [string, string[]][] to provide a concrete type for `types`, resolving errors on `.map()` and `.length`. */}
          {(Object.entries(filteredBetTypes) as [string, string[]][]).map(
            ([sport, types]) => (
              <div key={sport}>
                <h4 className="font-bold text-neutral-800 dark:text-neutral-200 mb-2">
                  {sport}
                </h4>
                <ul className="space-y-2">
                  {types.map((type, index) => (
                    <li
                      key={type}
                      className={`flex justify-between items-center p-2 rounded-md ${
                        index % 2 === 0
                          ? "bg-white dark:bg-neutral-800"
                          : "bg-neutral-50 dark:bg-neutral-800/50"
                      }`}
                    >
                      <span className="font-semibold">{type}</span>
                      <button
                        onClick={() => removeBetType(sport, type)}
                        className="text-danger-500 hover:text-danger-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                  {types.length === 0 && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      No bet types for this sport.
                    </p>
                  )}
                </ul>
              </div>
            )
          )}
        </div>
      </div>
    </Accordion>
  );
};

const SportFilteredListManager: React.FC<{
  title: string;
  description: string;
  itemsBySport: ItemsBySport;
  sports: string[];
  onRemove: (sport: string, item: string) => void;
}> = ({ title, description, itemsBySport, sports, onRemove }) => {
  const [filterSport, setFilterSport] = useState("All");

  // Fix: Add explicit return type <ItemsBySport> to useMemo to ensure correct type inference.
  // This resolves an issue where TypeScript could not infer the type of `items`, leading to an error when calling `.map()`.
  const displayedItemsBySport = useMemo<ItemsBySport>(() => {
    if (filterSport === "All") {
      return itemsBySport;
    }
    if (itemsBySport[filterSport]) {
      return { [filterSport]: itemsBySport[filterSport] };
    }
    return {};
  }, [itemsBySport, filterSport]);

  return (
    <Accordion title={title} description={description}>
      <div className="space-y-4">
        <SportFilterButtons
          sports={sports}
          selected={filterSport}
          onSelect={setFilterSport}
        />
        <div className="max-h-96 overflow-y-auto pr-2 space-y-4">
          {Object.keys(displayedItemsBySport).length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No items to display for this filter.
            </p>
          )}
          {/* FIX: Cast the result of Object.entries to [string, string[]][] to provide a concrete type for `items`, resolving the error on `.map()`. */}
          {(Object.entries(displayedItemsBySport) as [string, string[]][]).map(
            ([sport, items]) => (
              <div key={sport}>
                <h4 className="font-bold text-neutral-800 dark:text-neutral-200 mb-2">
                  {sport}
                </h4>
                <ul className="space-y-2">
                  {items.map((item, index) => (
                    <li
                      key={item}
                      className={`flex justify-between items-center p-2 rounded-md ${
                        index % 2 === 0
                          ? "bg-white dark:bg-neutral-800"
                          : "bg-neutral-50 dark:bg-neutral-800/50"
                      }`}
                    >
                      <span className="font-semibold">{item}</span>
                      <button
                        onClick={() => onRemove(sport, item)}
                        className="text-danger-500 hover:text-danger-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      </div>
    </Accordion>
  );
};

// Accordion with count badge for unresolved queue
const QueueAccordion: React.FC<{
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}> = ({ title, description, count, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`bg-white dark:bg-neutral-900 rounded-lg shadow-md transition-all duration-300 ${
        count > 0 ? "ring-2 ring-yellow-400 dark:ring-yellow-600" : ""
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-6 text-left"
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${title.replace(/\s/g, "-")}`}
      >
        <div className="flex items-center gap-3">
          {count > 0 && (
            <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
          )}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {title}
              {count > 0 && (
                <span className="ml-2 px-2 py-0.5 text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full">
                  {count}
                </span>
              )}
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mt-1 text-sm">
              {description}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-6 h-6 text-neutral-500 transform transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div
          id={`accordion-content-${title.replace(/\s/g, "-")}`}
          className="bg-neutral-50 dark:bg-neutral-900/50 p-6 rounded-b-lg border-t border-neutral-200 dark:border-neutral-800"
        >
          {children}
        </div>
      )}
    </div>
  );
};

const InputManagementSection: React.FC = () => {
  const inputs = useInputs();
  const [queueCount, setQueueCount] = useState(() => getUnresolvedQueueCount());

  // Refresh queue count when queue changes
  const handleQueueChange = useCallback(() => {
    setQueueCount(getUnresolvedQueueCount());
  }, []);

  return (
    <div className="space-y-4">
      {/* Unresolved Queue - shown first with highlight when items exist */}
      <QueueAccordion
        title="Unresolved Queue"
        description="Review and resolve unknown entities from imports."
        count={queueCount}
      >
        <UnresolvedQueueManager onQueueChange={handleQueueChange} />
      </QueueAccordion>

      <SportsbooksManager />
      <ListManager
        title="Sports"
        description="Manage the sports you track."
        items={inputs.sports}
        onAdd={inputs.addSport}
        onRemove={inputs.removeSport}
        placeholder="e.g., NBA"
      />
      <ListManager
        title="Categories"
        description="Manage market categories for your bets."
        items={inputs.categories}
        onAdd={inputs.addCategory}
        onRemove={inputs.removeCategory}
        placeholder="e.g., Props"
      />
      <Accordion
        title="Teams with Aliases"
        description="Manage teams and their alias mappings for cross-sportsbook normalization."
      >
        <TeamAliasManager />
      </Accordion>
      <Accordion
        title="Players (Canonical + Aliases)"
        description="Manage players and their alias mappings for cross-sportsbook normalization."
      >
        <PlayerAliasManager />
      </Accordion>
      <Accordion
        title="Stat Types with Aliases"
        description="Manage stat types and their alias mappings for cross-sportsbook normalization."
      >
        <StatTypeAliasManager />
      </Accordion>
      <BetTypesManager />
      <SportFilteredListManager
        title="Players"
        description="Automatically populated on import, can be managed here."
        itemsBySport={inputs.players}
        sports={inputs.sports}
        onRemove={inputs.removePlayer}
      />
      <SportFilteredListManager
        title="Teams (Legacy)"
        description="Automatically populated on import. Use 'Teams with Aliases' above for normalization."
        itemsBySport={inputs.teams}
        sports={inputs.sports}
        onRemove={inputs.removeTeam}
      />
    </div>
  );
};

export default InputManagementSection;
