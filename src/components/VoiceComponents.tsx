// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger 
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Volume2, VolumeX, Loader2, Square } from 'lucide-react';

interface VoiceInputProps {
    onTranscription: (text: string) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * VoiceInput - Microphone input component using Web Speech API
 * Falls back to server-side Whisper if available
 */
export const VoiceInput: React.FC<VoiceInputProps> = ({
    onTranscription,
    disabled = false,
    className
}) => {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Check for Web Speech API support
    const isSpeechRecognitionSupported = typeof window !== 'undefined' && 
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const startListening = useCallback(async () => {
        if (disabled) return;

        // Use Web Speech API if available (preferred - real-time)
        if (isSpeechRecognitionSupported) {
            const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognitionConstructor();
            
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const results = event.results;
                let transcript = '';
                for (let i = 0; i < results.length; i++) {
                    transcript += results[i][0].transcript;
                }
                
                if (results[0].isFinal) {
                    onTranscription(transcript);
                    setIsListening(false);
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
            recognition.start();
        } else {
            // Fallback: Record audio for server-side processing
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    setIsListening(false);
                    setIsProcessing(true);

                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    
                    try {
                        // Convert to base64 and send to server
                        const reader = new FileReader();
                        reader.readAsDataURL(audioBlob);
                        reader.onloadend = async () => {
                            const base64Audio = (reader.result as string).split(',')[1];
                            
                            const response = await fetch('/api/voice/transcribe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ audio_data: base64Audio })
                            });

                            if (response.ok) {
                                const data = await response.json();
                                onTranscription(data.text);
                            } else {
                                console.error('Transcription failed');
                            }
                            setIsProcessing(false);
                        };
                    } catch (error) {
                        console.error('Transcription error:', error);
                        setIsProcessing(false);
                    }

                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorderRef.current = mediaRecorder;
                mediaRecorder.start();
                setIsListening(true);
            } catch (error) {
                console.error('Error accessing microphone:', error);
            }
        }
    }, [disabled, isSpeechRecognitionSupported, onTranscription]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsListening(false);
    }, []);

    const handleClick = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={isListening ? "default" : "outline"}
                        size="icon-sm"
                        onClick={handleClick}
                        disabled={disabled || isProcessing}
                        className={cn(
                            "relative transition-all",
                            isListening && "bg-foreground text-background animate-pulse",
                            className
                        )}
                    >
                        {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isListening ? (
                            <MicOff className="h-4 w-4" />
                        ) : (
                            <Mic className="h-4 w-4" />
                        )}
                        {isListening && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {isListening ? 'Stop listening' : 'Voice input'}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

interface VoiceOutputProps {
    text: string;
    autoPlay?: boolean;
    onStart?: () => void;
    onEnd?: () => void;
    disabled?: boolean;
    className?: string;
}

/**
 * VoiceOutput - Text-to-Speech component using Web Speech API
 * Falls back to server-side TTS if available
 */
export const VoiceOutput: React.FC<VoiceOutputProps> = ({
    text,
    autoPlay = false,
    onStart,
    onEnd,
    disabled = false,
    className
}) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const isSpeechSynthesisSupported = typeof window !== 'undefined' && 
        'speechSynthesis' in window;

    const speak = useCallback(async () => {
        if (!text || disabled) return;

        // Use browser TTS (preferred - no API needed)
        if (isSpeechSynthesisSupported) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Try to use a good voice
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(v => 
                v.name.includes('Aria') || 
                v.name.includes('Natural') ||
                (v.lang.startsWith('en') && v.localService)
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            utterance.onstart = () => {
                setIsSpeaking(true);
                onStart?.();
            };

            utterance.onend = () => {
                setIsSpeaking(false);
                onEnd?.();
            };

            utterance.onerror = () => {
                setIsSpeaking(false);
                onEnd?.();
            };

            utteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);
        } else {
            // Fallback: Use server-side TTS
            try {
                setIsSpeaking(true);
                onStart?.();

                const response = await fetch('/api/voice/synthesize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });

                if (response.ok) {
                    const data = await response.json();
                    const audioBlob = new Blob(
                        [Uint8Array.from(atob(data.audio_data), c => c.charCodeAt(0))],
                        { type: data.format }
                    );
                    const audioUrl = URL.createObjectURL(audioBlob);
                    
                    const audio = new Audio(audioUrl);
                    audioRef.current = audio;
                    
                    audio.onended = () => {
                        setIsSpeaking(false);
                        onEnd?.();
                        URL.revokeObjectURL(audioUrl);
                    };
                    
                    audio.play();
                } else {
                    setIsSpeaking(false);
                    onEnd?.();
                }
            } catch (error) {
                console.error('TTS error:', error);
                setIsSpeaking(false);
                onEnd?.();
            }
        }
    }, [text, disabled, isSpeechSynthesisSupported, onStart, onEnd]);

    const stop = useCallback(() => {
        if (isSpeechSynthesisSupported) {
            window.speechSynthesis.cancel();
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setIsSpeaking(false);
    }, [isSpeechSynthesisSupported]);

    useEffect(() => {
        if (autoPlay && text) {
            speak();
        }
    }, [autoPlay, text, speak]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isSpeechSynthesisSupported) {
                window.speechSynthesis.cancel();
            }
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, [isSpeechSynthesisSupported]);

    const handleClick = () => {
        if (isSpeaking) {
            stop();
        } else {
            speak();
        }
    };

    if (!text) return null;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={isSpeaking ? "default" : "ghost"}
                        size="icon-sm"
                        onClick={handleClick}
                        disabled={disabled}
                        className={cn(
                            "transition-all",
                            isSpeaking && "bg-foreground text-background",
                            className
                        )}
                    >
                        {isSpeaking ? (
                            <Square className="h-3.5 w-3.5" />
                        ) : (
                            <Volume2 className="h-4 w-4" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {isSpeaking ? 'Stop speaking' : 'Read aloud'}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

// Add type declarations for Web Speech API
declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}
