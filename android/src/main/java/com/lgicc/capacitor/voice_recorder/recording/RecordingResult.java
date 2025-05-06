package com.lgicc.capacitor.voice_recorder.recording;

import android.util.Base64;

import com.getcapacitor.JSObject;

public class RecordingResult {
    private final byte[] recordingData;
    private final long durationMs;
    private final int size;

    public RecordingResult(byte[] recordingData, long durationMs, int size) {
        this.recordingData = recordingData;
        this.durationMs = durationMs;
        this.size = size;
    }

    public byte[] getRecordingData() {
        return recordingData;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public int getSize() {
        return size;
    }

    public JSObject toJSObject() {
        String encodedRecordingData = Base64.encodeToString(this.recordingData, Base64.DEFAULT);

        JSObject toReturn = new JSObject();
        toReturn.put("base64", encodedRecordingData);
        toReturn.put("msDuration", this.durationMs);
        toReturn.put("size", this.size);

        return toReturn;
    }
}
