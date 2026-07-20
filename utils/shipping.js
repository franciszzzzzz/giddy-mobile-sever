import HandleError from "./handleError.js";

const SOUTH_WEST_STATES = ["lagos", "ogun", "oyo", "osun", "ondo", "ekiti"];

export const calculateShipping = (state) => {
  if (!state) {
    throw new HandleError("State is required.", 400);
  }

  const normalizedState = state.trim().toLowerCase();

  return SOUTH_WEST_STATES.includes(normalizedState) ? 4000 : 6000;
};
