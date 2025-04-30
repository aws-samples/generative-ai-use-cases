import { ExplicitFilterConfiguration } from 'generative-ai-use-cases';
import { FilterSelect, SelectValue } from '../components/FilterSelect';
import { Input } from '@aws-amplify/ui-react';
import { RetrievalFilter } from '@aws-sdk/client-bedrock-agent-runtime';
import { useMemo } from 'react';
import { Option } from '../components/FilterSelect';

// Alowed operators for each filter type
// https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent-runtime_RetrievalFilter.html
type RetrievalFilterOperator = keyof RetrievalFilter;
type FilterType = ExplicitFilterConfiguration['type'];
// FilterAttribute with label
export type FilterAttributeLabel = {
  key: string;
  value: SelectValue;
};
// RetrievalFilter with label
export type RetrievalFilterLabel = {
  [key in RetrievalFilterOperator]: FilterAttributeLabel;
};

const allowedOperators: Record<FilterType, RetrievalFilterOperator[]> = {
  STRING_LIST: ['in', 'notIn'],
  STRING: [
    'equals',
    'notEquals',
    'listContains',
    'startsWith',
    'stringContains',
  ],
  BOOLEAN: ['equals', 'notEquals'],
  NUMBER: [
    'equals',
    'notEquals',
    'greaterThan',
    'lessThan',
    'greaterThanOrEquals',
    'lessThanOrEquals',
  ],
};

const KbFilterFormElement: React.FC<{
  filterConfig: ExplicitFilterConfiguration;
  filter: RetrievalFilterLabel | null;
  setFilter: (f: RetrievalFilterLabel | null) => void;
}> = ({ filterConfig, filter, setFilter }) => {
  const defaultOperator = useMemo(
    () => allowedOperators[filterConfig.type][0],
    [filterConfig.type]
  );
  const operatorOptions = useMemo(
    () =>
      allowedOperators[filterConfig.type].map((op) => ({
        label: op,
        value: op,
      })),
    [filterConfig.type]
  );
  const [operator, attribute] = useMemo(
    () =>
      Object.entries(
        filter ?? {
          [defaultOperator]: {
            key: filterConfig.key,
            value: null,
          },
        }
      )[0] as [RetrievalFilterOperator, FilterAttributeLabel],
    [filter, filterConfig.key, defaultOperator]
  );
  switch (filterConfig.type) {
    case 'STRING_LIST':
      return (
        <div className="flex flex-col items-stretch">
          <FilterSelect
            className="my-2"
            options={operatorOptions}
            value={{ label: operator, value: operator }}
            onChange={(value) => {
              setFilter({
                [(value as Option).value as string]: {
                  key: filterConfig.key,
                  value: attribute.value,
                },
              } as RetrievalFilterLabel);
            }}
          />
          <FilterSelect
            options={filterConfig.options ?? []}
            value={attribute.value}
            onChange={(value) => {
              setFilter({
                [operator]: {
                  key: filterConfig.key,
                  value: value,
                },
              } as RetrievalFilterLabel);
            }}
            isMultiple
            isSearchable
            isClearable
            allowOther
          />
        </div>
      );
    case 'STRING':
      return (
        <div className="flex flex-col items-stretch">
          <FilterSelect
            className="my-2"
            options={operatorOptions}
            value={{ label: operator, value: operator }}
            onChange={(value) => {
              setFilter({
                [(value as Option).value as string]: {
                  key: filterConfig.key,
                  value: attribute.value,
                },
              } as RetrievalFilterLabel);
            }}
          />
          <FilterSelect
            options={filterConfig.options ?? []}
            value={attribute.value}
            onChange={(value) => {
              setFilter({
                [operator]: {
                  key: filterConfig.key,
                  value: value,
                },
              } as RetrievalFilterLabel);
            }}
            isSearchable
            isClearable
            allowOther
          />
        </div>
      );
    case 'BOOLEAN':
      return (
        <div className="flex flex-col items-stretch">
          <FilterSelect
            className="my-2"
            options={operatorOptions}
            value={{ label: operator, value: operator }}
            onChange={(value) => {
              setFilter({
                [(value as Option).value as string]: {
                  key: filterConfig.key,
                  value: attribute.value,
                },
              } as RetrievalFilterLabel);
            }}
          />
          <FilterSelect
            options={filterConfig.options ?? []}
            value={attribute.value}
            onChange={(value) => {
              setFilter({
                [operator]: {
                  key: filterConfig.key,
                  value: value,
                },
              } as RetrievalFilterLabel);
            }}
            isClearable
          />
        </div>
      );
    case 'NUMBER':
      return (
        <div className="flex flex-col items-stretch">
          <FilterSelect
            className="my-2"
            options={operatorOptions}
            value={{ label: operator, value: operator }}
            onChange={(value) => {
              setFilter({
                [(value as Option).value as string]: {
                  key: filterConfig.key,
                  value: attribute.value,
                },
              } as RetrievalFilterLabel);
            }}
          />
          <Input
            className="focus:border-aws-smile focus:ring-aws-smile/20 grow rounded border border-gray-300 bg-white text-gray-500 shadow-sm transition-all duration-300 hover:border-gray-400 focus:outline-none focus:ring"
            type="text"
            value={(attribute.value as Option)?.value ?? ''}
            onChange={(e) => {
              const value = e.target.value;
              setFilter({
                [operator]: {
                  key: filterConfig.key,
                  value: { label: value, value: value },
                },
              } as RetrievalFilterLabel);
            }}
          />
        </div>
      );
  }
};

export const KbFilter: React.FC<{
  filterConfigs: ExplicitFilterConfiguration[];
  filters: (RetrievalFilterLabel | null)[];
  setFilters: (f: (RetrievalFilterLabel | null)[]) => void;
}> = ({ filterConfigs, filters, setFilters }) => {
  return (
    <div>
      {filterConfigs.map(
        (filterConfig: ExplicitFilterConfiguration, index: number) => (
          <div key={filterConfig.key} className="my-2">
            <div>{filterConfig.description}</div>
            <div>
              <KbFilterFormElement
                filterConfig={filterConfig}
                filter={filters[index]}
                setFilter={(f: RetrievalFilterLabel | null) => {
                  const newFilters = [...filters];
                  newFilters[index] = f;
                  setFilters(newFilters);
                }}
              />
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default KbFilter;
