import colors from "@/constants/colors";

// Fixed dark appearance follows the requested mobile reference.
export function useColors() { return { ...colors.dark, radius: colors.radius }; }
