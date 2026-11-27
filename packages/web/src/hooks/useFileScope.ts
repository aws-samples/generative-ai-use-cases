import { createContext, useContext } from 'react';
import { FileScope } from './useFileApi';

/**
 * The chat or share whose content is being rendered, so that S3 links and
 * images inside it are signed through the right route. Set by ChatMessage.
 */
export const FileScopeContext = createContext<FileScope | undefined>(undefined);

const useFileScope = () => useContext(FileScopeContext);

export default useFileScope;
