// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import { cn } from '@/lib/utils';

export let ThinkingBufferEffect: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    return (
        <span
            className={cn(
                "my-auto p-1 text-[10px] text-gray-400 line-clamp-3 flex items-center gap-1",
                className
            )}
        >
            {text.replace(/[^\s]/g, '·')}
            <span className="text-[10px] opacity-50 rotate-90 text-gray-400 animate-writing">
                ✏️
            </span>
            <style>{`
                @keyframes writing {
                    0%, 100% {
                        transform: translate(0, 0) rotate(80deg);
                    }
                    50% {
                        transform: translate(2px, 2px) rotate(95deg);
                    }
                }
                .animate-writing {
                    animation: writing 1.5s ease-in-out infinite;
                }
            `}</style>
        </span>
    );
};