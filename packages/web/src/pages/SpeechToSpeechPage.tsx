import React from 'react';
import { useNovaSonic } from '../hooks/useNovaSonic';

const SpeechToSpeech: React.FC = () => {
  const {
    isActive,
    isLoading,
    startSession,
    closeSession,
  } = useNovaSonic();

  return (
    <div>
      <h1>Speech To Speech</h1>
      <div>
        isActive: {isActive.toString()}
      </div>
      <div>
        isLoading: {isLoading.toString()}
      </div>
      <div>
        <button onClick={startSession}>
          Start Session
        </button>
      </div>
      <div>
        <button onClick={closeSession}>
          Close Session
        </button>
      </div>
    </div>
  );
};

export default SpeechToSpeech;
