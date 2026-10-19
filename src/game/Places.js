import { NEEM_ISLAND } from './NeemTerrain.js';
import { ADIYOGI_ISLAND } from "./AdiyogiTerrain.js";
export const PLACES = [
  {
    id: "neem", name: "Neem Point",
    position: [NEEM_ISLAND.x - 8.5, 0, NEEM_ISLAND.z + 2],
    subtitle: "A little shade between shores",
    description: "Land on the small sandy beach and follow the stones to a spreading neem tree. A wooden bench looks out across the channel between Malai Vasal and Adiyogi.",
  },
  {
    id: "harbour",
    name: "Home harbour",
    position: [11, 0, -1],
    subtitle: "A quiet place to begin",
    description:
      "Follow the wooden pier back to shore. The little harbour is sheltered by palms, hibiscus, and the warm shallows.",
  },
  {
    id: "coral",
    name: "Coral garden",
    position: [-12, 0, 0],
    subtitle: "A world just beneath the surface",
    description:
      "Slow down over the reef. Lavender tube sponges, coral fans, and patches of seagrass share the sunlit seabed.",
  },
  {
    id: "fish",
    name: "Silver shoal",
    position: [-8, 0, 8],
    subtitle: "Follow the flicker of fins",
    description:
      "A small school circles the lagoon. Coast quietly alongside them and watch how they scatter beneath your hull.",
  },
  {
    id: "blue",
    name: "The blue beyond",
    position: [18, 0, 16],
    subtitle: "Nothing but sea and sky",
    description:
      "Head beyond the shallow shelf, where turquoise water gives way to deep blue. Take a wide turn and draw a trail across the sea.",
  },
  {
    id: "adiyogi",
    name: "Adiyogi Island",
    position: [ADIYOGI_ISLAND.x - 29, 0, ADIYOGI_ISLAND.z + 4],
    subtitle: "Across the channel",
    description: "A broad, quiet island beyond Malai Vasal. Its open sandy grounds await Adiyogi.",
  },
];
