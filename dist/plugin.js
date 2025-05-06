var capacitorCapacitorVoiceRecorder = (function (exports, core, extendableMediaRecorder, extendableMediaRecorderWavEncoder) {
    'use strict';

    exports.RecordingError = void 0;
    (function (RecordingError) {
        RecordingError["NOT_RECORDING"] = "NOT_RECORDING";
        RecordingError["DEVICE_NOT_SUPPORTED"] = "DEVICE_NOT_SUPPORTED";
        RecordingError["MISSING_MICROPHONE_PERMISSION"] = "MISSING_MICROPHONE_PERMISSION";
        RecordingError["MICROPHONE_IN_USE"] = "MICROPHONE_IN_USE";
        RecordingError["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    })(exports.RecordingError || (exports.RecordingError = {}));

    const CapacitorVoiceRecorder = core.registerPlugin('CapacitorVoiceRecorder', {
        web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.CapacitorVoiceRecorderWeb()),
    });

    class CapacitorVoiceRecorderWeb extends core.WebPlugin {
        constructor() {
            super();
            this.mimeType = 'audio/wav';
            this._chunks = [];
        }
        async canRecord() {
            var _a;
            if (!((_a = navigator.mediaDevices) === null || _a === undefined ? undefined : _a.getUserMedia)) {
                return Promise.reject(exports.RecordingError.DEVICE_NOT_SUPPORTED);
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
            if (!((_a = navigator.mediaDevices) === null || _a === undefined ? undefined : _a.getUserMedia)) {
                return Promise.reject(exports.RecordingError.DEVICE_NOT_SUPPORTED);
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
                return Promise.reject(exports.RecordingError.MISSING_MICROPHONE_PERMISSION);
            }
        }
        async startRecording() {
            if (this._mediaRecorder != null) {
                return Promise.reject(exports.RecordingError.MICROPHONE_IN_USE);
            }
            const hasPermission = await this.canRecord();
            if (!hasPermission) {
                return Promise.reject(exports.RecordingError.MISSING_MICROPHONE_PERMISSION);
            }
            this._encoder = await extendableMediaRecorderWavEncoder.connect();
            await extendableMediaRecorder.register(this._encoder);
            this._mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this._mediaRecorder = new extendableMediaRecorder.MediaRecorder(this._mediaStream, { mimeType: 'audio/wav' });
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
                    return Promise.reject(exports.RecordingError.NOT_RECORDING);
                }
                this._mediaRecorder.stop();
                this._prepareInstanceForNextOperation();
                this._startedRecordingAt = undefined;
                this._mediaStream = undefined;
                this._mediaRecorder = undefined;
                this._chunks = [];
                return Promise.reject(exports.RecordingError.UNKNOWN_ERROR);
            };
            this._mediaRecorder.start(100);
        }
        async stopRecording() {
            if (!this._mediaRecorder) {
                return Promise.reject(exports.RecordingError.NOT_RECORDING);
            }
            const mimeType = this.mimeType;
            if (mimeType == null) {
                return Promise.reject(exports.RecordingError.DEVICE_NOT_SUPPORTED);
            }
            this._prepareInstanceForNextOperation();
            const blobVoiceRecording = new Blob(this._chunks, { type: mimeType });
            const recordingDuration = new Date().getTime() - this._startedRecordingAt.getTime();
            this._startedRecordingAt = undefined;
            this._mediaStream = undefined;
            this._mediaRecorder = undefined;
            this._chunks = [];
            await extendableMediaRecorder.deregister(this._encoder);
            await extendableMediaRecorderWavEncoder.disconnect(this._encoder);
            this._encoder = undefined;
            return {
                base64: await this._blobToBase64(blobVoiceRecording),
                msDuration: recordingDuration,
                size: blobVoiceRecording.size,
            };
        }
        async pauseRecording() {
            if (!this._mediaRecorder) {
                return Promise.reject(exports.RecordingError.NOT_RECORDING);
            }
            if (this._mediaRecorder.state === 'recording') {
                this._mediaRecorder.pause();
                return;
            }
            return Promise.reject(exports.RecordingError.NOT_RECORDING);
        }
        async resumeRecording() {
            if (!this._mediaRecorder) {
                return Promise.reject(exports.RecordingError.NOT_RECORDING);
            }
            if (this._mediaRecorder.state === 'paused') {
                this._mediaRecorder.resume();
                return;
            }
            return Promise.reject(exports.RecordingError.NOT_RECORDING);
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

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        CapacitorVoiceRecorderWeb: CapacitorVoiceRecorderWeb
    });

    exports.CapacitorVoiceRecorder = CapacitorVoiceRecorder;

    return exports;

})({}, capacitorExports, extendableMediaRecorder, extendableMediaRecorderWavEncoder);
//# sourceMappingURL=plugin.js.map
