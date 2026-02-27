import { useState } from "react";

const STORAGE_KEY = "vwb_twelve_data_api_key";

export function useSettings() {
  const [twelveDataApiKey, setTwelveDataApiKeyState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  });

  const setTwelveDataApiKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setTwelveDataApiKeyState(key);
  };

  return { twelveDataApiKey, setTwelveDataApiKey };
}
