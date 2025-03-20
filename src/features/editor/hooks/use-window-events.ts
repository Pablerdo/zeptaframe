import { useEvent } from "react-use";

export const useWindowEvents = (isAuthNavigating: boolean = false) => {
  useEvent("beforeunload", (event) => {
    // Skip showing the confirmation dialog if navigating for authentication
    if (isAuthNavigating) return;
    
    (event || window.event).returnValue = "Are you sure you want to leave?";
  });
};
