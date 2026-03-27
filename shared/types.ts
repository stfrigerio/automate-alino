export interface Person {
  id: string;
  name: string;
  role?: string;
  hints?: string[];
}

export interface Project {
  id: string;
  name: string;
  logo?: string;
  signatories: Person[];
  workers: Person[];
  createdAt: string;
}

export interface CreateProjectRequest {
  name: string;
  signatories: Omit<Person, "id">[];
  workers: Omit<Person, "id">[];
}

export interface FileResult {
  id: string;
  filename: string;
  category: string;
}

export interface ConfirmRequest {
  results: FileResult[];
}

export interface ConfirmResponse {
  moved: string[];
  count: number;
}
