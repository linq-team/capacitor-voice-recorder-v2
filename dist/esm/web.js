import { WebPlugin } from '@capacitor/core';
import { deregister, MediaRecorder, register } from 'extendable-media-recorder';
import { connect, disconnect } from 'extendable-media-recorder-wav-encoder';
import { RecordingError } from './definitions';
export class CapacitorVoiceRecorderWeb extends WebPlugin {
    constructor() {
        super();
        this.mimeType = 'audio/wav';
        this._chunks = [];
    }
    async canRecord() {
        var _a;
        if (!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia)) {
            return Promise.reject(RecordingError.DEVICE_NOT_SUPPORTED);
        }
        return navigator.permissions.query({ name: 'microphone' }).then((result) => {
            if (result.state === 'granted') {
                return { status: 'GRANTED' };
            }
            else {
                return { status: 'NOT_GRANTED' };
            }
        });
    }
    async requestPermission() {
        var _a;
        if (!((_a = navigator.mediaDevices) === null || _a === void 0 ? void 0 : _a.getUserMedia)) {
            return Promise.reject(RecordingError.DEVICE_NOT_SUPPORTED);
        }
        const hasPermission = await this.canRecord();
        if (hasPermission) {
            return { isGranted: true };
        }
        try {
            return navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
                stream.getTracks().forEach((track) => track.stop());
                return { isGranted: true };
            });
        }
        catch (error) {
            return Promise.reject(RecordingError.MISSING_MICROPHONE_PERMISSION);
        }
    }
    async startRecording() {
        if (this._mediaRecorder != null) {
            return Promise.reject(RecordingError.MICROPHONE_IN_USE);
        }
        const hasPermission = await this.canRecord();
        if (!hasPermission) {
            return Promise.reject(RecordingError.MISSING_MICROPHONE_PERMISSION);
        }
        this._encoder = await connect();
        await register(this._encoder);
        this._mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this._mediaRecorder = new MediaRecorder(this._mediaStream, { mimeType: 'audio/wav' });
        this._mediaRecorder.onstart = () => {
            this._startedRecordingAt = new Date();
        };
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 8192;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0;
        const dataArray = new Uint8Array(analyser.fftSize);
        const source = audioContext.createMediaStreamSource(this._mediaStream);
        source.connect(analyser);
        this._mediaRecorder.ondataavailable = async (event) => {
            this._chunks.push(event.data);
            analyser.getByteFrequencyData(dataArray);
            const frequencies = btoa(String.fromCharCode.apply(null, Array.from(dataArray).splice(0, analyser.fftSize)));
            this.notifyListeners('frequencyData', { base64: frequencies });
        };
        this._mediaRecorder.onerror = () => {
            if (!this._mediaRecorder) {
                return Promise.reject(RecordingError.NOT_RECORDING);
            }
            this._mediaRecorder.stop();
            this._prepareInstanceForNextOperation();
            this._startedRecordingAt = undefined;
            this._mediaStream = undefined;
            this._mediaRecorder = undefined;
            this._chunks = [];
            return Promise.reject(RecordingError.UNKNOWN_ERROR);
        };
        this._mediaRecorder.start(100);
    }
    async stopRecording() {
        if (!this._mediaRecorder) {
            return Promise.reject(RecordingError.NOT_RECORDING);
        }
        const mimeType = this.mimeType;
        if (mimeType == null) {
            return Promise.reject(RecordingError.DEVICE_NOT_SUPPORTED);
        }
        this._prepareInstanceForNextOperation();
        const blobVoiceRecording = new Blob(this._chunks, { type: mimeType });
        const recordingDuration = new Date().getTime() - this._startedRecordingAt.getTime();
        this._startedRecordingAt = undefined;
        this._mediaStream = undefined;
        this._mediaRecorder = undefined;
        this._chunks = [];
        await deregister(this._encoder);
        await disconnect(this._encoder);
        this._encoder = undefined;
        return {
            base64: await this._blobToBase64(blobVoiceRecording),
            msDuration: recordingDuration,
            size: blobVoiceRecording.size,
        };
    }
    async pauseRecording() {
        if (!this._mediaRecorder) {
            return Promise.reject(RecordingError.NOT_RECORDING);
        }
        if (this._mediaRecorder.state === 'recording') {
            this._mediaRecorder.pause();
            return;
        }
        return Promise.reject(RecordingError.NOT_RECORDING);
    }
    async resumeRecording() {
        if (!this._mediaRecorder) {
            return Promise.reject(RecordingError.NOT_RECORDING);
        }
        if (this._mediaRecorder.state === 'paused') {
            this._mediaRecorder.resume();
            return;
        }
        return Promise.reject(RecordingError.NOT_RECORDING);
    }
    async getCurrentStatus() {
        if (!this._mediaRecorder) {
            return Promise.resolve({ status: 'NOT_RECORDING' });
        }
        if (this._mediaRecorder.state === 'recording') {
            return Promise.resolve({ status: 'RECORDING' });
        }
        else if (this._mediaRecorder.state === 'paused') {
            return Promise.resolve({ status: 'PAUSED' });
        }
        else {
            return Promise.resolve({ status: 'NOT_RECORDING' });
        }
    }
    _prepareInstanceForNextOperation() {
        if (this._mediaRecorder != null && this._mediaRecorder.state === 'recording') {
            try {
                this._mediaRecorder.stop();
                this._mediaStream.getTracks().forEach((track) => track.stop());
            }
            catch (error) {
                console.warn('While trying to stop a media recorder, an error was thrown', error);
            }
        }
    }
    async _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64Data = dataUrl.split(',')[1]; // Extract base64 part
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
//# sourceMappingURL=web.js.map