import { WebPlugin } from '@capacitor/core';
import type { CanRecordStatus, CapacitorVoiceRecorderPlugin, RecordingData, RecordStatus } from './definitions';
export declare class CapacitorVoiceRecorderWeb extends WebPlugin implements CapacitorVoiceRecorderPlugin {
    private _mediaRecorder?;
    private _mediaStream?;
    mimeType: string;
    private _chunks;
    private _startedRecordingAt?;
    private _encoder;
    constructor();
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
    private _prepareInstanceForNextOperation;
    private _blobToBase64;
}
