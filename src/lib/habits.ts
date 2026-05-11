import {
  Beef,
  BookOpen,
  BriefcaseBusiness,
  CircleDot,
  Dumbbell,
  Footprints,
  HeartPulse,
  Moon,
  Pill,
  Sparkles,
  Droplets,
} from "lucide-react";

export const habitIconOptions = [
  { value: "pill", label: "Pill", icon: Pill },
  { value: "dumbbell", label: "Dumbbell", icon: Dumbbell },
  { value: "book", label: "Book", icon: BookOpen },
  { value: "walk", label: "Walk", icon: Footprints },
  { value: "sleep", label: "Sleep", icon: Moon },
  { value: "water", label: "Water", icon: Droplets },
  { value: "meditation", label: "Meditation", icon: Sparkles },
  { value: "food", label: "Food", icon: Beef },
  { value: "heart", label: "Heart", icon: HeartPulse },
  { value: "work", label: "Work", icon: BriefcaseBusiness },
  { value: "circle", label: "Default", icon: CircleDot },
] as const;

export const habitColourOptions = [
  {
    value: "emerald",
    label: "Emerald",
    swatch: "bg-emerald-400",
    icon: "bg-emerald-400/18 text-emerald-300",
    progress: "bg-emerald-400",
    chip: "bg-emerald-400/15 text-emerald-300",
  },
  {
    value: "sky",
    label: "Sky",
    swatch: "bg-sky-400",
    icon: "bg-sky-400/18 text-sky-300",
    progress: "bg-sky-400",
    chip: "bg-sky-400/15 text-sky-300",
  },
  {
    value: "lime",
    label: "Lime",
    swatch: "bg-lime-400",
    icon: "bg-lime-400/18 text-lime-300",
    progress: "bg-lime-400",
    chip: "bg-lime-400/15 text-lime-300",
  },
  {
    value: "orange",
    label: "Orange",
    swatch: "bg-orange-400",
    icon: "bg-orange-400/18 text-orange-300",
    progress: "bg-orange-400",
    chip: "bg-orange-400/15 text-orange-300",
  },
  {
    value: "violet",
    label: "Violet",
    swatch: "bg-violet-400",
    icon: "bg-violet-400/18 text-violet-300",
    progress: "bg-violet-400",
    chip: "bg-violet-400/15 text-violet-300",
  },
  {
    value: "rose",
    label: "Rose",
    swatch: "bg-rose-400",
    icon: "bg-rose-400/18 text-rose-300",
    progress: "bg-rose-400",
    chip: "bg-rose-400/15 text-rose-300",
  },
  {
    value: "amber",
    label: "Amber",
    swatch: "bg-amber-400",
    icon: "bg-amber-400/18 text-amber-300",
    progress: "bg-amber-400",
    chip: "bg-amber-400/15 text-amber-300",
  },
] as const;

export type HabitIconValue = (typeof habitIconOptions)[number]["value"];
export type HabitColourValue = (typeof habitColourOptions)[number]["value"];

export function getHabitIconOption(icon: string | null | undefined) {
  return (
    habitIconOptions.find((option) => option.value === icon) ??
    habitIconOptions.at(-1)!
  );
}

export function getHabitColourOption(colour: string | null | undefined) {
  return (
    habitColourOptions.find((option) => option.value === colour) ??
    habitColourOptions[0]
  );
}

export function isHabitIconValue(icon: string): icon is HabitIconValue {
  return habitIconOptions.some((option) => option.value === icon);
}

export function isHabitColourValue(
  colour: string,
): colour is HabitColourValue {
  return habitColourOptions.some((option) => option.value === colour);
}
