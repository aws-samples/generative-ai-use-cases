import React from 'react';
import { useNovaSonic } from '../hooks/useNovaSonic';

const SpeechToSpeech: React.FC = () => {
  const {
    isRecording,
    startSession,
    startRecording,
    stopRecording,
  } = useNovaSonic();

  return (
    <div>
      <h1>Speech To Speech</h1>
      <div>
      </div>
      <div>
        <button onClick={startSession}>
          Start Session
        </button>
      </div>
      <div>
        isRecording: {isRecording.toString()}
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
