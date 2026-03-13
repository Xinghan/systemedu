"use client";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "ai", label: "AI" },
  { key: "biotech", label: "Biotech" },
  { key: "aerospace", label: "Aerospace" },
  { key: "music", label: "Music" },
  { key: "climate", label: "Climate" },
  { key: "robotics", label: "Robotics" },
  { key: "chemistry", label: "Chemistry" },
  { key: "math", label: "Math" },
  { key: "cs", label: "CS" },
  { key: "other", label: "Other" },
];

export default function CategoryFilter({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          onClick={() => onChange(cat.key)}
          className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all cursor-pointer ${
            selected === cat.key
              ? "bg-[#b8a0d8] text-[#1a1a2e] font-medium"
              : "bg-[#2a3548]/60 text-[#8a9bb5] border border-[#3a4a60]/50 hover:border-[#5a6a7f]"
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
