import {
  Armchair,
  BookOpenCheck,
  BriefcaseBusiness,
  CookingPot,
  Dumbbell,
  Flower2,
  GraduationCap,
  Headphones,
  Mountain,
  Shirt,
  ShoppingBasket,
  Sofa,
  Sparkles,
  Tag,
  UtensilsCrossed,
} from 'lucide-react';

/** Explicit map keeps the bundle small (tree-shaken lucide icons used by category data). */
const ICONS = { Armchair, BookOpenCheck, BriefcaseBusiness, CookingPot, Dumbbell, Flower2, GraduationCap, Headphones, Mountain, Shirt, ShoppingBasket, Sofa, Sparkles, UtensilsCrossed };

export default function Icon({ name, ...props }) {
  const Cmp = ICONS[name] || Tag;
  return <Cmp {...props} />;
}
