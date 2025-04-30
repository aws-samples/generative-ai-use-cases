export type UseCaseInputExample = {
  title: string;
  examples: Record<string, string>;
};

// Common items for all data
// Table: PartitionKey=id, SortKey=dataType
// Index: PartitionKey=useCaseId, SortKey=dataType
export type UseCaseCommon = {
  id: string;
  dataType: string;
  useCaseId: string;
};

// UseCase content (request type for creating or updating UseCase)
export type UseCaseContent = {
  title: string;
  description?: string;
  promptTemplate: string;
  inputExamples?: UseCaseInputExample[];
  fixedModelId?: string;
  fileUpload?: boolean;
};

// Content recorded in Table
export type UseCaseInTable = UseCaseCommon &
  UseCaseContent & {
    isShared: boolean;
  };

// Content returned to Frontend
// isFavorite, isMyUseCase are dynamically added
export type UseCaseAsOutput = UseCaseInTable & {
  isFavorite: boolean;
  isMyUseCase: boolean;
};

// Response for Favorite Toggle
export type IsFavorite = {
  isFavorite: boolean;
};

// Response for Shared Toggle
export type IsShared = {
  isShared: boolean;
};
