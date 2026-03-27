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
