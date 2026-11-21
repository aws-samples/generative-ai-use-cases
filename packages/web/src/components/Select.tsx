import React, { Fragment, useCallback, useMemo } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { PiCaretUpDown, PiCheck, PiX } from 'react-icons/pi';
import RowItem, { RowItemProps } from './RowItem';
import ButtonIcon from './ButtonIcon';
import Help from './Help';

type Props = RowItemProps & {
  label?: string;
  value: string;
  options: {
    value: string;
    label: string;
    tags?: string[];
  }[];
  help?: string;
  clearable?: boolean;
  fullWidth?: boolean;
  showColorChips?: boolean;
  showTags?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

const Select: React.FC<Props> = (props) => {
  const selectedOption = useMemo(() => {
    if (!props.value || props.value === '') return null;
    return props.options.find((o) => o.value === props.value);
  }, [props.options, props.value]);

  const selectedLabel = useMemo(() => {
    if (!selectedOption) return '';
    return selectedOption.label;
  }, [selectedOption]);

  const selectedTags = useMemo(() => {
    if (!selectedOption) return undefined;
    return selectedOption.tags;
  }, [selectedOption]);

  const onClear = useCallback(() => {
    props.onChange('');
  }, [props]);

  const ColorChips: React.FC<{ colors: string[] }> = ({ colors }) => (
    <div className="flex items-center gap-1">
      {colors.map((color, index) => (
        <div
          key={index}
          className="h-4 w-4 border border-gray-300"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );

  const Tags: React.FC<{ tags: string[] }> = ({ tags }) => (
    <div className="flex flex-row items-center gap-x-2">
      {tags.map((tag, index) => (
        <div
          className="bg-aws-smile rounded-full px-2 py-0.5 text-xs text-white"
          key={index}>
          {tag}
        </div>
      ))}
    </div>
  );

  const OptionContent: React.FC<{
    value: string;
    label: string;
    tags?: string[];
  }> = ({ value, label, tags }) => {
    if (props.showColorChips) {
      const colors = value.split(',').map((color) => color.trim());
      return (
        <div className="flex items-center gap-2">
          <ColorChips colors={colors} />
          <span>{label}</span>
        </div>
      );
    }

    if (props.showTags) {
      return (
        <div className="flex w-full items-center gap-2">
          <span className="line-clamp-1">{label}</span>
          {tags && <Tags tags={tags} />}
        </div>
      );
    }

    return <span>{label}</span>;
  };

  return (
    <RowItem notItem={props.notItem} className="relative">
      {props.label && (
        <div className="flex items-center">
          <span className="text-sm">{props.label}</span>
          {props.help && <Help className="ml-1" message={props.help} />}
        </div>
      )}
      <Listbox value={props.value} onChange={props.onChange}>
        <div className="relative">
          <Listbox.Button
            className={`relative cursor-pointer rounded border border-black/30 bg-white py-1.5 pl-3 pr-10 text-left focus:outline-none ${props.fullWidth ? 'w-full' : 'w-fit'}`}>
            <span className="line-clamp-1">
              {props.value ? (
                <OptionContent
                  value={props.value}
                  label={selectedLabel}
                  tags={selectedTags}
                />
              ) : (
                <span className="text-gray-500">
                  {props.placeholder || 'Select an option'}
                </span>
              )}
            </span>

            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <PiCaretUpDown className="text-sm" />
            </span>
          </Listbox.Button>
          {props.clearable && props.value !== '' && (
            <span className="absolute inset-y-0 right-3 flex items-center pr-2">
              <ButtonIcon onClick={onClear}>
                <PiX className="text-sm" />
              </ButtonIcon>
            </span>
          )}
        </div>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0">
          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-fit min-w-64 overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
            {props.options.map((option, idx) => (
              <Listbox.Option
                key={idx}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                    active ? 'bg-aws-smile/10 text-aws-smile' : 'text-gray-900'
                  }`
                }
                value={option.value}>
                {({ selected }) => (
                  <>
                    <span
                      className={`line-clamp-1 ${
                        selected ? 'font-medium' : 'font-normal'
                      }`}>
                      <OptionContent
                        value={option.value}
                        label={option.label}
                        tags={option.tags}
                      />
                    </span>
                    {selected ? (
                      <span className="text-aws-smile absolute inset-y-0 left-0 flex items-center pl-3">
                        <PiCheck className="size-5" />
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </Listbox>
    </RowItem>
  );
};

export default Select;
