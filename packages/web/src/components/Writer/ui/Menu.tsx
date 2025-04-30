import { PiCheck, PiList, PiMonitor, PiMoon, PiSunDim } from 'react-icons/pi';
import { Button } from './Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function Menu() {
  const { t } = useTranslation();
  const [currentTheme, setTheme] = useState('Light');

  const appearances = [
    {
      theme: 'System',
      label: t('writer.system'),
      icon: <PiMonitor className="h-4 w-4" />,
    },
    {
      theme: 'Light',
      label: t('writer.light'),
      icon: <PiSunDim className="h-4 w-4" />,
    },
    {
      theme: 'Dark',
      label: t('writer.dark'),
      icon: <PiMoon className="h-4 w-4" />,
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <PiList width={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="end">
        <p className="text-muted-foreground p-2 text-xs font-medium">
          {t('writer.appearance')}
        </p>
        {appearances.map(({ theme, label, icon }) => (
          <Button
            variant="ghost"
            key={theme}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm"
            onClick={() => {
              setTheme(theme.toLowerCase());
            }}>
            <div className="flex items-center space-x-2">
              <div className="rounded-sm border p-1">{icon}</div>
              <span>{label}</span>
            </div>
            {currentTheme === theme.toLowerCase() && (
              <PiCheck className="h-4 w-4" />
            )}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
