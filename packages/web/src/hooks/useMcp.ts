import useChat from './useChat';
import useMcpApi from './useMcpApi';

const useMcp = () => {
  const fixedId = '/mcp';
  const {
    getModelId,
    setModelId,
    init,
    getCurrentSystemContext,
    updateSystemContext,
    rawMessages,
    messages,
    isEmpty,
    clear,
  } = useChat(fixedId);
  const { postMessage, loading } = useMcpApi(fixedId);

  return {
    getModelId,
    setModelId,
    init,
    getCurrentSystemContext,
    updateSystemContext,
    rawMessages,
    messages,
    isEmpty,
    clear,
    loading,
    postMessage,
  };
};

export default useMcp;
