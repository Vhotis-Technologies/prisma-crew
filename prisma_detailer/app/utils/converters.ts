/**
 * Display helpers: currency, date, and time formatting for the detailer app.
 */
import { RootState, useAppSelector } from "../store/my_store";

/** Format amount as GBP or EUR based on country name; defaults to EUR. */
export const formatCurrency = (amount: number, country?: string) => {
  if (country && country.toLocaleUpperCase() === "united kingdom") {
    return amount.toLocaleString("en-GB", {
      style: "currency",
      currency: "GBP",
    });
  } else if (country && country.toLocaleUpperCase() === "ireland") {
    return amount.toLocaleString("en-GB", {
      style: "currency",
      currency: "EUR",
    });
  } else {
    return amount.toLocaleString("en-GB", {
      style: "currency",
      currency: "EUR",
    });
  }
};

/** Format an ISO date string as `DD Mon YYYY` (en-IE). */
export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Format a `HH:mm` time string as 12-hour locale time. */
export const formatTime = (time: string) => {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};
