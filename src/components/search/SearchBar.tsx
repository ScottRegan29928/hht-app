import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Search, MapPin, Calendar, Bed, Tag, Sparkles, Check, ChevronDown } from "lucide-react";

interface MultiSelectProps {
  icon: React.ReactNode;
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  className?: string;
}

function MultiSelect({ icon, placeholder, options, selected, onChange, className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (val: string) => {
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    );
  };

  const display =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left"
      >
        <span className="shrink-0">{icon}</span>
        <span className={`text-xs truncate ${selected.length === 0 ? "text-muted-foreground" : "text-foreground font-medium"}`}>
          {display}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-56 max-h-60 overflow-y-auto bg-white rounded-xl border border-border shadow-xl z-50 py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.includes(opt.value) ? "bg-primary border-primary text-white" : "border-input"}`}>
                {selected.includes(opt.value) && <Check className="w-3 h-3" />}
              </div>
              <span className="text-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SingleSelectProps {
  icon: React.ReactNode;
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string;
  onChange: (val: string) => void;
  className?: string;
}

function SingleSelect({ icon, placeholder, options, selected, onChange, className }: SingleSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const display = selected
    ? options.find((o) => o.value === selected)?.label ?? selected
    : placeholder;

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left"
      >
        <span className="shrink-0">{icon}</span>
        <span className={`text-xs truncate ${!selected ? "text-muted-foreground" : "text-foreground font-medium"}`}>
          {display}
        </span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 max-h-60 overflow-y-auto bg-white rounded-xl border border-border shadow-xl z-50 py-1">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left text-muted-foreground"
          >
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left ${selected === opt.value ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchBar() {
  const navigate = useNavigate();
  const communities = useQuery(api.communities.list);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [selectedBedrooms, setSelectedBedrooms] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selectedCommunities.length) params.set("community", selectedCommunities.join(","));
    if (selectedWeeks.length) params.set("week", selectedWeeks.join(","));
    if (selectedBedrooms.length) params.set("beds", selectedBedrooms.join(","));
    if (selectedType) params.set("type", selectedType);
    if (selectedAmenities.length) params.set("amenities", selectedAmenities.join(","));
    navigate(`/search?${params.toString()}`);
  };

  const communityOptions = (communities ?? []).map((c) => ({ value: c.slug, label: c.name }));
  const weekOptions = Array.from({ length: 52 }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` }));
  const bedroomOptions = [
    { value: "1", label: "1+ Bed" },
    { value: "2", label: "2+ Beds" },
    { value: "3", label: "3+ Beds" },
    { value: "4", label: "4+ Beds" },
  ];
  const typeOptions = [
    { value: "rent", label: "Rent" },
    { value: "buy", label: "Buy" },
  ];
  const allAmenities = useQuery(api.properties.allAmenities);
  const amenityLabelMap: Record<string, string> = {
    pool: "Swimming Pool", hot_tub: "Hot Tub", tennis: "Tennis Court",
    grill: "Grill Area", near_harbour_town: "Near Harbour Town",
    near_beach_club: "Near Beach Club", on_golf_course: "On Golf Course",
    beach_access: "Beach Access", bike_trails: "Bike Trails",
    fitness_center: "Fitness Center", golf: "Golf", lagoon_views: "Lagoon Views",
    marina: "Marina", nature_trails: "Nature Trails", playground: "Playground",
    shopping: "Shopping", water_views: "Water Views",
  };
  const amenityOptions = (allAmenities ?? []).map((key) => ({
    value: key,
    label: amenityLabelMap[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  return (
    <form
      onSubmit={handleSearch}
      className="bg-white rounded-2xl shadow-lg border border-border p-2 flex flex-col sm:flex-row gap-2"
    >
      <SingleSelect
        icon={<Tag className="w-4 h-4 text-primary" />}
        placeholder="Rent or Buy"
        options={typeOptions}
        selected={selectedType}
        onChange={setSelectedType}
        className="sm:flex-1"
      />

      <div className="hidden sm:block w-px bg-border" />

      <MultiSelect
        icon={<MapPin className="w-4 h-4 text-primary" />}
        placeholder="Communities"
        options={communityOptions}
        selected={selectedCommunities}
        onChange={setSelectedCommunities}
        className="sm:flex-1"
      />

      <div className="hidden sm:block w-px bg-border" />

      <MultiSelect
        icon={<Calendar className="w-4 h-4 text-primary" />}
        placeholder="Weeks"
        options={weekOptions}
        selected={selectedWeeks}
        onChange={setSelectedWeeks}
        className="sm:flex-1"
      />

      <div className="hidden sm:block w-px bg-border" />

      <MultiSelect
        icon={<Bed className="w-4 h-4 text-primary" />}
        placeholder="Beds"
        options={bedroomOptions}
        selected={selectedBedrooms}
        onChange={setSelectedBedrooms}
        className="sm:flex-1"
      />

      <div className="hidden sm:block w-px bg-border" />

      <MultiSelect
        icon={<Sparkles className="w-4 h-4 text-primary" />}
        placeholder="Amenities"
        options={amenityOptions}
        selected={selectedAmenities}
        onChange={setSelectedAmenities}
        className="sm:flex-1"
      />

      <button
        type="submit"
        className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="sm:hidden">Search</span>
      </button>
    </form>
  );
}
