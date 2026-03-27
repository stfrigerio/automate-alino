export interface FileResult {
  id: string;
  filename: string;
  category: string;
}

export interface Category {
  name: string;
  folder: string;
  hints: string[];
}

export interface RulesConfig {
  description: string;
  categories: Category[];
}

export interface ConfirmRequest {
  results: FileResult[];
}

export interface ConfirmResponse {
  moved: string[];
  count: number;
}
