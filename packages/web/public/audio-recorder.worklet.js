class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.bufferSize = 512;
    this.recordingBuffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.debugCounter = 0;
    
    console.log('[AudioWorklet] AudioRecorderProcessor initialized');
    
    // メッセージハンドラを追加
    this.port.onmessage = (event) => {
      console.log('[AudioWorklet] Message received:', event.data);
      
      if (event.data.command === 'start') {
        console.log('[AudioWorklet] Recording started');
        this.isRecording = true;
      } else if (event.data.command === 'stop') {
        console.log('[AudioWorklet] Recording stopped');
        this.isRecording = false;
      } else if (event.data.command === 'test') {
        console.log('[AudioWorklet] Test message received');
        // テストメッセージに応答
        this.port.postMessage({
          eventType: 'test',
          message: 'Test response from AudioWorklet'
        });
        
        // テスト用にダミーデータを送信
        this.sendTestAudioData();
      }
    };
    
    // 初期化完了を通知
    this.port.postMessage({
      eventType: 'init',
      message: 'AudioRecorderProcessor initialized'
    });
  }
  
  // テスト用にダミーの音声データを送信
  sendTestAudioData() {
    console.log('[AudioWorklet] Sending test audio data');
    const testBuffer = new Float32Array(this.bufferSize);
    // サイン波を生成
    for (let i = 0; i < this.bufferSize; i++) {
      testBuffer[i] = Math.sin(i * 0.01) * 0.5;
    }
    
    this.port.postMessage({
      eventType: 'audioData',
      audioData: testBuffer
    });
  }

  process(inputs, outputs, parameters) {
    // パラメータから録音状態を更新
    const isRecordingParam = parameters.isRecording;
    if (isRecordingParam && isRecordingParam.length > 0) {
      // パラメータ値が0より大きければ録音中
      const newIsRecording = isRecordingParam[0] > 0;
      if (this.isRecording !== newIsRecording) {
        console.log(`[AudioWorklet] Recording state changed from ${this.isRecording} to ${newIsRecording}`);
        this.isRecording = newIsRecording;
      }
    }
    
    // デバッグカウンター
    this.debugCounter++;
    if (this.debugCounter % 100 === 0) {
      console.log('[AudioWorklet] Process called, isRecording:', this.isRecording);
      console.log('[AudioWorklet] Input channels:', inputs[0]?.length);
      
      // 定期的にテストデータを送信（デバッグ用）
      if (this.isRecording && this.debugCounter % 500 === 0) {
        this.sendTestAudioData();
      }
    }

    const input = inputs[0];
    if (!input || !input.length) {
      return true;
    }

    const inputChannel = input[0];
    
    // 入力データの処理（録音中のみ）
    if (this.isRecording) {
      // 音声データがあるか確認
      const hasAudioData = inputChannel.some(sample => Math.abs(sample) > 0.01);
      if (hasAudioData && this.debugCounter % 100 === 0) {
        console.log('[AudioWorklet] Receiving audio data with signal');
      }
      
      for (let i = 0; i < inputChannel.length; i++) {
        this.recordingBuffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;

        // バッファがいっぱいになったらメインスレッドに送信
        if (this.bufferIndex >= this.bufferSize) {
          console.log('[AudioWorklet] Buffer full, sending data');
          this.port.postMessage({
            eventType: 'audioData',
            audioData: this.recordingBuffer.slice(0)
          });
          this.bufferIndex = 0;
        }
      }
    }

    return true;
  }

  // パラメータ定義
  static get parameterDescriptors() {
    return [{
      name: 'isRecording',
      defaultValue: 0,
      minValue: 0,
      maxValue: 1,
      automationRate: 'k-rate'
    }];
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
