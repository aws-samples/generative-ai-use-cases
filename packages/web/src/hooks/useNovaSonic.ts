import { useEffect, useRef, useCallback, useState } from 'react';
import { events } from 'aws-amplify/data';

// AppSync Events のチャンネル名
const CHANNEL_NAME = '/default/nova-sonic';

// バッファリング設定
const MAX_QUEUE_SIZE = 200; // 最大キューサイズを小さくする
const MAX_CHUNKS_PER_BATCH = 5; // 一度に処理する最大チャンク数を減らす

// 音声データの変換ユーティリティ
const convertFloat32ToInt16 = (float32Array: Float32Array): Int16Array => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    // Float32を-32768から32767の範囲にスケーリング
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
};

export const useNovaSonic = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // refs
  const channelRef = useRef<any>(null);
  // 録音用と再生用に別々のAudioContextを使用
  const recordingContextRef = useRef<AudioContext | null>(null); // 16000Hz
  const playbackContextRef = useRef<AudioContext | null>(null);  // 24000Hz
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const recorderWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const recordingParamRef = useRef<AudioParam | null>(null);
  
  // バッファリング用のrefs
  const audioBufferQueueRef = useRef<Float32Array[]>([]);
  const isProcessingAudioRef = useRef<boolean>(false);

  // AudioWorkletのURLを生成する関数
  const getWorkletUrl = (filename: string): string => {
    // 現在のURLを基準にパスを構築
    const baseUrl = window.location.origin;
    return `${baseUrl}/${filename}`;
  };
  
  // 音声データをキューに追加する関数
  const queueAudioData = useCallback((audioData: Float32Array) => {
    console.log('Queueing audio data, length:', audioData.length);
    
    // キューサイズをチェック
    if (audioBufferQueueRef.current.length >= MAX_QUEUE_SIZE) {
      // キューがいっぱいなら古いチャンクを破棄
      audioBufferQueueRef.current.shift();
      console.log('Audio queue full, dropping oldest chunk');
    }
    
    // キューに音声データを追加
    audioBufferQueueRef.current.push(audioData);
    
    // キュー処理を開始
    processAudioQueue();
  }, [isConnected]);
  
  // キューを処理する関数
  const processAudioQueue = useCallback(async () => {
    console.log('Process audio queue', audioBufferQueueRef.current?.length || -1, isConnected, channelRef.current, isProcessingAudioRef.current);
    // 既に処理中か、キューが空か、接続されていない場合は何もしない
    if (isProcessingAudioRef.current || 
        audioBufferQueueRef.current.length === 0 || 
        !isConnected || 
        !channelRef.current) {
      return;
    }

    isProcessingAudioRef.current = true;
    try {
      // キューから一定数のチャンクを処理
      let processedChunks = 0;
      let combinedLength = 0;
      const chunksToProcess: Float32Array[] = [];
      
      // 処理するチャンクを集める
      while (audioBufferQueueRef.current.length > 0 && processedChunks < MAX_CHUNKS_PER_BATCH) {
        const chunk = audioBufferQueueRef.current.shift();
        if (chunk) {
          chunksToProcess.push(chunk);
          combinedLength += chunk.length;
          processedChunks++;
        }
      }
      
      if (chunksToProcess.length > 0) {
        // チャンクを結合
        const combinedBuffer = new Float32Array(combinedLength);
        let offset = 0;
        for (const chunk of chunksToProcess) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Float32Array から Int16Array に変換
        const int16Data = convertFloat32ToInt16(combinedBuffer);
        
        // Int16Array を Base64 エンコード
        const buffer = int16Data.buffer;
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);
        
        console.log(`Sending buffered audio data, chunks: ${chunksToProcess.length}, total samples: ${combinedLength}`);
        
        // AppSync Events経由でLambdaに送信
        try {
          await channelRef.current.publish({
            type: 'ClientToAppSync',
            data: {
              sessionId: sessionIdRef.current,
              audioData: base64Data,
              timestamp: Date.now()
            }
          });
          
          console.log('Buffered audio data sent successfully');
        } catch (publishError) {
          console.error('Failed to publish audio data:', publishError);
          // 送信に失敗した場合は、チャンクをキューに戻す
          for (let i = chunksToProcess.length - 1; i >= 0; i--) {
            audioBufferQueueRef.current.unshift(chunksToProcess[i]);
          }
          console.log(`Returned ${chunksToProcess.length} chunks to queue after publish failure`);
        }
      }
    } catch (err) {
      console.error('Failed to process audio data:', err);
    } finally {
      isProcessingAudioRef.current = false;
      
      // キューにまだデータがある場合は、次の処理をスケジュール
      if (audioBufferQueueRef.current.length > 0 && isConnected) {
        setTimeout(() => processAudioQueue(), 100); // 100msの遅延を入れる
      }
    }
  }, [isConnected]);

  // AppSync Events に接続
  useEffect(() => {
    console.log('Initializing Nova Sonic hook');
    
    // バッファをクリア
    audioBufferQueueRef.current = [];
    isProcessingAudioRef.current = false;
    
    const initializeAudio = async () => {
      try {
        // 録音用AudioContextの初期化（16000Hz）
        recordingContextRef.current = new AudioContext({
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
        
        // 再生用AudioContextの初期化（24000Hz）
        playbackContextRef.current = new AudioContext({
          sampleRate: 24000,
          latencyHint: 'interactive'
        });
        
        console.log('Loading audio worklets...');
        
        // Audio Workletの登録 - 完全なURLを使用
        const processorUrl = getWorkletUrl('audio-processor.worklet.js');
        const recorderUrl = getWorkletUrl('audio-recorder.worklet.js');
        
        // 再生用Workletの登録
        console.log(`Loading processor worklet from: ${processorUrl} for playback context`);
        await playbackContextRef.current.audioWorklet.addModule(processorUrl);
        
        // 録音用Workletの登録
        console.log(`Loading recorder worklet from: ${recorderUrl} for recording context`);
        await recordingContextRef.current.audioWorklet.addModule(recorderUrl);
        
        console.log('Audio worklets loaded successfully');
        
        // 再生用のWorkletNodeを作成（24000Hz用）
        audioWorkletNodeRef.current = new AudioWorkletNode(
          playbackContextRef.current,
          'audio-player-processor'
        );
        
        // 出力に接続
        audioWorkletNodeRef.current.connect(playbackContextRef.current.destination);
        
        console.log('Audio player initialized with separate contexts: recording=16000Hz, playback=24000Hz');
      } catch (err) {
        console.error('Failed to initialize audio:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize audio'));
      }
    };
    
    const connectToAppSync = async () => {
      try {
        console.log('Connecting to AppSync Events...');
        const channel = await events.connect(CHANNEL_NAME);
        channelRef.current = channel;
        setIsConnected(true);
        console.log('Connected to AppSync Events');
        
        // バッファをクリア
        audioBufferQueueRef.current = [];
        isProcessingAudioRef.current = false;
        
        // AppSync Eventsからのメッセージ受信
        channel.subscribe({
          next: (data: any) => {
            if (data.event?.type === 'BedrockToAppSync' && data.event?.data) {
              console.log('Received audio data from Bedrock');
              
              // 受信した音声データを再生
              if (data.event.data.audioData && audioWorkletNodeRef.current) {
                try {
                  // Base64エンコードされた音声データをデコード
                  const binaryData = atob(data.event.data.audioData);
                  const bytes = new Uint8Array(binaryData.length);
                  for (let i = 0; i < binaryData.length; i++) {
                    bytes[i] = binaryData.charCodeAt(i);
                  }
                  
                  // PCM音声データをFloat32Arrayに変換
                  const int16Data = new Int16Array(bytes.buffer);
                  const float32Data = new Float32Array(int16Data.length);
                  for (let i = 0; i < int16Data.length; i++) {
                    float32Data[i] = int16Data[i] / 32768.0;
                  }
                  
                  // 再生用AudioContextの状態を確認して再開
                  if (playbackContextRef.current && playbackContextRef.current.state === 'suspended') {
                    playbackContextRef.current.resume();
                    console.log('Playback AudioContext resumed, state:', playbackContextRef.current.state);
                  }
                  
                  // 音声データをWorkletに送信
                  audioWorkletNodeRef.current.port.postMessage({
                    type: 'audio',
                    audioData: float32Data
                  });
                  
                  setIsPlaying(true);
                  
                  // 再生状態を一定時間後に更新
                  setTimeout(() => {
                    setIsPlaying(false);
                  }, 500);
                } catch (err) {
                  console.error('Error processing received audio data:', err);
                }
              }
            }
          },
          error: (err: any) => {
            console.error('Error in AppSync Events subscription:', err);
            setError(err instanceof Error ? err : new Error('AppSync Events subscription error'));
            setIsConnected(false);
          },
        });
      } catch (err) {
        console.error('Failed to connect to AppSync Events:', err);
        setError(err instanceof Error ? err : new Error('Failed to connect to AppSync Events'));
        setIsConnected(false);
      }
    };
    
    // 初期化処理を実行
    initializeAudio().then(connectToAppSync);
    
    // クリーンアップ関数
    return () => {
      console.log('Cleaning up Nova Sonic hook');
      
      // バッファをクリア
      if (audioBufferQueueRef.current.length > 0) {
        console.log(`Clearing audio buffer queue with ${audioBufferQueueRef.current.length} items`);
        audioBufferQueueRef.current = [];
      }
      
      // マイクストリームの停止
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      
      // AudioWorkletNodeの切断
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }
      
      if (recorderWorkletNodeRef.current) {
        recorderWorkletNodeRef.current.disconnect();
        recorderWorkletNodeRef.current = null;
      }
      
      if (analyserNodeRef.current) {
        analyserNodeRef.current.disconnect();
        analyserNodeRef.current = null;
      }
      
      // AudioContextの閉じる
      if (recordingContextRef.current) {
        recordingContextRef.current.close();
        recordingContextRef.current = null;
      }
      
      if (playbackContextRef.current) {
        playbackContextRef.current.close();
        playbackContextRef.current = null;
      }
      
      // AppSync Eventsの切断
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
        setIsConnected(false);
        console.log('Disconnected from AppSync Events');
      }
    };
  }, []);
  
  // 録音を開始する関数
  const startRecording = useCallback(async () => {
    if (isRecording) {
      console.log('Already recording');
      return;
    }
    
    // バッファをクリア
    audioBufferQueueRef.current = [];
    isProcessingAudioRef.current = false;
    
    try {
      console.log('Starting recording...');
      
      // AudioContext の状態を確認して再開
      if (recordingContextRef.current && recordingContextRef.current.state === 'suspended') {
        await recordingContextRef.current.resume();
        console.log('Recording AudioContext resumed, state:', recordingContextRef.current.state);
      }
      
      if (!recordingContextRef.current) {
        console.error('Recording AudioContext is not initialized');
        return;
      }
      
      // マイクへのアクセス許可を取得
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      console.log('Microphone access granted, tracks:', stream.getAudioTracks().length);
      micStreamRef.current = stream;
      
      // マイク入力のソースノードを作成
      sourceNodeRef.current = recordingContextRef.current.createMediaStreamSource(stream);
      console.log('MediaStreamSource created');
      
      // 録音用のWorkletNodeを作成
      console.log('Creating AudioWorkletNode...');
      recorderWorkletNodeRef.current = new AudioWorkletNode(
        recordingContextRef.current,
        'audio-recorder-processor'
      );
      console.log('AudioWorkletNode created');
      
      // 録音パラメータを取得
      recordingParamRef.current = recorderWorkletNodeRef.current.parameters.get('isRecording')!;
      console.log('Got recording parameter:', recordingParamRef.current ? 'yes' : 'no');
      
      // デバッグ用のAnalyserNodeを作成
      analyserNodeRef.current = recordingContextRef.current.createAnalyser();
      
      // マイク入力を録音用Workletに接続
      sourceNodeRef.current.connect(recorderWorkletNodeRef.current);
      // WorkletをAnalyserに接続（音声を出力しないようにする）
      recorderWorkletNodeRef.current.connect(analyserNodeRef.current);
      
      console.log('Audio nodes connected');
      
      // 録音開始コマンドを送信
      console.log('Sending start command to recorder worklet');
      recorderWorkletNodeRef.current.port.postMessage({ command: 'start' });
      
      // パラメータで録音状態を設定
      if (recordingParamRef.current) {
        recordingParamRef.current.setValueAtTime(1, recordingContextRef.current.currentTime);
        console.log('Set recording parameter to 1');
      }
      
      // 録音データの受信ハンドラを設定
      console.log('Setting up message handler');
      recorderWorkletNodeRef.current.port.onmessage = (event) => {
        if (event.data.eventType === 'audioData') {
          console.log('Audio data received from worklet, length:', event.data.audioData.length);
          
          // 音声データをキューに追加（直接送信せず）
          queueAudioData(event.data.audioData);
        } else {
          console.log('Other message from worklet:', event.data);
        }
      };
      
      // テスト用のメッセージを送信
      setTimeout(() => {
        if (recorderWorkletNodeRef.current) {
          console.log('Sending test message to worklet');
          recorderWorkletNodeRef.current.port.postMessage({ command: 'test' });
        }
      }, 1000);
      
      setIsRecording(true);
      console.log('Recording started');
      
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err instanceof Error ? err : new Error('Failed to start recording'));
    }
  }, [isRecording, isConnected]);
  
  // 録音を停止する関数
  const stopRecording = useCallback(() => {
    if (!isRecording) {
      console.log('Not recording');
      return;
    }
    
    console.log('Stopping recording...');
    
    // 残りのバッファを処理
    if (audioBufferQueueRef.current.length > 0) {
      console.log(`Processing remaining ${audioBufferQueueRef.current.length} audio chunks before stopping`);
      processAudioQueue();
    }
    
    // パラメータで録音状態を設定
    if (recordingParamRef.current && recordingContextRef.current) {
      recordingParamRef.current.setValueAtTime(0, recordingContextRef.current.currentTime);
      console.log('Set recording parameter to 0');
    }
    
    // 録音停止コマンドを送信
    if (recorderWorkletNodeRef.current) {
      recorderWorkletNodeRef.current.port.postMessage({ command: 'stop' });
      
      // 残りのバッファを処理
      if (audioBufferQueueRef.current.length > 0) {
        console.log(`Processing remaining ${audioBufferQueueRef.current.length} audio chunks before stopping`);
        processAudioQueue();
      }
      
      recorderWorkletNodeRef.current.disconnect();
      recorderWorkletNodeRef.current = null;
    }
    
    // マイクストリームの停止
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    
    // ソースノードの切断
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    // アナライザーノードの切断
    if (analyserNodeRef.current) {
      analyserNodeRef.current.disconnect();
      analyserNodeRef.current = null;
    }
    
    setIsRecording(false);
    console.log('Recording stopped');
    
    // 録音停止を通知
    if (channelRef.current && isConnected) {
      events.post(CHANNEL_NAME, {
        type: 'ClientToAppSync',
        data: {
          sessionId: sessionIdRef.current,
          action: 'stopRecording',
          timestamp: Date.now()
        }
      }).then(() => {
        console.log('Stop recording notification sent successfully');
      }).catch(err => {
        console.error('Failed to send stop recording notification:', err);
      });
    }
  }, [isRecording, isConnected]);
  
  // 新しいセッションを開始する関数
  const startNewSession = useCallback(() => {
    if (!channelRef.current || !isConnected) {
      console.error('Cannot start new session: Not connected to AppSync Events');
      return;
    }
    
    // バッファをクリア
    audioBufferQueueRef.current = [];
    isProcessingAudioRef.current = false;
    
    sessionIdRef.current = crypto.randomUUID();
    console.log(`Started new session with ID: ${sessionIdRef.current}`);
    
    // 新しいセッション開始を通知
    channelRef.current.publish({
      type: 'ClientToAppSync',
      data: {
        sessionId: sessionIdRef.current,
        action: 'startSession',
        timestamp: Date.now()
      }
    }).then(() => {
      console.log('Start session notification sent successfully');
    }).catch((err: any) => {
      console.error('Failed to send start session notification:', err);
    });
  }, [isConnected]);
  
  return {
    isConnected,
    isRecording,
    isPlaying,
    error,
    startRecording,
    stopRecording,
    startNewSession,
    sessionId: sessionIdRef.current
  };
};
