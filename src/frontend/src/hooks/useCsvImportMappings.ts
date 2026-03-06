/**
 * Hook for persisting CSV import mappings in localStorage.
 *
 * Stores:
 * - csv_name_columns: known name column names (columnName → true)
 * - csv_asset_mappings: CSV value → app ticker (e.g. "ING Groep NV" → "INGA:XAMS")
 * - csv_field_mappings: field name (type, datum, aantal, prijs, kosten) → CSV column name
 * - csv_type_translations: CSV type value → TransactionType string (e.g. "effecten koop" → "buy")
 */

import { useCallback, useState } from "react";

const NAME_COLUMNS_KEY = "csv_name_columns";
const ASSET_MAPPINGS_KEY = "csv_asset_mappings";
const FIELD_MAPPINGS_KEY = "csv_field_mappings";
const TYPE_TRANSLATIONS_KEY = "csv_type_translations";

function readJson<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export type FieldName = "type" | "datum" | "aantal" | "prijs" | "kosten";

export interface CsvImportMappings {
  /** Known name column names (case-insensitive match key → true) */
  nameColumns: Record<string, true>;
  /** CSV asset name/value → app ticker */
  assetMappings: Record<string, string>;
  /** Field name → CSV column name */
  fieldMappings: Record<FieldName, string>;
  /** CSV type value → TransactionType string */
  typeTranslations: Record<string, string>;
}

export interface UseCsvImportMappingsReturn extends CsvImportMappings {
  saveNameColumn: (columnName: string) => void;
  saveAssetMapping: (csvValue: string, ticker: string) => void;
  saveFieldMapping: (field: FieldName, columnName: string) => void;
  saveTypeTranslation: (csvValue: string, transactionType: string) => void;
  clearAllMappings: () => void;
}

export function useCSVImportMappings(): UseCsvImportMappingsReturn {
  const [nameColumns, setNameColumns] = useState<Record<string, true>>(() =>
    readJson(NAME_COLUMNS_KEY, {}),
  );
  const [assetMappings, setAssetMappings] = useState<Record<string, string>>(
    () => readJson(ASSET_MAPPINGS_KEY, {}),
  );
  const [fieldMappings, setFieldMappings] = useState<Record<FieldName, string>>(
    () =>
      readJson(FIELD_MAPPINGS_KEY, {
        type: "",
        datum: "",
        aantal: "",
        prijs: "",
        kosten: "",
      }),
  );
  const [typeTranslations, setTypeTranslations] = useState<
    Record<string, string>
  >(() => readJson(TYPE_TRANSLATIONS_KEY, {}));

  const saveNameColumn = useCallback((columnName: string) => {
    const key = columnName.toLowerCase();
    setNameColumns((prev) => {
      const next = { ...prev, [key]: true as const };
      writeJson(NAME_COLUMNS_KEY, next);
      return next;
    });
  }, []);

  const saveAssetMapping = useCallback((csvValue: string, ticker: string) => {
    setAssetMappings((prev) => {
      const next = { ...prev, [csvValue]: ticker };
      writeJson(ASSET_MAPPINGS_KEY, next);
      return next;
    });
  }, []);

  const saveFieldMapping = useCallback(
    (field: FieldName, columnName: string) => {
      setFieldMappings((prev) => {
        const next = { ...prev, [field]: columnName };
        writeJson(FIELD_MAPPINGS_KEY, next);
        return next;
      });
    },
    [],
  );

  const saveTypeTranslation = useCallback(
    (csvValue: string, transactionType: string) => {
      setTypeTranslations((prev) => {
        const next = { ...prev, [csvValue]: transactionType };
        writeJson(TYPE_TRANSLATIONS_KEY, next);
        return next;
      });
    },
    [],
  );

  const clearAllMappings = useCallback(() => {
    setNameColumns({});
    setAssetMappings({});
    setFieldMappings({
      type: "",
      datum: "",
      aantal: "",
      prijs: "",
      kosten: "",
    });
    setTypeTranslations({});
    localStorage.removeItem(NAME_COLUMNS_KEY);
    localStorage.removeItem(ASSET_MAPPINGS_KEY);
    localStorage.removeItem(FIELD_MAPPINGS_KEY);
    localStorage.removeItem(TYPE_TRANSLATIONS_KEY);
  }, []);

  return {
    nameColumns,
    assetMappings,
    fieldMappings,
    typeTranslations,
    saveNameColumn,
    saveAssetMapping,
    saveFieldMapping,
    saveTypeTranslation,
    clearAllMappings,
  };
}
