import React from 'react';
import { useNovaSonic } from '../hooks/useNovaSonic';

const SpeechToSpeech: React.FC = () => {
  const {
    isConnected,
    startNewSession,
    startRecording,
    stopRecording,
  } = useNovaSonic();

  return (
    <div>
      <h1>Speech To Speech</h1>
      <div>
        isConnected: {isConnected.toString()}
      </div>
      <div>
        <button onClick={startNewSession}>
          Start New Session
        </button>
      </div>
      <div>
        <button onClick={startRecording}>
          Start Recording
        </button>
      </div>
      <div>
        <button onClick={stopRecording}>
          Stop Recording
        </button>
      </div>
    </div>
  );
};

export default SpeechToSpeech;
