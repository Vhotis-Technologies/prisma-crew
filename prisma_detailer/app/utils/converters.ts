import { RootState, useAppSelector } from "../store/my_store";

/**
 * Format the currency based on the users country.
 * The method uses the users stored address in the state to determine what country they are in.
 * If the country is not supported, the method will default to EUR.
 *
 * @param amount
 * @returns
 */
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

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatTime = (time: string) => {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};
