// Ref: https://github.com/onesine/react-tailwindcss-select

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import useOnClickOutside from '../hooks/useOnClickOutside';

import { PiMagnifyingGlass, PiPlusCircle, PiX } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

export type Option = {
  value: string;
  label: string;
  disabled?: boolean;
  isSelected?: boolean;
};

export type Options = Array<Option>;
export type SelectValue = Option | Option[] | null;

type FilterSelectProps = {
  options: Options;
  value: SelectValue;
  onChange: (value: SelectValue) => void;
  placeholder?: string;
  isMultiple?: boolean;
  isClearable?: boolean;
  isSearchable?: boolean;
  isDisabled?: boolean;
  allowOther?: boolean;
  noOptionsMessage?: string;
  className?: string;
};

export const FilterSelect: React.FC<FilterSelectProps> = ({
  options = [],
  value = null,
  onChange,
  placeholder,
  isMultiple = false,
  isClearable = false,
  isSearchable = false,
  isDisabled = false,
  allowOther = false,
  className,
}) => {
  const { t } = useTranslation();
  const defaultPlaceholder = t('common.not_selected');

  const [open, setOpen] = useState<boolean>(false);
  const [list, setList] = useState<Options>(options);
  const [inputValue, setInputValue] = useState<string>('');
  const ref = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const formatItem = (item: Option) => {
      if ('disabled' in item) return item;
      return {
        ...item,
        disabled: false,
      };
    };

    setList(
      options.map((item) => {
        return formatItem(item);
      })
    );
  }, [options]);

  useEffect(() => {
    if (isSearchable) {
      if (open) {
        searchBoxRef.current?.select();
      } else {
        setInputValue('');
      }
    }
  }, [open, isSearchable]);

  const toggle = useCallback(() => {
    if (!isDisabled) {
      setOpen(!open);
    }
  }, [isDisabled, open]);

  const closeDropDown = useCallback(() => {
    if (open) setOpen(false);
  }, [open]);

  useOnClickOutside(ref, () => {
    closeDropDown();
  });

  const onPressEnterOrSpace = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      if ((e.code === 'Enter' || e.code === 'Space') && !isDisabled) {
        toggle();
      }
    },
    [isDisabled, toggle]
  );

  const handleValueChange = useCallback(
    (selected: Option) => {
      function update() {
        if (!isMultiple && !Array.isArray(value)) {
          closeDropDown();
          onChange(selected);
        }

        if (isMultiple && (Array.isArray(value) || value === null)) {
          onChange(value === null ? [selected] : [...value, selected]);
        }
      }

      if (selected !== value) {
        update();
      }
    },
    [closeDropDown, isMultiple, onChange, value]
  );

  const clearValue = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  const removeItem = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, item: Option) => {
      if (isMultiple && Array.isArray(value) && value.length) {
        e.stopPropagation();
        const result = value.filter((current) => item.value !== current.value);
        onChange(result.length ? result : null);
      }
    },
    [isMultiple, onChange, value]
  );

  // Options

  const filterByText = useCallback(() => {
    const filterItem = (item: Option) => {
      return item.label.toLowerCase().indexOf(inputValue.toLowerCase()) > -1;
    };

    let result = list.map((item: Option) => {
      return item;
    });

    result = result.filter((item: Option) => {
      return filterItem(item);
    });

    return result;
  }, [inputValue, list]);

  const removeValues = useCallback(
    (array: Options) => {
      if (!isMultiple) {
        return array;
      }

      if (Array.isArray(value)) {
        const valueId = value.map((item) => item.value);

        const filterItem = (item: Option) => !valueId.includes(item.value);

        let newArray = array.map((item) => {
          return item;
        });

        newArray = newArray.filter((item) => {
          return filterItem(item);
        });

        return newArray;
      }
      return array;
    },
    [isMultiple, value]
  );

  const filterResult = useMemo(() => {
    return removeValues(filterByText());
  }, [filterByText, removeValues]);

  // Add item not in options
  const handleAddOther = useCallback(() => {
    handleValueChange({ label: inputValue, value: inputValue });
    setInputValue('');
  }, [handleValueChange, inputValue]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div
        aria-expanded={open}
        onKeyDown={onPressEnterOrSpace}
        onClick={toggle}
        className={`flex rounded border border-gray-300 text-sm text-gray-500 shadow-sm transition-all duration-300 focus:outline-none ${
          isDisabled
            ? 'bg-gray-200'
            : 'focus:ring-aws-smile/20 focus:border-aws-smile bg-white hover:border-gray-400 focus:ring'
        }`}>
        <div className="flex grow flex-wrap gap-1 py-2 pl-2.5 pr-2">
          {!isMultiple ? (
            <p className="cursor-default select-none truncate">
              {value && !Array.isArray(value)
                ? value.label
                : placeholder || defaultPlaceholder}
            </p>
          ) : (
            <>
              {value === null && (placeholder || defaultPlaceholder)}

              {Array.isArray(value) &&
                value.map((item, index) => (
                  <div
                    className={`flex space-x-1 rounded-sm border bg-gray-200 ${isDisabled ? 'border-gray-500 px-1' : 'pl-1'}`}
                    key={index}>
                    <p className="cursor-default select-none truncate text-gray-600">
                      {item.label}
                    </p>
                    {!isDisabled && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => removeItem(e, item)}
                        className="flex cursor-pointer items-center rounded-r-sm px-1 hover:bg-red-200 hover:text-red-600">
                        <PiX className="mt-0.5 h-3 w-3" />
                      </div>
                    )}
                  </div>
                ))}
            </>
          )}
        </div>

        <div className="flex flex-none items-center py-1.5">
          {isClearable && !isDisabled && value !== null && (
            <div className="cursor-pointer px-1.5" onClick={clearValue}>
              <PiX className="h-5 w-5 p-0.5" />
            </div>
          )}
        </div>
      </div>

      {open && !isDisabled && (
        <div className="absolute top-full z-10 w-full rounded border bg-white py-1 text-sm text-gray-700 shadow-lg">
          {isSearchable && (
            <div className="relative px-2.5 py-1">
              <PiMagnifyingGlass className="absolute ml-2 mt-2.5 h-5 w-5 pb-0.5 text-gray-500" />
              <input
                ref={searchBoxRef}
                className="w-full rounded border border-gray-200 bg-gray-100 py-2 pl-8 text-sm text-gray-500 focus:border-gray-200 focus:outline-none focus:ring-0"
                type="text"
                placeholder={placeholder || defaultPlaceholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              {allowOther && (
                <div
                  className="hover:text-aws-smile absolute right-4 top-3.5 cursor-pointer text-gray-500"
                  onClick={handleAddOther}>
                  <PiPlusCircle className="h-5 w-5" />
                </div>
              )}
            </div>
          )}

          <div role="options" className="max-h-72 overflow-y-auto">
            {filterResult.map((item, index) => (
              <React.Fragment key={index}>
                <div className="px-2.5">
                  {item.disabled ? (
                    <div className="cursor-not-allowed select-none truncate px-2 py-2 text-gray-400">
                      {item.label}
                    </div>
                  ) : (
                    <li
                      tabIndex={0}
                      onKeyDown={(e: React.KeyboardEvent<HTMLLIElement>) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          handleValueChange(item);
                        }
                      }}
                      aria-selected={item.isSelected}
                      role={'option'}
                      onClick={() => handleValueChange(item)}
                      className={`block cursor-pointer select-none truncate rounded px-2 py-2 transition duration-200 ${
                        item.isSelected
                          ? 'bg-gray-500 text-white'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-500'
                      }`}>
                      {item.label}
                    </li>
                  )}
                </div>
              </React.Fragment>
            ))}

            {filterResult.length === 0 && (
              <div className="cursor-not-allowed select-none truncate px-2 py-2 text-gray-400">
                {t('common.no_options_found')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
