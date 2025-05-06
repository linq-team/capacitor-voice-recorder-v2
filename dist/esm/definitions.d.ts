import { PluginListenerHandle } from '@capacitor/core';
export declare type RecordStatus = 'RECORDING' | 'PAUSED' | 'NOT_RECORDING';
export declare type CanRecordStatus = 'NOT_GRANTED' | 'DISABLED_BY_USER' | RecordingError.DEVICE_NOT_SUPPORTED | 'GRANTED';
export declare type RecordingData = {
    base64: string;
    msDuration: number;
    size: number;
};
export declare enum RecordingError {
    NOT_RECORDING = "NOT_RECORDING",
    DEVICE_NOT_SUPPORTED = "DEVICE_NOT_SUPPORTED",
    MISSING_MICROPHONE_PERMISSION = "MISSING_MICROPHONE_PERMISSION",
    MICROPHONE_IN_USE = "MICROPHONE_IN_USE",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
export interface CapacitorVoiceRecorderPlugin {
    canRecord(): Promise<{
        status: CanRecordStatus;
    }>;
    requestPermission(): Promise<{
        isGranted: true;
    }>;
    startRecording(): Promise<void>;
    stopRecording(): Promise<RecordingData>;
    pauseRecording(): Promise<void>;
    resumeRecording(): Promise<void>;
    getCurrentStatus(): Promise<{
        status: RecordStatus;
    }>;
    addListener(eventName: 'frequencyData', listenerFunc: (data: {
        base64: string;
    }) => void): Promise<PluginListenerHandle>;
    removeAllListeners(): Promise<void>;
}
