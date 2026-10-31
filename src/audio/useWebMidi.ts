import { useState, useEffect, useCallback, useRef } from 'react';

export interface WebMidiState {
  isSupported: boolean;
  isConnected: boolean;
  deviceName: string | null;
  hasActivity: boolean;
  error: string | null;
}

interface UseWebMidiOptions {
  onNoteOn?: (midiNote: number, velocity: number) => void;
  onNoteOff?: (midiNote: number) => void;
}

export function useWebMidi({ onNoteOn, onNoteOff }: UseWebMidiOptions = {}) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [hasActivity, setHasActivity] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const activityTimeoutRef = useRef<number | null>(null);
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);

  useEffect(() => {
    onNoteOnRef.current = onNoteOn;
    onNoteOffRef.current = onNoteOff;
  }, [onNoteOn, onNoteOff]);

  const triggerActivity = useCallback(() => {
    setHasActivity(true);
    if (activityTimeoutRef.current !== null) {
      window.clearTimeout(activityTimeoutRef.current);
    }
    activityTimeoutRef.current = window.setTimeout(() => {
      setHasActivity(false);
    }, 180);
  }, []);

  const setupInputs = useCallback((midiAccess: MIDIAccess) => {
    const inputs = Array.from(midiAccess.inputs.values());
    if (inputs.length > 0) {
      setIsConnected(true);
      const names = inputs.map(i => i.name).filter(Boolean).join(', ');
      setDeviceName(names || 'USB MIDI Device');
      setError(null);
    } else {
      setIsConnected(false);
      setDeviceName(null);
    }

    inputs.forEach((input) => {
      input.onmidimessage = (event: MIDIMessageEvent) => {
        const data = event.data;
        if (!data || data.length < 2) return;

        const status = data[0];
        const command = status >> 4;
        const note = data[1];
        const velocity = data.length > 2 ? data[2] : 0;

        triggerActivity();

        if (command === 9 && velocity > 0) {
          // Note On
          onNoteOnRef.current?.(note, velocity);
        } else if (command === 8 || (command === 9 && velocity === 0)) {
          // Note Off
          onNoteOffRef.current?.(note);
        }
      };
    });
  }, [triggerActivity]);

  const requestMidi = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      setIsSupported(false);
      setError('Web MIDI not supported by this browser');
      return;
    }

    setIsSupported(true);
    try {
      const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      midiAccessRef.current = midiAccess;
      setupInputs(midiAccess);

      midiAccess.onstatechange = () => {
        setupInputs(midiAccess);
      };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'MIDI permission denied');
      setIsConnected(false);
    }
  }, [setupInputs]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
      setIsSupported(true);
      requestMidi();
    } else {
      setIsSupported(false);
    }

    return () => {
      if (activityTimeoutRef.current !== null) {
        window.clearTimeout(activityTimeoutRef.current);
      }
      if (midiAccessRef.current) {
        midiAccessRef.current.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
      }
    };
  }, [requestMidi]);

  return {
    isSupported,
    isConnected,
    deviceName,
    hasActivity,
    error,
    requestMidi,
  };
}
