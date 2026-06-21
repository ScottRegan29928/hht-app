import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Search, MapPin, Calendar, Bed } from "lucide-react";

export function SearchBar() {
  const navigate = useNavigate();
  const communities = useQuery(api.communities.list);
  const [community, setCommunity] = useState("");
  const [weekNumber, setWeekNumber] = useState("");
  const [bedrooms, setBedrooms] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (community) params.set("community", community);
    if (weekNumber) params.set("week", weekNumber);
    if (bedrooms) params.set("beds", bedrooms);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="bg-white rounded-2xl shadow-lg border border-border p-2 flex flex-col sm:flex-row gap-2"
    >
      {/* Community */}
      <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
        <MapPin className="w-4 h-4 text-primary shrink-0" />
        <select
          value={community}
          onChange={(e) => setCommunity(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none appearance-none cursor-pointer text-foreground"
        >
          <option value="">All Communities</option>
          {communities?.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden sm:block w-px bg-border" />

      {/* Week Number */}
      <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
        <Calendar className="w-4 h-4 text-primary shrink-0" />
        <select
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none appearance-none cursor-pointer text-foreground"
        >
          <option value="">Any Week</option>
          {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Week {w}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden sm:block w-px bg-border" />

      {/* Bedrooms */}
      <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
        <Bed className="w-4 h-4 text-primary shrink-0" />
        <select
          value={bedrooms}
          onChange={(e) => setBedrooms(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none appearance-none cursor-pointer text-foreground"
        >
          <option value="">Any Beds</option>
          <option value="1">1+ Bed</option>
          <option value="2">2+ Beds</option>
          <option value="3">3+ Beds</option>
          <option value="4">4+ Beds</option>
        </select>
      </div>

      {/* Search button */}
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
